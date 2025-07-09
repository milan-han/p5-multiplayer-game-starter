const yaml = require('js-yaml');
const fs = require('fs');
const ServerTank = require('./ServerTank');
const ServerBullet = require('./ServerBullet');
const ServerArena = require('./ServerArena');

// Load game configuration
const configPath = './spec/blueprint-battle.yaml';
const config = yaml.load(fs.readFileSync(configPath, 'utf8'));

class GameManager {
  constructor(io) {
    this.io = io;
    this.arena = new ServerArena();
    this.tanks = new Map();
    this.bullets = [];
    this.nextBulletId = 1;
    
    this.gameState = {
      tanks: [],
      bullets: [],
      arena: null,
      timestamp: Date.now()
    };
    
    // 60Hz game loop (16.67ms intervals)
    this.gameLoop = setInterval(() => this.updateGame(), config.server.game_loop_interval_ms);
    
    this.setupSocketEvents();
  }

  setupSocketEvents() {
    this.io.on('connection', (socket) => {
      console.log(`New connection ${socket.id}`);
      this.addPlayer(socket.id);
      
      socket.on('disconnect', () => {
        this.removePlayer(socket.id);
        console.log(`Disconnected ${socket.id}`);
      });

      // Input event handlers
      socket.on('playerMove', (data) => {
        this.handlePlayerMove(socket.id, data);
      });

      socket.on('playerRotate', (data) => {
        this.handlePlayerRotate(socket.id, data);
      });

      socket.on('playerShoot', (data) => {
        this.handlePlayerShoot(socket.id, data);
      });

      socket.on('playerPickupAmmo', (data) => {
        this.handlePlayerPickupAmmo(socket.id, data);
      });

      socket.on('speedModeToggle', (data) => {
        this.handleSpeedModeToggle(socket.id, data);
      });
    });
  }

  addPlayer(id) {
    const tank = new ServerTank(id, this.arena);
    this.tanks.set(id, tank);
    this.broadcastGameState();
  }

  removePlayer(id) {
    this.tanks.delete(id);
    this.broadcastGameState();
  }

  handlePlayerMove(playerId, data) {
    const tank = this.tanks.get(playerId);
    if (!tank) return;

    tank.tryMove(data.direction);
  }

  handlePlayerRotate(playerId, data) {
    const tank = this.tanks.get(playerId);
    if (!tank) return;

    tank.tryRotate(data.direction);
  }

  handlePlayerShoot(playerId) {
    const tank = this.tanks.get(playerId);
    if (!tank) return;

    if (tank.tryShoot()) {
      this.createBullet(tank);
    }
  }

  handlePlayerPickupAmmo(playerId) {
    const tank = this.tanks.get(playerId);
    if (!tank) return;

    tank.tryPickupAmmo();
  }

  handleSpeedModeToggle(playerId, data) {
    const tank = this.tanks.get(playerId);
    if (!tank) return;

    tank.setSpeedMode(data.enabled);
  }

  createBullet(tank) {
    const bulletId = this.nextBulletId++;
    const bullet = new ServerBullet(bulletId, tank, this.arena);
    this.bullets.push(bullet);
  }

  updateGame() {
    this.updateTanks();
    this.updateBullets();
    this.updateArena();
    this.checkCollisions();
    this.broadcastGameState();
  }

  updateTanks() {
    for (const tank of this.tanks.values()) {
      const updateResult = tank.update();
      
      // Check if tank respawned
      if (updateResult && updateResult.type === 'respawn') {
        this.io.emit('playerRespawned', {
          playerId: tank.id,
          position: { x: tank.x, y: tank.y },
          timestamp: Date.now()
        });
      }
    }
  }

  updateBullets() {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.update();
      
      // Remove if should be removed
      if (bullet.shouldRemove()) {
        this.bullets.splice(i, 1);
      }
    }
  }

  updateArena() {
    this.arena.update();
  }

  checkCollisions() {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      const hitTank = bullet.checkAllTankCollisions(this.tanks);
      
      if (hitTank) {
        // Actually kill the victim tank
        const wasKilled = hitTank.hit(bullet);
        
        if (wasKilled) {
          // Award kill to shooter
          const shooterTank = this.tanks.get(bullet.ownerId);
          if (shooterTank && shooterTank.alive) {
            shooterTank.addKill();
            
            // Emit kill events
            this.io.emit('playerKilled', {
              killer: bullet.ownerId,
              victim: hitTank.id,
              timestamp: Date.now()
            });
            
            this.io.emit('killStreakUpdate', {
              playerId: bullet.ownerId,
              streak: shooterTank.killStreak,
              timestamp: Date.now()
            });
          }
        }
        
        // Remove bullet
        this.bullets.splice(i, 1);
      }
    }
  }

  broadcastGameState() {
    this.gameState.tanks = Array.from(this.tanks.values()).map(tank => tank.getState());
    this.gameState.bullets = this.bullets.map(bullet => bullet.getState());
    this.gameState.arena = this.arena.getState();
    this.gameState.timestamp = Date.now();
    
    this.io.emit('gameState', this.gameState);
  }

  shutdown() {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
    }
  }
}

module.exports = GameManager;