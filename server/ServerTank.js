const yaml = require('js-yaml');
const fs = require('fs');

const configPath = './spec/blueprint-battle.yaml';
const config = yaml.load(fs.readFileSync(configPath, 'utf8'));

class ServerTank {
  constructor(id, arena) {
    this.id = id;
    this.arena = arena;
    
    // Player info
    this.name = null; // Will be set when player joins with name
    
    // Grid-based positioning - start at center
    this.gridX = 0;
    this.gridY = 0;
    
    // World position (center of tile)
    const worldPos = this.arena.gridToWorld(this.gridX, this.gridY);
    this.x = worldPos.x;
    this.y = worldPos.y;
    
    // Movement targets for interpolation
    this.targetX = this.x;
    this.targetY = this.y;
    
    // Tank orientation (matches prototype: -90=North, 0=East, 90=South, 180=West)
    this.heading = config.player.initial_heading;
    this.targetHeading = config.player.initial_heading;
    
    // Combat state
    this.ammo = config.player.initial_ammo;
    this.maxAmmo = config.player.max_ammo;
    this.shield = true;
    this.speedMode = false;
    this.lastMoveTime = 0;
    this.speedModeCooldown = config.player.speed_mode_cooldown;
    
    // Game state
    this.alive = true;
    this.killStreak = 0;
    this.respawnTime = 0;
    this.lastShotTime = 0;
    
    // Visual properties
    this.rgb = {
      r: Math.random() * 255,
      g: Math.random() * 255,
      b: Math.random() * 255,
    };
  }

  // Validate and attempt movement in a direction
  tryMove(direction) {
    if (!this.alive) return false;
    
    const now = Date.now();
    const moveDelay = this.speedMode ?
      config.player.move_cooldown_speed_mode * 16 : // Convert frames to ms
      config.player.move_cooldown_normal_ms; // Normal movement delay from config
    
    if (now - this.lastMoveTime < moveDelay) return false;
    
    // Convert heading from degrees to radians for mathematical calculation
    // Tank heading: -90=North, 0=East, 90=South, 180=West
    // Math coordinates: 0=East, 90=North, so we need to adjust
    const headingRad = (this.heading * Math.PI) / 180;
    
    // Calculate movement direction using adjusted coordinates
    // Using standard Cartesian: cos → x, sin → y (y+ down)
    const dx = Math.round(Math.cos(headingRad));
    const dy = Math.round(Math.sin(headingRad));
    
    let newGridX = this.gridX;
    let newGridY = this.gridY;
    
    // Apply movement based on direction
    switch (direction) {
      case 'forward':
      case 'up':
        newGridX += dx;
        newGridY += dy;
        break;
      case 'backward':
      case 'down':
        newGridX -= dx;
        newGridY -= dy;
        break;
      default:
        return false;
    }
    
    // Validate the new position
    if (this.arena.isValidTile(newGridX, newGridY)) {
      this.gridX = newGridX;
      this.gridY = newGridY;
      const worldPos = this.arena.gridToWorld(this.gridX, this.gridY);
      this.targetX = worldPos.x;
      this.targetY = worldPos.y;
      this.lastMoveTime = now;
      return true;
    }
    
    return false;
  }

  // Rotate tank by 90 degrees
  tryRotate(direction) {
    if (!this.alive) return false;
    
    const rotationStep = config.player.rotation_step_deg;
    
    if (direction === 'left') {
      this.targetHeading = (this.targetHeading - rotationStep + 360) % 360;
    } else if (direction === 'right') {
      this.targetHeading = (this.targetHeading + rotationStep) % 360;
    }
    
    return true;
  }

  // Attempt to shoot if tank has ammo
  tryShoot() {
    if (!this.alive || this.ammo <= 0) return false;
    
    const now = Date.now();
    const shootDelay = config.combat.shoot_cooldown_ms; // Minimum delay between shots
    
    if (now - this.lastShotTime < shootDelay) return false;
    
    this.ammo--;
    this.lastShotTime = now;
    return true;
  }

  // Toggle speed mode
  setSpeedMode(enabled) {
    if (!this.alive) return;
    
    this.speedMode = enabled;
    this.shield = !enabled; // Shield disabled in speed mode
  }

  // Pick up ammo from current tile
  tryPickupAmmo() {
    if (!this.alive || this.ammo >= this.maxAmmo) return false;
    
    if (this.arena.hasAmmo(this.gridX, this.gridY)) {
      this.arena.removeAmmo(this.gridX, this.gridY);
      this.ammo = Math.min(this.ammo + 1, this.maxAmmo);
      return true;
    }
    
    return false;
  }

  // Check if point is within shield arc
  isProtectedByShield(bulletX, bulletY) {
    if (!this.alive || !this.shield) return false;
    
    const dx = bulletX - this.x;
    const dy = bulletY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Shield radius
    const shieldRadius = config.arena.tile_size / 2 + config.player.shield.radius_offset;
    if (distance > shieldRadius) return false;
    
    // Calculate angle from tank to bullet in standard orientation
    const bulletAngle = Math.atan2(dy, dx) * 180 / Math.PI;
    const normalizedBulletAngle = (bulletAngle + 360) % 360;
    
    // Shield arc calculation
    const shieldWidth = config.player.shield.arc_width_deg;
    const shieldStart = (this.heading - shieldWidth / 2 + 360) % 360;
    const shieldEnd = (this.heading + shieldWidth / 2) % 360;
    
    // Check if bullet angle is within shield arc
    if (shieldStart <= shieldEnd) {
      return normalizedBulletAngle >= shieldStart && normalizedBulletAngle <= shieldEnd;
    } else {
      // Handle wrap-around case
      return normalizedBulletAngle >= shieldStart || normalizedBulletAngle <= shieldEnd;
    }
  }

  // Handle tank being hit by bullet
  hit(bullet) {
    if (!this.alive) return false;
    
    // Check if protected by shield
    if (this.isProtectedByShield(bullet.x, bullet.y)) {
      return false; // Bullet blocked by shield
    }
    
    // Tank is hit - kill it
    this.alive = false;
    this.killStreak = 0;
    this.respawnTime = Date.now() + config.combat.respawn_delay_ms; // 3 second respawn delay
    return true;
  }

  // Handle killing another tank
  addKill() {
    if (!this.alive) return;
    this.killStreak++;
  }

  // Set player name
  setName(name) {
    this.name = name;
  }

  // Set player color
  setColor(hexColor) {
    // Convert hex color to RGB
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    
    this.rgb = { r, g, b };
  }

  // Respawn tank at new position
  respawn() {
    const spawnPos = this.arena.getRandomValidPosition();
    const gridPos = this.arena.worldToGrid(spawnPos.x, spawnPos.y);
    this.gridX = gridPos.gridX;
    this.gridY = gridPos.gridY;
    
    this.x = spawnPos.x;
    this.y = spawnPos.y;
    this.targetX = this.x;
    this.targetY = this.y;
    
    this.heading = config.player.initial_heading;
    this.targetHeading = config.player.initial_heading;
    this.alive = true;
    this.shield = true;
    this.speedMode = false;
    this.ammo = config.player.initial_ammo;
  }

  // Update tank state each frame
  update() {
    if (!this.alive) {
      // Check for respawn
      if (Date.now() >= this.respawnTime) {
        this.respawn();
        return { type: 'respawn' }; // Signal respawn to GameManager
      }
      return;
    }
    
    // Update position interpolation
    const positionInterp = config.player.position_interp;
    this.x += (this.targetX - this.x) * positionInterp;
    this.y += (this.targetY - this.y) * positionInterp;
    
    // Update heading interpolation
    const headingInterp = config.player.heading_interp;
    let headingDiff = this.targetHeading - this.heading;
    
    // Handle wrap-around
    if (headingDiff > 180) headingDiff -= 360;
    if (headingDiff < -180) headingDiff += 360;
    
    this.heading += headingDiff * headingInterp;
    
    // Normalize heading
    this.heading = (this.heading + 360) % 360;
    
    // Update speed mode cooldown
    if (this.speedModeCooldown > 0) {
      this.speedModeCooldown--;
    }
  }

  // Get current state for networking
  getState() {
    return {
      id: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      gridX: this.gridX,
      gridY: this.gridY,
      heading: this.heading,
      targetHeading: this.targetHeading, // Add targetHeading for client prediction
      ammo: this.ammo,
      shield: this.shield,
      speedMode: this.speedMode,
      alive: this.alive,
      killStreak: this.killStreak,
      rgb: this.rgb
    };
  }
}

module.exports = ServerTank;