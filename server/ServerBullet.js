const yaml = require('js-yaml');
const fs = require('fs');

const configPath = './spec/blueprint-battle.yaml';
const config = yaml.load(fs.readFileSync(configPath, 'utf8'));

class ServerBullet {
  constructor(id, ownerTank, arena) {
    this.id = id;
    this.ownerId = ownerTank.id;
    this.arena = arena;
    
    // Start bullet at tank position
    this.x = ownerTank.x;
    this.y = ownerTank.y;
    
    // Calculate velocity based on tank heading (convert degrees to radians)
    const headingRad = ownerTank.heading * Math.PI / 180;
    const speed = config.bullet.initial_speed;
    this.vx = Math.cos(headingRad) * speed;
    this.vy = Math.sin(headingRad) * speed;
    
    // Bullet properties
    this.radius = config.bullet.radius;
    this.life = config.bullet.life_frames;
    this.drag = config.bullet.drag;
    this.active = true;
    
    // Track reflections to prevent infinite bouncing
    this.reflectionCount = 0;
    this.maxReflections = config.combat.max_reflections;
  }

  // Update bullet position and physics
  update() {
    if (!this.active) return;
    
    // Update position
    this.x += this.vx;
    this.y += this.vy;
    
    // Apply drag
    this.vx *= this.drag;
    this.vy *= this.drag;
    
    // Update lifetime
    this.life--;
    
    // Check if bullet should be removed
    if (this.life <= 0 || this.isOutOfBounds()) {
      this.active = false;
      return;
    }
    
    // Check for collisions with arena boundaries
    this.checkArenaBoundaries();
  }

  // Check if bullet is outside the arena
  isOutOfBounds() {
    const worldSize = config.arena.world_size;
    return this.x < 0 || this.x >= worldSize || this.y < 0 || this.y >= worldSize;
  }

  // Check collision with arena boundaries and tiles
  checkArenaBoundaries() {
    const worldSize = config.arena.world_size;
    const tileSize = config.arena.tile_size;
    
    // Check world boundaries
    if (this.x <= 0 || this.x >= worldSize || this.y <= 0 || this.y >= worldSize) {
      this.active = false;
      return;
    }
    
    // Skip tile walkability check so bullets can travel through empty space
  }

  // Check collision with a tank
  checkTankCollision(tank) {
    if (!this.active || !tank.alive || tank.id === this.ownerId) {
      return false;
    }
    
    // Calculate distance to tank
    const dx = this.x - tank.x;
    const dy = this.y - tank.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Check if bullet is close enough to hit
    const hitDistance = this.radius + config.arena.tile_size / config.combat.tank_hit_radius_divisor; // Tank hit radius
    
    if (distance <= hitDistance) {
      // Check if tank is protected by shield
      if (tank.isProtectedByShield(this.x, this.y)) {
        // Bullet hits shield - reflect it
        this.reflectOffShield(tank);
        return false;
      } else {
        // Bullet hits tank - tank is eliminated
        this.active = false;
        return true;
      }
    }
    
    return false;
  }

  // Reflect bullet off tank shield
  reflectOffShield(tank) {
    if (this.reflectionCount >= this.maxReflections) {
      this.active = false;
      return;
    }
    
    // Calculate reflection angle
    const dx = this.x - tank.x;
    const dy = this.y - tank.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
      // Normalize the vector from tank to bullet
      const nx = dx / distance;
      const ny = dy / distance;
      
      // Reflect velocity vector
      const dotProduct = this.vx * nx + this.vy * ny;
      this.vx = this.vx - 2 * dotProduct * nx;
      this.vy = this.vy - 2 * dotProduct * ny;
      
      // Add some randomness to prevent perfect back-and-forth
      const randomAngle = (Math.random() - 0.5) * config.combat.reflection_randomness;
      const cos = Math.cos(randomAngle);
      const sin = Math.sin(randomAngle);
      const newVx = this.vx * cos - this.vy * sin;
      const newVy = this.vx * sin + this.vy * cos;
      this.vx = newVx;
      this.vy = newVy;
      
      // Move bullet slightly away from shield to prevent stuck bullets
      const pushDistance = config.combat.push_distance;
      this.x += nx * pushDistance;
      this.y += ny * pushDistance;
      
      this.reflectionCount++;
    }
  }

  // Check collision with multiple tanks
  checkAllTankCollisions(tanks) {
    for (const tank of tanks.values()) {
      if (this.checkTankCollision(tank)) {
        return tank;
      }
    }
    
    return null;
  }

  // Get current state for networking
  getState() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      ownerId: this.ownerId,
      radius: this.radius,
      active: this.active,
      life: this.life
    };
  }

  // Check if bullet should be removed
  shouldRemove() {
    return !this.active || this.life <= 0;
  }
}

module.exports = ServerBullet;