const configLoader = require('../shared/ConfigLoader');
const BotPathfinder = require('./BotPathfinder');

const config = configLoader.getAll();

// Bot states for AI decision making
const BotStates = {
  SPAWNING: 'spawning',           // Just respawned, getting bearings
  ROAM_FOR_AMMO: 'roam_for_ammo', // No ammo, searching for pickup
  HUNT_TARGET: 'hunt_target',      // Has ammo, seeking enemy to shoot
  ENGAGE_COMBAT: 'engage_combat',  // In shooting range, aiming/firing
  EVADE_DANGER: 'evade_danger',    // Low health or under fire, retreating
  FLANK_SHIELDED: 'flank_shielded' // Target is shielded, finding angle
};

// Bot personality types
const BotPersonalities = {
  AGGRESSIVE: 'aggressive',
  DEFENSIVE: 'defensive', 
  BALANCED: 'balanced'
};

class ServerBot {
  constructor(id, tank, arena, gameManager) {
    this.id = id;
    this.tank = tank;
    this.arena = arena;
    this.gameManager = gameManager;
    
    // Add pathfinding system
    this.pathfinder = new BotPathfinder(arena);
    this.currentPath = [];
    this.pathTarget = null;
    
    // Mark tank as bot for special handling
    this.tank.isBot = true;
    
    // AI state management
    this.state = BotStates.SPAWNING;
    this.stateTimer = 0;
    this.lastStateChange = Date.now();
    
    // Reaction timing for human-like behavior
    this.reactionTimeMs = this.getRandomReactionTime();
    this.lastActionTime = 0;
    this.nextActionTime = 0;
    
    // NEW: Rotation cooldown to prevent shooting before turning
    this.lastRotationTime = 0;
    this.rotationCooldownMs = 300; // Must wait 300ms after rotation before shooting
    
    // Target tracking
    this.currentTarget = null;
    this.lastSeenTargets = new Map(); // targetId -> {lastSeen, position}
    this.targetLostTime = 0;
    
    // Movement tracking
    this.lastPosition = { gridX: tank.gridX, gridY: tank.gridY };
    this.stuckCounter = 0;
    this.pathUpdateCounter = 0;
    
    // NEW: Movement commitment for human-like behavior
    this.movementCommitment = 0;
    
    // Combat tracking
    this.lastShotTime = 0;
    this.consecutiveMisses = 0;
    
    // Assign random personality
    this.personality = this.assignPersonality();
    
    // Apply personality modifiers to base config
    this.applyPersonalityModifiers();
    
    console.log(`Bot ${this.id} spawned with ${this.personality} personality`);
  }
  
  // Assign random personality based on configured probabilities
  assignPersonality() {
    const rand = Math.random();
    const aggressive = config.bots.personalities.aggressive;
    const defensive = config.bots.personalities.defensive;
    
    if (rand < aggressive) {
      return BotPersonalities.AGGRESSIVE;
    } else if (rand < aggressive + defensive) {
      return BotPersonalities.DEFENSIVE;
    } else {
      return BotPersonalities.BALANCED;
    }
  }
  
  // Apply personality-specific modifiers to bot behavior
  applyPersonalityModifiers() {
    switch (this.personality) {
      case BotPersonalities.AGGRESSIVE:
        this.engagementRange = config.bots.combat.engagement_range_tiles * 1.3;
        this.reactionTimeMultiplier = 0.7; // Faster reactions
        this.accuracyModifier = 0.9; // Slightly worse accuracy due to haste
        this.shieldUsage = config.bots.combat.shield_usage_intelligence * 0.8;
        break;
        
      case BotPersonalities.DEFENSIVE:
        this.engagementRange = config.bots.combat.engagement_range_tiles * 0.8;
        this.reactionTimeMultiplier = 1.3; // Slower, more cautious
        this.accuracyModifier = 1.1; // Better accuracy due to patience
        this.shieldUsage = config.bots.combat.shield_usage_intelligence * 1.2;
        break;
        
      case BotPersonalities.BALANCED:
      default:
        this.engagementRange = config.bots.combat.engagement_range_tiles;
        this.reactionTimeMultiplier = 1.0;
        this.accuracyModifier = 1.0;
        this.shieldUsage = config.bots.combat.shield_usage_intelligence;
        break;
    }
  }
  
  // Get random reaction time within configured range
  getRandomReactionTime() {
    const [min, max] = config.bots.ai.reaction_time_ms;
    return (min + Math.random() * (max - min)) * this.reactionTimeMultiplier;
  }
  
  // Main update function called each game loop
  update(allTanks, bullets) {
    if (!this.tank.alive) {
      this.state = BotStates.SPAWNING;
      return;
    }
    
    // Increment frame counters
    this.stateTimer++;
    this.pathUpdateCounter++;
    
    // Check for immediate threats (bullets)
    const incomingBullet = this.detectIncomingBullet(bullets);
    if (incomingBullet && this.state !== BotStates.EVADE_DANGER) {
      this.changeState(BotStates.EVADE_DANGER);
      this.threatBullet = incomingBullet;
    }
    
    // Check if enough time has passed for next action
    const now = Date.now();
    if (now < this.nextActionTime) {
      return; // Still in reaction delay
    }
    
    // Update perception
    this.updatePerception(allTanks, bullets);
    
    // Update movement tracking for stuck detection
    this.updateMovementTracking();
    
    // State machine logic
    this.updateStateMachine(allTanks);
    
    // Execute current state behavior
    this.executeState(allTanks);
    
    // Schedule next action
    this.scheduleNextAction();
  }
  
  // Update bot's perception of the game world
  updatePerception(allTanks, bullets) {
    // Find visible enemy tanks within vision range
    const visionRange = config.bots.ai.vision_range_tiles * config.arena.tile_size;
    const visibleEnemies = [];
    
    for (const tank of allTanks.values()) {
      if (tank.id === this.id || !tank.alive || tank.isBot) continue;
      
      const distance = this.getDistance(this.tank, tank);
      if (distance <= visionRange) {
        visibleEnemies.push(tank);
        
        // Update last seen information
        this.lastSeenTargets.set(tank.id, {
          lastSeen: Date.now(),
          position: { gridX: tank.gridX, gridY: tank.gridY, x: tank.x, y: tank.y },
          heading: tank.heading
        });
      }
    }
    
    // Select best target if we don't have one or need to switch
    if (!this.currentTarget || !this.isTargetStillValid(allTanks)) {
      this.currentTarget = this.selectBestTarget(visibleEnemies);
    }
  }
  
  // Check if current target is still valid
  isTargetStillValid(allTanks) {
    if (!this.currentTarget) return false;
    
    const target = allTanks.get(this.currentTarget.id);
    if (!target || !target.alive) return false;
    
    // Check if target is still within reasonable range
    const distance = this.getDistance(this.tank, target);
    const maxTrackingRange = config.bots.ai.vision_range_tiles * config.arena.tile_size * 1.5;
    
    return distance <= maxTrackingRange;
  }
  
  // Select the best target from visible enemies
  selectBestTarget(visibleEnemies) {
    if (visibleEnemies.length === 0) return null;
    
    // Score targets based on multiple factors
    let bestTarget = null;
    let bestScore = -1;
    
    for (const enemy of visibleEnemies) {
      let score = 0;
      
      // Distance factor (closer is better)
      const distance = this.getDistance(this.tank, enemy);
      const distanceScore = 1 - (distance / (config.bots.ai.vision_range_tiles * config.arena.tile_size));
      score += distanceScore * 3;
      
      // Kill streak factor (higher streak = higher priority)
      score += enemy.killStreak * 0.5;
      
      // Shield status (unshielded = higher priority)
      if (!enemy.shield) {
        score += 2;
      }
      
      // Ammo status (armed enemies = higher threat)
      if (enemy.ammo > 0) {
        score += 1;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestTarget = enemy;
      }
    }
    
    return bestTarget;
  }
  
  // Update movement tracking to detect if bot is stuck
  updateMovementTracking() {
    const currentPos = { gridX: this.tank.gridX, gridY: this.tank.gridY };
    
    if (currentPos.gridX === this.lastPosition.gridX && 
        currentPos.gridY === this.lastPosition.gridY) {
      this.stuckCounter++;
    } else {
      this.stuckCounter = 0;
      this.lastPosition = currentPos;
    }
  }
  
  // State machine logic for determining bot behavior
  updateStateMachine(allTanks) {
    const now = Date.now();
    
    switch (this.state) {
      case BotStates.SPAWNING:
        // Just spawned, take a moment to get bearings
        if (this.stateTimer > 60) { // 1 second at 60Hz
          this.changeState(this.tank.ammo > 0 ? BotStates.HUNT_TARGET : BotStates.ROAM_FOR_AMMO);
        }
        break;
        
      case BotStates.ROAM_FOR_AMMO:
        // Searching for ammo
        if (this.tank.ammo > 0) {
          this.changeState(BotStates.HUNT_TARGET);
        }
        break;
        
      case BotStates.HUNT_TARGET:
        // Looking for enemies to engage
        if (this.tank.ammo === 0) {
          this.changeState(BotStates.ROAM_FOR_AMMO);
        } else if (this.currentTarget) {
          const distance = this.getDistance(this.tank, this.currentTarget);
          const engagementDistance = this.engagementRange * config.arena.tile_size;
          
          if (distance <= engagementDistance) {
            this.changeState(BotStates.ENGAGE_COMBAT);
          }
        }
        break;
        
      case BotStates.ENGAGE_COMBAT:
        // In combat with target
        if (!this.currentTarget || this.tank.ammo === 0) {
          this.changeState(this.tank.ammo > 0 ? BotStates.HUNT_TARGET : BotStates.ROAM_FOR_AMMO);
        } else if (this.currentTarget.shield && this.isShieldFacingBot()) {
          // Target's shield is blocking, try to flank
          if (Math.random() < config.bots.combat.flank_attempt_probability) {
            this.changeState(BotStates.FLANK_SHIELDED);
          }
        }
        break;
        
      case BotStates.FLANK_SHIELDED:
        // Trying to get around target's shield
        if (!this.currentTarget || this.tank.ammo === 0) {
          this.changeState(this.tank.ammo > 0 ? BotStates.HUNT_TARGET : BotStates.ROAM_FOR_AMMO);
        } else if (!this.isShieldFacingBot()) {
          this.changeState(BotStates.ENGAGE_COMBAT);
        } else if (this.stateTimer > 180) { // 3 seconds timeout
          this.changeState(BotStates.HUNT_TARGET); // Give up flanking
        }
        break;
        
      case BotStates.EVADE_DANGER:
        // Retreating from danger
        if (this.stateTimer > 120) { // 2 seconds of evasion
          this.changeState(this.tank.ammo > 0 ? BotStates.HUNT_TARGET : BotStates.ROAM_FOR_AMMO);
        }
        break;
    }
  }
  
  // Execute behavior for current state
  executeState(allTanks) {
    switch (this.state) {
      case BotStates.SPAWNING:
        // Just orient and get bearings
        break;
        
      case BotStates.ROAM_FOR_AMMO:
        this.executeAmmoSeeking();
        break;
        
      case BotStates.HUNT_TARGET:
        this.executeTargetHunting();
        break;
        
      case BotStates.ENGAGE_COMBAT:
        this.executeCombat();
        break;
        
      case BotStates.FLANK_SHIELDED:
        this.executeFlankingManeuver();
        break;
        
      case BotStates.EVADE_DANGER:
        this.executeEvasion();
        break;
    }
  }
  
  // Execute ammo seeking behavior
  executeAmmoSeeking() {
    // Try to pick up ammo if we're on an ammo tile
    if (this.arena.hasAmmo(this.tank.gridX, this.tank.gridY)) {
      this.tank.tryPickupAmmo();
      return;
    }
    
    // Use simple pathfinding to find nearest ammo
    const currentGrid = { gridX: this.tank.gridX, gridY: this.tank.gridY };
    const ammoPath = this.pathfinder.findPathToNearestAmmo(currentGrid);
    
    if (ammoPath.length > 0) {
      // Move toward ammo using cardinal movement
      const targetAmmo = ammoPath[ammoPath.length - 1];
      this.moveTowardsCardinalOnly(targetAmmo.gridX, targetAmmo.gridY);
    } else {
      // No ammo path found, search more broadly
      this.exploreForAmmo();
    }
  }
  
  // NEW: Explore the arena looking for ammo spawns
  exploreForAmmo() {
    // Get all valid tiles to explore
    const validTiles = this.arena.getAllValidTiles();
    if (validTiles.length === 0) {
      this.moveRandomly();
      return;
    }
    
    // Find tiles we haven't visited recently
    const unexploredTiles = validTiles.filter(tile => {
      const key = `${tile.gridX},${tile.gridY}`;
      return !this.visitedTiles || !this.visitedTiles.has(key) || 
             (Date.now() - this.visitedTiles.get(key)) > 30000; // 30 seconds
    });
    
    if (unexploredTiles.length > 0) {
      // Go to random unexplored tile
      const randomTile = unexploredTiles[Math.floor(Math.random() * unexploredTiles.length)];
      this.moveTowardsCardinalOnly(randomTile.gridX, randomTile.gridY);
      
      // Track visited tiles
      if (!this.visitedTiles) this.visitedTiles = new Map();
      this.visitedTiles.set(`${this.tank.gridX},${this.tank.gridY}`, Date.now());
    } else {
      // All tiles explored recently, move randomly
      this.moveRandomly();
    }
  }
  
  // Execute target hunting behavior
  executeTargetHunting() {
    if (this.currentTarget) {
      // Check if we can get a tactical shot from our current position
      const shotResult = this.calculateShot(this.currentTarget);
      
      if (shotResult.shouldReposition && shotResult.repositionTarget) {
        // We have a target but need to reposition for a shot
        console.log(`Bot ${this.id}: Hunting - moving to tactical position (${shotResult.repositionTarget.gridX}, ${shotResult.repositionTarget.gridY})`);
        
        this.moveTowardsCardinalOnly(
          shotResult.repositionTarget.gridX, 
          shotResult.repositionTarget.gridY
        );
      } else {
        // Standard approach to target using cardinal movement
        this.moveTowardsCardinalOnly(
          this.currentTarget.gridX, 
          this.currentTarget.gridY
        );
      }
    } else {
      // No target, move randomly to find one
      this.moveRandomly();
    }
  }
  
  // Execute combat behavior
  executeCombat() {
    if (!this.currentTarget) {
      return;
    }
    
    // Intelligent shield management
    this.manageShield();
    
    // Get tactical shooting assessment
    const shotResult = this.calculateShot(this.currentTarget);
    
    // Priority 1: Repositioning for better shots
    if (shotResult.shouldReposition && shotResult.repositionTarget) {
      console.log(`Bot ${this.id}: Repositioning to get aligned shot at (${shotResult.repositionTarget.gridX}, ${shotResult.repositionTarget.gridY})`);
      
      // Move to tactical position using cardinal movement
      this.moveTowardsCardinalOnly(
        shotResult.repositionTarget.gridX, 
        shotResult.repositionTarget.gridY
      );
      return;
    }
    
    // Priority 2: Flanking if target's shield is blocking
    if (shotResult.shouldFlank) {
      console.log(`Bot ${this.id}: Target shield is blocking, attempting to flank`);
      this.changeState(BotStates.FLANK_SHIELDED);
      return;
    }
    
    // Priority 3: Rotating to face correct direction
    if (shotResult.shouldRotate) {
      console.log(`Bot ${this.id}: Rotating to face target (${shotResult.targetHeading}°)`);
      this.rotateTowards(shotResult.targetHeading);
      return;
    }
    
    // Priority 4: Shooting when properly aligned
    if (shotResult.shouldShoot && this.canShoot()) {
      const canShoot = this.canShoot();
      const hasAmmo = this.tank.ammo > 0;
      
      console.log(`Bot ${this.id} is aligned and ready to shoot: ammo=${this.tank.ammo}, canShoot=${canShoot}, target=${this.currentTarget.id}`);
      
      if (!hasAmmo) {
        console.log(`Bot ${this.id}: No ammo to shoot`);
        this.changeState(BotStates.ROAM_FOR_AMMO);
        return;
      }
      
      if (!canShoot) {
        console.log(`Bot ${this.id}: On cooldown, last shot: ${Date.now() - this.lastShotTime}ms ago`);
        return;
      }
      
      // Add human-like hesitation before shooting
      if (this.shouldHesitateBeforeShooting()) {
        console.log(`Bot ${this.id}: Hesitating before shot`);
        return;
      }
      
      // Take the shot!
      if (this.tank.tryShoot()) {
        this.gameManager.createBullet(this.tank);
        this.lastShotTime = Date.now();
        this.consecutiveMisses = 0;
        
        if (this.performanceStats) {
          this.performanceStats.shotsFired++;
        }
        
        console.log(`Bot ${this.id} fired tactical shot! Ammo now: ${this.tank.ammo}`);
        
        // After shooting, consider next action
        if (this.tank.ammo === 0) {
          this.changeState(BotStates.ROAM_FOR_AMMO);
        }
      } else {
        console.log(`Bot ${this.id}: tryShoot() failed - ammo=${this.tank.ammo}, alive=${this.tank.alive}`);
      }
    } else {
      // Not ready to shoot - maintain position or seek better angle
      console.log(`Bot ${this.id}: Not ready to shoot, maintaining combat position`);
    }
    
    // Track combat performance for adaptation
    this.trackCombatPerformance();
  }
  
  // NEW: Intelligent shield management based on situation
  manageShield() {
    if (!this.tank.alive) return;
    
    const shouldUseShield = this.shouldUseShield();
    
    if (shouldUseShield && this.tank.speedMode) {
      // Turn off speed mode to enable shield
      this.tank.setSpeedMode(false);
    } else if (!shouldUseShield && !this.tank.speedMode && this.shouldUseSpeedMode()) {
      // Turn on speed mode when appropriate
      this.tank.setSpeedMode(true);
    }
  }
  
  // NEW: Determine if bot should use shield based on current situation
  shouldUseShield() {
    // Always use shield if we have a clear shot opportunity
    if (this.currentTarget && !this.isShieldFacingBot()) {
      return true;
    }
    
    // Use shield intelligence setting with personality modifier
    const baseIntelligence = this.shieldUsage;
    const situationalModifier = this.getSituationalShieldModifier();
    
    return Math.random() < (baseIntelligence * situationalModifier);
  }
  
  // NEW: Get situational modifier for shield usage
  getSituationalShieldModifier() {
    let modifier = 1.0;
    
    // Be more defensive when low on ammo
    if (this.tank.ammo === 0) {
      modifier *= 1.5;
    }
    
    // Be more defensive when multiple enemies nearby
    const nearbyEnemies = this.countNearbyEnemies();
    if (nearbyEnemies > 1) {
      modifier *= 1.3;
    }
    
    // Be less defensive when flanking
    if (this.state === BotStates.FLANK_SHIELDED) {
      modifier *= 0.7;
    }
    
    // Be more defensive when being hunted
    if (this.isBeingTargeted()) {
      modifier *= 1.4;
    }
    
    return Math.min(modifier, 2.0); // Cap the modifier
  }
  
  // NEW: Determine if bot should use speed mode
  shouldUseSpeedMode() {
    // Use speed mode when evading
    if (this.state === BotStates.EVADE_DANGER) {
      return true;
    }
    
    // Use speed mode when flanking and no immediate threats
    if (this.state === BotStates.FLANK_SHIELDED && !this.threatBullet) {
      return Math.random() < 0.6;
    }
    
    // Use speed mode when roaming for ammo and far from enemies
    if (this.state === BotStates.ROAM_FOR_AMMO && this.countNearbyEnemies() === 0) {
      return Math.random() < 0.4;
    }
    
    return false;
  }
  
  // NEW: Count nearby enemy tanks
  countNearbyEnemies() {
    let count = 0;
    const threatRange = config.bots.combat.engagement_range_tiles * config.arena.tile_size;
    
    for (const [targetId, targetInfo] of this.lastSeenTargets) {
      if (targetInfo.position) {
        const distance = Math.sqrt(
          Math.pow(this.tank.x - targetInfo.position.x, 2) + 
          Math.pow(this.tank.y - targetInfo.position.y, 2)
        );
        
        if (distance <= threatRange) {
          count++;
        }
      }
    }
    
    return count;
  }
  
  // NEW: Check if this bot is likely being targeted
  isBeingTargeted() {
    // Simple heuristic: if we've been shot at recently
    return this.threatBullet !== null || 
           (this.lastThreatTime && Date.now() - this.lastThreatTime < 3000);
  }
  
  // NEW: Add human-like hesitation before critical actions
  shouldHesitateBeforeShooting() {
    // Random hesitation based on personality
    const hesitationChance = this.personality === BotPersonalities.DEFENSIVE ? 0.15 : 
                           this.personality === BotPersonalities.AGGRESSIVE ? 0.05 : 0.10;
    
    return Math.random() < hesitationChance;
  }
  
  // NEW: Track combat performance for dynamic difficulty
  trackCombatPerformance() {
    if (!this.performanceStats) {
      this.performanceStats = {
        shotsFired: 0,
        shotsHit: 0,
        killsScored: 0,
        deathsCount: 0,
        lastPerformanceUpdate: Date.now()
      };
    }
    
    // Update performance every 30 seconds
    if (Date.now() - this.performanceStats.lastPerformanceUpdate > 30000) {
      this.adaptDifficulty();
      this.performanceStats.lastPerformanceUpdate = Date.now();
    }
  }
  
  // NEW: Adapt bot difficulty based on performance
  adaptDifficulty() {
    if (!config.bots.auto_scale_difficulty) return;
    
    const accuracy = this.performanceStats.shotsFired > 0 ? 
                    this.performanceStats.shotsHit / this.performanceStats.shotsFired : 0;
    
    const kdr = this.performanceStats.deathsCount > 0 ?
               this.performanceStats.killsScored / this.performanceStats.deathsCount : 
               this.performanceStats.killsScored;
    
    // Adjust accuracy based on performance
    if (accuracy > 0.9 || kdr > 2.0) {
      // Bot is too good, make it slightly worse
      this.accuracyModifier *= 0.95;
      this.reactionTimeMultiplier *= 1.1;
    } else if (accuracy < 0.3 || kdr < 0.5) {
      // Bot is struggling, make it slightly better
      this.accuracyModifier *= 1.05;
      this.reactionTimeMultiplier *= 0.95;
    }
    
    // Keep modifiers within reasonable bounds
    this.accuracyModifier = Math.max(0.5, Math.min(1.5, this.accuracyModifier));
    this.reactionTimeMultiplier = Math.max(0.5, Math.min(2.0, this.reactionTimeMultiplier));
  }
  
  // NEW: Add occasional navigation "mistakes" for realism
  addNavigationError() {
    if (Math.random() < 0.05) { // 5% chance of navigation error
      // Occasionally choose the "wrong" direction
      const randomDirections = ['left', 'right'];
      this.tank.tryRotate(randomDirections[Math.floor(Math.random() * randomDirections.length)]);
      return true;
    }
    return false;
  }
  
  // Enhanced move randomly with human-like behavior
  moveRandomly() {
    // Add navigation errors for realism
    if (this.addNavigationError()) {
      return;
    }
    
    if (Math.random() < config.bots.movement.random_movement_chance) {
      // Random rotation with slight preference for larger turns (more human-like)
      const directions = ['left', 'right'];
      const direction = directions[Math.floor(Math.random() * directions.length)];
      
      // Sometimes make multiple turns in the same direction (human-like behavior)
      const multiTurnChance = 0.3;
      if (Math.random() < multiTurnChance) {
        this.tank.tryRotate(direction);
        // Brief delay before next rotation
        setTimeout(() => {
          if (this.tank.alive && Math.random() < 0.7) {
            this.tank.tryRotate(direction);
          }
        }, 50);
      } else {
        this.tank.tryRotate(direction);
      }
    }
    
    // Try to move forward
    this.tank.tryMove('forward');
  }
  
  // Execute flanking maneuver
  executeFlankingManeuver() {
    if (!this.currentTarget) {
      this.changeState(BotStates.HUNT_TARGET);
      return;
    }
    
    // Try to find a flanking position that gives us a tactical shot
    const tacticalPositions = this.findTacticalPositions(this.currentTarget);
    
    // Filter for positions that would flank around the shield
    const flankingPositions = tacticalPositions.filter(pos => {
      const shootDirection = pos.shootDirection;
      const targetFacing = this.getCurrentCardinalDirectionForTank(this.currentTarget);
      
      // Good flanking positions are from sides or behind
      return shootDirection !== targetFacing;
    });
    
    if (flankingPositions.length > 0) {
      const bestFlankPosition = flankingPositions[0]; // Already sorted by distance
      
      console.log(`Bot ${this.id}: Flanking to (${bestFlankPosition.gridX}, ${bestFlankPosition.gridY}) for ${bestFlankPosition.shootDirection} shot`);
      
      // Move to flanking position using cardinal movement
      this.moveTowardsCardinalOnly(
        bestFlankPosition.gridX,
        bestFlankPosition.gridY
      );
      
      // Check if we've reached flanking position
      if (this.tank.gridX === bestFlankPosition.gridX && this.tank.gridY === bestFlankPosition.gridY) {
        console.log(`Bot ${this.id}: Reached flanking position, switching to combat`);
        this.changeState(BotStates.ENGAGE_COMBAT);
      }
    } else {
      // No good flanking positions found, try a different approach
      console.log(`Bot ${this.id}: No flanking positions available, switching to hunt mode`);
      this.changeState(BotStates.HUNT_TARGET);
    }
  }
  
  // Execute evasion behavior
  executeEvasion() {
    // Use speed mode for faster evasion
    if (Math.random() < config.bots.movement.speed_mode_probability) {
      this.tank.setSpeedMode(true);
    }
    
    if (this.threatBullet) {
      // Calculate evasion direction perpendicular to bullet trajectory
      const bulletDirection = {
        x: Math.cos(this.threatBullet.heading * Math.PI / 180),
        y: Math.sin(this.threatBullet.heading * Math.PI / 180)
      };
      
      // Find perpendicular directions
      const perp1 = { x: -bulletDirection.y, y: bulletDirection.x };
      const perp2 = { x: bulletDirection.y, y: -bulletDirection.x };
      
      // Choose the perpendicular direction that leads to a valid tile
      const currentGrid = { gridX: this.tank.gridX, gridY: this.tank.gridY };
      const option1 = {
        gridX: currentGrid.gridX + Math.round(perp1.x * 2),
        gridY: currentGrid.gridY + Math.round(perp1.y * 2)
      };
      const option2 = {
        gridX: currentGrid.gridX + Math.round(perp2.x * 2),
        gridY: currentGrid.gridY + Math.round(perp2.y * 2)
      };
      
      let evasionTarget = null;
      if (this.arena.isValidTile(option1.gridX, option1.gridY)) {
        evasionTarget = option1;
      } else if (this.arena.isValidTile(option2.gridX, option2.gridY)) {
        evasionTarget = option2;
      }
      
      if (evasionTarget) {
        this.moveTowardsCardinalOnly(evasionTarget.gridX, evasionTarget.gridY);
      } else {
        // No good evasion spot, move randomly
        this.moveRandomly();
      }
    } else {
      // No specific threat, move away from general danger
      this.moveRandomly();
    }
  }
  
  // Helper method to change state
  changeState(newState) {
    console.log(`Bot ${this.id}: ${this.state} -> ${newState}`);
    this.state = newState;
    this.stateTimer = 0;
    this.lastStateChange = Date.now();
  }
  
  // Schedule next action with reaction delay
  scheduleNextAction() {
    this.nextActionTime = Date.now() + this.getRandomReactionTime();
  }
  
  // Calculate distance between two objects
  getDistance(obj1, obj2) {
    const dx = obj1.x - obj2.x;
    const dy = obj1.y - obj2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  // Check if target's shield is facing this bot
  isShieldFacingBot() {
    if (!this.currentTarget || !this.currentTarget.shield) return false;
    
    const dx = this.tank.x - this.currentTarget.x;
    const dy = this.tank.y - this.currentTarget.y;
    const angleToBot = Math.atan2(dy, dx) * 180 / Math.PI;
    const normalizedAngle = (angleToBot + 360) % 360;
    
    const shieldWidth = config.player.shield.arc_width_deg;
    const shieldStart = (this.currentTarget.heading - shieldWidth / 2 + 360) % 360;
    const shieldEnd = (this.currentTarget.heading + shieldWidth / 2) % 360;
    
    if (shieldStart <= shieldEnd) {
      return normalizedAngle >= shieldStart && normalizedAngle <= shieldEnd;
    } else {
      return normalizedAngle >= shieldStart || normalizedAngle <= shieldEnd;
    }
  }
  
  // Find nearest ammo spawn
  findNearestAmmo() {
    const ammoSpawns = this.arena.getAllAmmoSpawns();
    if (ammoSpawns.length === 0) return null;
    
    let nearest = null;
    let minDistance = Infinity;
    
    for (const ammo of ammoSpawns) {
      const distance = this.getDistance(this.tank, ammo);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = ammo;
      }
    }
    
    return nearest;
  }
  
  // Move towards target grid position
  moveTowards(targetGridX, targetGridY) {
    // Use pathfinding by default now
    this.moveTowardsWithPathfinding(targetGridX, targetGridY);
  }
  
  // Face a specific direction
  faceDirection(targetHeading) {
    const currentHeading = this.tank.heading;
    let angleDiff = targetHeading - currentHeading;
    
    // Normalize angle difference
    while (angleDiff > 180) angleDiff -= 360;
    while (angleDiff < -180) angleDiff += 360;
    
    // Rotate towards target
    if (Math.abs(angleDiff) > 45) {
      if (angleDiff > 0) {
        this.tank.tryRotate('right');
      } else {
        this.tank.tryRotate('left');
      }
    }
  }
  
  // Rotate towards specific heading
  rotateTowards(targetHeading) {
    const currentHeading = this.tank.heading;
    let angleDiff = targetHeading - currentHeading;
    
    // Normalize angle difference
    while (angleDiff > 180) angleDiff -= 360;
    while (angleDiff < -180) angleDiff += 360;
    
    // Only rotate if significant difference
    if (Math.abs(angleDiff) > 10) {
      if (angleDiff > 0) {
        this.tank.tryRotate('right');
      } else {
        this.tank.tryRotate('left');
      }
      
      // Track rotation time to prevent immediate shooting
      this.lastRotationTime = Date.now();
      console.log(`Bot ${this.id}: Rotated, waiting ${this.rotationCooldownMs}ms before shooting`);
    }
  }
  
  // Calculate shot parameters - FIXED for grid-based shooting
  calculateShot(target) {
    // Check if we're aligned with target for cardinal-direction shooting
    const alignmentCheck = this.checkAlignmentWithTarget(target);
    
    if (!alignmentCheck.isAligned) {
      // Not aligned - need to move to get a shot
      return {
        shouldRotate: false,
        targetHeading: this.tank.heading,
        shouldShoot: false,
        shouldReposition: true,
        repositionTarget: alignmentCheck.suggestedPosition,
        shouldFlank: this.isShieldFacingBot()
      };
    }
    
    // We're aligned! Determine which cardinal direction to face
    const requiredDirection = this.getRequiredCardinalDirection(target);
    const currentDirection = this.getCurrentCardinalDirection();
    
    // Check if target's shield would block our shot
    const wouldHitShield = this.wouldShotHitShield(target, requiredDirection);
    
    if (wouldHitShield) {
      return {
        shouldRotate: false,
        targetHeading: this.tank.heading,
        shouldShoot: false,
        shouldReposition: false,
        shouldFlank: true
      };
    }
    
    return {
      shouldRotate: currentDirection !== requiredDirection,
      targetHeading: this.cardinalDirectionToHeading(requiredDirection),
      shouldShoot: currentDirection === requiredDirection && this.tank.ammo > 0,
      shouldReposition: false,
      shouldFlank: false
    };
  }

  // NEW: Check if bot is aligned with target for cardinal shooting
  checkAlignmentWithTarget(target) {
    const botGrid = { x: this.tank.gridX, y: this.tank.gridY };
    const targetGrid = { x: target.gridX, y: target.gridY };
    
    // Check if we're in same row or column
    const sameRow = botGrid.y === targetGrid.y;
    const sameColumn = botGrid.x === targetGrid.x;
    
    if (sameRow || sameColumn) {
      return { isAligned: true, suggestedPosition: null };
    }
    
    // Not aligned - suggest tactical positions
    const tacticalPositions = this.findTacticalPositions(target);
    
    return {
      isAligned: false,
      suggestedPosition: tacticalPositions.length > 0 ? tacticalPositions[0] : null
    };
  }

  // NEW: Find tactical positions to shoot at target
  findTacticalPositions(target) {
    const positions = [];
    const targetGrid = { x: target.gridX, y: target.gridY };
    const visionRange = config.bots.ai.vision_range_tiles;
    
    // Try positions in same row (East/West shooting)
    for (let offsetX = -visionRange; offsetX <= visionRange; offsetX++) {
      if (offsetX === 0) continue; // Skip target's position
      
      const candidateX = targetGrid.x + offsetX;
      const candidateY = targetGrid.y;
      
      if (this.arena.isValidTile(candidateX, candidateY)) {
        const distance = Math.abs(offsetX);
        positions.push({
          gridX: candidateX,
          gridY: candidateY,
          distance: distance,
          shootDirection: offsetX > 0 ? 'west' : 'east' // Shooting toward target
        });
      }
    }
    
    // Try positions in same column (North/South shooting)
    for (let offsetY = -visionRange; offsetY <= visionRange; offsetY++) {
      if (offsetY === 0) continue; // Skip target's position
      
      const candidateX = targetGrid.x;
      const candidateY = targetGrid.y + offsetY;
      
      if (this.arena.isValidTile(candidateX, candidateY)) {
        const distance = Math.abs(offsetY);
        positions.push({
          gridX: candidateX,
          gridY: candidateY,
          distance: distance,
          shootDirection: offsetY > 0 ? 'north' : 'south' // Shooting toward target
        });
      }
    }
    
    // Sort by distance (closer positions preferred)
    positions.sort((a, b) => a.distance - b.distance);
    
    return positions;
  }

  // NEW: Get required cardinal direction to face target
  getRequiredCardinalDirection(target) {
    const botGrid = { x: this.tank.gridX, y: this.tank.gridY };
    const targetGrid = { x: target.gridX, y: target.gridY };
    
    if (botGrid.y === targetGrid.y) {
      // Same row - shoot East or West
      return targetGrid.x > botGrid.x ? 'east' : 'west';
    } else if (botGrid.x === targetGrid.x) {
      // Same column - shoot North or South
      return targetGrid.y > botGrid.y ? 'south' : 'north';
    }
    
    return null; // Should not happen if properly aligned
  }

  // NEW: Get current cardinal direction bot is facing
  getCurrentCardinalDirection() {
    const heading = this.tank.heading;
    
    // Normalize heading to 0-360
    const normalizedHeading = ((heading % 360) + 360) % 360;
    
    // Map to cardinal directions
    if (normalizedHeading >= 315 || normalizedHeading < 45) return 'east';
    if (normalizedHeading >= 45 && normalizedHeading < 135) return 'south';
    if (normalizedHeading >= 135 && normalizedHeading < 225) return 'west';
    if (normalizedHeading >= 225 && normalizedHeading < 315) return 'north';
    
    return 'east'; // Default fallback
  }

  // NEW: Convert cardinal direction to heading degrees
  cardinalDirectionToHeading(direction) {
    const directions = {
      'north': -90,  // or 270
      'east': 0,
      'south': 90,
      'west': 180
    };
    
    return directions[direction] || 0;
  }

  // NEW: Check if shot would hit target's shield
  wouldShotHitShield(target, shootDirection) {
    if (!target.shield) return false;
    
    // Get target's facing direction
    const targetFacing = this.getCurrentCardinalDirectionForTank(target);
    
    // Check if target's shield arc would block shot from our direction
    const oppositeDirection = {
      'north': 'south',
      'south': 'north',
      'east': 'west',
      'west': 'east'
    };
    
    const shotFromDirection = oppositeDirection[shootDirection];
    
    // Simple shield logic: shield blocks shots from front 150° arc
    // For grid-based shooting, approximate as blocking front and side directions
    const shieldDirections = [targetFacing];
    
    return shieldDirections.includes(shotFromDirection);
  }

  // NEW: Get cardinal direction for any tank
  getCurrentCardinalDirectionForTank(tank) {
    const heading = tank.heading;
    const normalizedHeading = ((heading % 360) + 360) % 360;
    
    if (normalizedHeading >= 315 || normalizedHeading < 45) return 'east';
    if (normalizedHeading >= 45 && normalizedHeading < 135) return 'south';
    if (normalizedHeading >= 135 && normalizedHeading < 225) return 'west';
    if (normalizedHeading >= 225 && normalizedHeading < 315) return 'north';
    
    return 'east';
  }
  
  // Calculate position for flanking maneuver
  calculateFlankPosition(target) {
    // Simple flanking: try to get to the side or behind target
    const offsets = [
      { gridX: 2, gridY: 0 },   // Right side
      { gridX: -2, gridY: 0 },  // Left side
      { gridX: 0, gridY: 2 },   // Behind (relative)
      { gridX: 0, gridY: -2 }   // Front (relative)
    ];
    
    for (const offset of offsets) {
      const testX = target.gridX + offset.gridX;
      const testY = target.gridY + offset.gridY;
      
      if (this.arena.isValidTile(testX, testY)) {
        return { gridX: testX, gridY: testY };
      }
    }
    
    return null;
  }
  
  // NEW: Check if bot is facing a cardinal direction (required for shooting)
  isFacingCardinalDirection() {
    const heading = this.tank.heading;
    const normalizedHeading = ((heading % 360) + 360) % 360;
    
    // Check if within 15 degrees of a cardinal direction
    const cardinalAngles = [0, 90, 180, 270, 360];
    const tolerance = 15;
    
    for (const cardinal of cardinalAngles) {
      const diff = Math.abs(normalizedHeading - cardinal);
      if (diff <= tolerance || diff >= (360 - tolerance)) {
        return true;
      }
    }
    
    return false;
  }

  // Check if bot can shoot (cooldown management)
  canShoot() {
    const now = Date.now();
    const shootCooldownReady = now - this.lastShotTime >= config.combat.shoot_cooldown_ms;
    const rotationCooldownReady = now - this.lastRotationTime >= this.rotationCooldownMs;
    const facingCardinal = this.isFacingCardinalDirection();
    
    return shootCooldownReady && rotationCooldownReady && facingCardinal;
  }
  
  // NEW: Cardinal-only movement - more human-like
  moveTowardsWithPathfinding(targetGridX, targetGridY, options = {}) {
    // Use simple cardinal movement instead of complex pathfinding
    this.moveTowardsCardinalOnly(targetGridX, targetGridY, options);
  }
  
  // NEW: Simple cardinal-only movement like human players
  moveTowardsCardinalOnly(targetGridX, targetGridY, options = {}) {
    const currentGrid = { gridX: this.tank.gridX, gridY: this.tank.gridY };
    
    // Calculate cardinal distances
    const deltaX = targetGridX - currentGrid.gridX;
    const deltaY = targetGridY - currentGrid.gridY;
    
    // Add movement "commitment" - stick to current direction briefly
    if (this.movementCommitment && this.movementCommitment > 0) {
      this.movementCommitment--;
      this.continueCurrentMovement();
      return;
    }
    
    // Update pathfinding less frequently for smoother movement
    const shouldReplan = 
      this.pathUpdateCounter >= (config.bots.movement.path_replan_interval * 3) || // 3x slower replanning
      !this.pathTarget ||
      this.pathTarget.gridX !== targetGridX ||
      this.pathTarget.gridY !== targetGridY;
    
    if (shouldReplan) {
      this.pathTarget = { gridX: targetGridX, gridY: targetGridY };
      this.pathUpdateCounter = 0;
      
      // Choose cardinal direction based on largest distance
      let chosenDirection = null;
      
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Move horizontally first
        chosenDirection = deltaX > 0 ? 'east' : 'west';
      } else if (Math.abs(deltaY) > 0) {
        // Move vertically
        chosenDirection = deltaY > 0 ? 'south' : 'north';
      }
      
      if (chosenDirection) {
        this.executeCardinalMovement(chosenDirection);
        // Add movement commitment to prevent jittery direction changes
        this.movementCommitment = 3 + Math.floor(Math.random() * 3); // 3-5 frames
      }
    }
  }
  
  // NEW: Execute cardinal movement like human players
  executeCardinalMovement(direction) {
    const targetHeading = this.cardinalDirectionToHeading(direction);
    const currentDirection = this.getCurrentCardinalDirection();
    
    // Add human-like hesitation before direction changes
    if (currentDirection !== direction && Math.random() < 0.15) {
      // Brief hesitation before changing direction
      return;
    }
    
    // Rotate to face the direction if needed
    if (currentDirection !== direction) {
      this.rotateTowards(targetHeading);
      return;
    }
    
    // Try to move forward
    const moved = this.tank.tryMove('forward');
    
    // If we couldn't move, handle stuck situation
    if (!moved) {
      this.stuckCounter++;
      if (this.stuckCounter > config.bots.movement.stuck_threshold_frames / 3) {
        // Try alternate direction or random movement
        this.handleStuckMovement();
        this.stuckCounter = 0;
      }
    } else {
      this.stuckCounter = 0;
    }
  }
  
  // NEW: Continue current movement direction (for commitment)
  continueCurrentMovement() {
    // Just try to move forward in current direction
    const moved = this.tank.tryMove('forward');
    
    if (!moved) {
      // If we can't move, break commitment
      this.movementCommitment = 0;
    }
  }
  
  // NEW: Handle stuck movement with human-like behavior
  handleStuckMovement() {
    // Try alternate directions like a human would
    const alternatives = ['left', 'right'];
    const randomTurn = alternatives[Math.floor(Math.random() * alternatives.length)];
    
    this.tank.tryRotate(randomTurn);
    
    // Clear movement commitment when stuck
    this.movementCommitment = 0;
  }
  
  // NEW: Get positions of all enemy tanks for pathfinding avoidance
  getEnemyPositions() {
    const enemies = [];
    for (const tank of Object.values(this.lastSeenTargets)) {
      if (tank.position) {
        enemies.push({
          gridX: tank.position.gridX,
          gridY: tank.position.gridY
        });
      }
    }
    return enemies;
  }

  // NEW: Detect incoming bullets that pose a threat
  detectIncomingBullet(bullets) {
    const threatRadius = config.bots.ai.vision_range_tiles * config.arena.tile_size * 0.5;
    
    for (const bullet of bullets) {
      // Skip our own bullets
      if (bullet.ownerId === this.id) continue;
      
      const distance = this.getDistance(this.tank, bullet);
      
      // Only consider bullets within threat radius
      if (distance > threatRadius) continue;
      
      // Calculate if bullet is heading towards us
      const bulletToBot = {
        x: this.tank.x - bullet.x,
        y: this.tank.y - bullet.y
      };
      
      const bulletDirection = {
        x: Math.cos(bullet.heading * Math.PI / 180),
        y: Math.sin(bullet.heading * Math.PI / 180)
      };
      
      // Dot product to check if bullet is heading our way
      const dotProduct = bulletToBot.x * bulletDirection.x + bulletToBot.y * bulletDirection.y;
      
      // If bullet is heading towards us and close enough, it's a threat
      if (dotProduct > 0 && distance < threatRadius * 0.8) {
        return bullet;
      }
    }
    
    return null;
  }
}

module.exports = ServerBot; 