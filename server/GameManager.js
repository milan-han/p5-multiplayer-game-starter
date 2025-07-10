const configLoader = require('../shared/ConfigLoader');
const ServerTank = require('./ServerTank');
const ServerBullet = require('./ServerBullet');
const ServerArena = require('./ServerArena');
const ServerBot = require('./ServerBot');

// Load game configuration
const config = configLoader.getAll();

class GameManager {
  constructor(io) {
    this.io = io;
    this.arena = new ServerArena();
    this.tanks = new Map();
    this.bullets = [];
    this.nextBulletId = 1;
    
    // Bot management
    this.bots = new Map();        // botId -> ServerBot instance
    this.nextBotId = 1;
    this.lastBotSpawnTime = 0;
    this.botSpawnInterval = config.bots.spawn_interval_ms;
    this.maxBots = config.bots.max_bots;
    this.minBots = config.bots.min_bots;
    
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
    
    // High-resolution timing for precise game loop
    // Allow environment variable override for deployment environments (e.g., Render.com free tier)
    this.targetFPS = process.env.SERVER_TARGET_FPS ? parseInt(process.env.SERVER_TARGET_FPS) : config.server.target_fps;
    this.performanceWarningThreshold = process.env.SERVER_PERFORMANCE_WARNING_THRESHOLD ? 
      parseInt(process.env.SERVER_PERFORMANCE_WARNING_THRESHOLD) : config.server.performance_warning_threshold;
    this.targetFrameTime = 1000000000n / BigInt(this.targetFPS); // nanoseconds per frame
    this.lastFrameTime = process.hrtime.bigint();
    this.isRunning = true;
    this.frameCount = 0;
    this.lastSecond = Date.now();
    this.actualFPS = 0;
    
    // Start high-resolution game loop
    this.startHighResolutionLoop();
    
    this.setupSocketEvents();
  }

  startHighResolutionLoop() {
    const loop = () => {
      if (!this.isRunning) return;
      
      const currentTime = process.hrtime.bigint();
      const deltaTime = currentTime - this.lastFrameTime;
      
      // Only update if enough time has passed (60Hz = ~16.67ms)
      if (deltaTime >= this.targetFrameTime) {
        // Calculate actual frame time in milliseconds for physics
        const frameTimeMs = Number(deltaTime) / 1000000;
        
        // Update game state
        this.updateGame(frameTimeMs);
        
        // Update timing
        this.lastFrameTime = currentTime;
        this.frameCount++;
        
        // Calculate actual FPS every second
        const now = Date.now();
        if (now - this.lastSecond >= 1000) {
          this.actualFPS = this.frameCount;
          this.frameCount = 0;
          this.lastSecond = now;
          
          // Log performance every 10 seconds
          if (this.actualFPS < this.performanceWarningThreshold) {
            console.warn(`⚠️  Server FPS: ${this.actualFPS}/${this.targetFPS} (performance warning)`);
          }
        }
      }
      
      // Schedule next frame with minimal delay
      setImmediate(loop);
    };
    
    // Start the loop
    loop();
    console.log(`🚀 High-resolution game loop started (target: ${this.targetFPS}Hz)`);
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
    
    // Enhanced movement with speed mode parameters
    const inputSpeedMode = data.speedMode || false;
    const isContinuous = data.continuous || false;
    
    tank.tryMove(data.direction, inputSpeedMode, isContinuous);
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
    
    // Enhanced speed mode toggle with immediate activation
    const immediate = data.immediate !== undefined ? data.immediate : true;
    
    tank.setSpeedMode(data.enabled, immediate);
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
    
    // Enhanced debugging for bot bullets
    const shooterType = tank.isBot ? "BOT" : "HUMAN";
    console.log(`${shooterType} ${tank.id} created bullet ${bulletId} at (${Math.round(tank.x)}, ${Math.round(tank.y)}) heading ${Math.round(tank.heading)}°`);
    console.log(`Total bullets in game: ${this.bullets.length}`);
  }

  updateGame(frameTimeMs = 16.67) {
    // Pass frame time for frame-rate independent calculations
    this.updateTanks(frameTimeMs);
    this.updateBots(frameTimeMs);
    this.updateBullets(frameTimeMs);
    this.updateArena(frameTimeMs);
    this.checkCollisions(frameTimeMs);
    this.manageBotSpawning(frameTimeMs);
    this.broadcastGameState();
  }

  updateTanks(frameTimeMs) {
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

  updateBots(frameTimeMs) {
    for (const bot of this.bots.values()) {
      bot.update(this.tanks, this.bullets);
    }
  }

  updateBullets(frameTimeMs) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.update();
      
      // Remove if should be removed
      if (bullet.shouldRemove()) {
        this.bullets.splice(i, 1);
      }
    }
  }

  updateArena(frameTimeMs) {
    this.arena.update();
  }

  checkCollisions(frameTimeMs) {
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
            
            // Emit kill events with death statistics
            this.io.emit('playerKilled', {
              killer: bullet.ownerId,
              victim: hitTank.id,
              timestamp: Date.now(),
              victimStats: {
                killStreak: hitTank.killStreak,
                timeAlive: hitTank.getTimeAliveAtDeath()
              }
            });
            
            this.io.emit('killStreakUpdate', {
              playerId: bullet.ownerId,
              streak: shooterTank.killStreak,
              timestamp: Date.now()
            });
            
            // Check for revenge scenario
            if (shooterTank.lastKilledBy === hitTank.id) {
              // This is revenge! The shooter was previously killed by the victim
              this.io.emit('revengeKill', {
                avenger: bullet.ownerId,
                target: hitTank.id,
                timestamp: Date.now()
              });
            }
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

  manageBotSpawning(frameTimeMs) {
    const now = Date.now();
    const humanPlayerCount = this.getHumanPlayerCount();
    const currentBotCount = this.bots.size;
    
    // Don't spawn bots if no human players
    if (humanPlayerCount === 0) {
      return;
    }
    
    // Check if we should spawn a bot
    const shouldSpawnBot = 
      currentBotCount < this.maxBots &&
      currentBotCount < Math.max(this.minBots, humanPlayerCount) &&
      (now - this.lastBotSpawnTime) >= this.botSpawnInterval;
    
    if (shouldSpawnBot) {
      this.spawnBot();
    }
    
    // Remove bots if too many (in case config changed)
    while (this.bots.size > this.maxBots) {
      const firstBotId = this.bots.keys().next().value;
      this.removeBot(firstBotId);
    }
  }

  spawnBot() {
    const botId = `bot_${this.nextBotId++}`;
    const tank = new ServerTank(botId, this.arena);
    const bot = new ServerBot(botId, tank, this.arena, this);
    
    // Configure bot appearance
    tank.setName(this.generateBotName());
    tank.setColor(this.getBotColor());
    
    // Add to collections
    this.tanks.set(botId, tank);
    this.bots.set(botId, bot);
    
    this.lastBotSpawnTime = Date.now();
    console.log(`Spawned bot: ${botId} (Total bots: ${this.bots.size})`);
  }

  removeBot(botId) {
    const bot = this.bots.get(botId);
    if (bot) {
      this.tanks.delete(botId);
      this.bots.delete(botId);
      console.log(`Removed bot: ${botId} (Total bots: ${this.bots.size})`);
    }
  }

  getHumanPlayerCount() {
    let count = 0;
    for (const tank of this.tanks.values()) {
      if (!tank.isBot) {
        count++;
      }
    }
    return count;
  }

  generateBotName() {
    const prefixes = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Theta', 'Omega'];
    const suffixes = ['Unit', 'Drone', 'Bot', 'AI', 'System', 'Core', 'Node', 'Proto'];
    
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const number = Math.floor(Math.random() * 999) + 1;
    
    return `${prefix}-${suffix}-${number.toString().padStart(3, '0')}`;
  }

  getBotColor() {
    const availableColors = config.colors.player_colors.filter(color => color !== '#FF5C5C'); // Avoid red
    const colorIndex = (this.nextBotId - 1) % availableColors.length;
    return availableColors[colorIndex];
  }

  shutdown() {
    console.log('🛑 Shutting down game loop...');
    this.isRunning = false;
    
    // Log final performance stats
    if (this.actualFPS > 0) {
      console.log(`📊 Final server performance: ${this.actualFPS}Hz (target: ${this.targetFPS}Hz)`);
    }
  }
}

module.exports = GameManager;