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
    
    // Track player order for color assignment
    this.playerOrder = [];
    
    // Phase 10: Input sequence tracking for acknowledgment
    this.playerInputSequences = new Map(); // playerId -> last sequence
    
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

      // Player join event handler
      socket.on('playerJoin', (data) => {
        this.handlePlayerJoin(socket.id, data);
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
    // Assign color from palette based on player order
    const colorIndex = this.playerOrder.length % config.colors.player_colors.length;
    const playerColor = config.colors.player_colors[colorIndex];
    
    // Track player order
    this.playerOrder.push(id);
    
    const tank = new ServerTank(id, this.arena);
    tank.setColor(playerColor);
    this.tanks.set(id, tank);
    this.broadcastGameState();
  }

  removePlayer(id) {
    // Remove from player order tracking
    const index = this.playerOrder.indexOf(id);
    if (index > -1) {
      this.playerOrder.splice(index, 1);
    }
    
    // Phase 10: Clean up input sequence tracking
    this.playerInputSequences.delete(id);
    
    this.tanks.delete(id);
    this.broadcastGameState();
  }

  handlePlayerMove(playerId, data) {
    const tank = this.tanks.get(playerId);
    if (!tank) return;

    // Phase 10: Track input sequence for acknowledgment
    this.updateInputSequence(playerId, data);
    
    tank.tryMove(data.direction);
  }

  handlePlayerRotate(playerId, data) {
    const tank = this.tanks.get(playerId);
    if (!tank) return;

    // Phase 10: Track input sequence for acknowledgment
    this.updateInputSequence(playerId, data);
    
    tank.tryRotate(data.direction);
  }

  handlePlayerShoot(playerId, data = {}) {
    const tank = this.tanks.get(playerId);
    if (!tank) return;

    // Phase 10: Track input sequence for acknowledgment
    this.updateInputSequence(playerId, data);
    
    if (tank.tryShoot()) {
      this.createBullet(tank);
    }
  }

  handlePlayerPickupAmmo(playerId, data = {}) {
    const tank = this.tanks.get(playerId);
    if (!tank) return;

    // Phase 10: Track input sequence for acknowledgment
    this.updateInputSequence(playerId, data);
    
    tank.tryPickupAmmo();
  }

  handleSpeedModeToggle(playerId, data) {
    const tank = this.tanks.get(playerId);
    if (!tank) return;

    // Phase 10: Track input sequence for acknowledgment
    this.updateInputSequence(playerId, data);
    
    tank.setSpeedMode(data.enabled);
  }

  handlePlayerJoin(playerId, data) {
    const tank = this.tanks.get(playerId);
    if (!tank) return;

    // Set player name
    tank.setName(data.name);

    // Emit successful join event
    this.io.to(playerId).emit('playerJoined', {
      playerId: playerId,
      name: data.name
    });

    console.log(`Player ${playerId} joined with name: ${data.name}`);
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

  // Phase 10: Track input sequence for acknowledgment
  updateInputSequence(playerId, data) {
    if (data.sequence !== undefined) {
      this.playerInputSequences.set(playerId, data.sequence);
    }
  }

  broadcastGameState() {
    this.gameState.tanks = Array.from(this.tanks.values()).map(tank => tank.getState());
    this.gameState.bullets = this.bullets.map(bullet => bullet.getState());
    this.gameState.arena = this.arena.getState();
    this.gameState.timestamp = Date.now();
    
    // Phase 10: Add input sequence acknowledgment to game state
    this.gameState.inputSequences = Object.fromEntries(this.playerInputSequences);
    
    this.io.emit('gameState', this.gameState);
  }

  shutdown() {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
    }
  }
}

module.exports = GameManager;