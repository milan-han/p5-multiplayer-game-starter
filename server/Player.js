const configLoader = require('../shared/ConfigLoader');

const config = configLoader.getAll();

class Player {
  constructor(id) {
    this.id = id;
    
    // Initialize at random valid grid position
    const pos = this.getRandomValidPosition();
    this.x = pos.x;
    this.y = pos.y;
    
    // Tank orientation and movement
    this.heading = config.player.initial_heading; // 0=North, 90=East, 180=South, 270=West
    this.targetX = null;
    this.targetY = null;
    this.targetHeading = null;
    
    // Combat and game state
    this.shield = true;
    this.speedMode = false;
    this.ammo = config.player.initial_ammo;
    this.killStreak = 0;
    this.alive = true;
    this.respawnTime = 0;
    this.lastMoveTime = 0;
    
    // Visual properties
    this.rgb = {
      r: Math.random() * 255,
      g: Math.random() * 255,
      b: Math.random() * 255,
    }
  }

  getRandomValidPosition() {
    const tileSize = config.arena.tile_size;
    const worldSize = config.arena.world_size;
    const tilesPerSide = Math.floor(worldSize / tileSize);
    
    // Generate random grid position
    const gridX = Math.floor(Math.random() * tilesPerSide);
    const gridY = Math.floor(Math.random() * tilesPerSide);
    
    // Convert to world coordinates (center of tile)
    const x = gridX * tileSize + tileSize / 2;
    const y = gridY * tileSize + tileSize / 2;
    
    return { x, y };
  }

  // Update position interpolation
  updatePosition() {
    if (this.targetX !== null && this.targetY !== null) {
      const interpFactor = config.player.position_interp;
      this.x += (this.targetX - this.x) * interpFactor;
      this.y += (this.targetY - this.y) * interpFactor;
      
      // Snap to target if close enough
      if (Math.abs(this.x - this.targetX) < 1) {
        this.x = this.targetX;
        this.targetX = null;
      }
      if (Math.abs(this.y - this.targetY) < 1) {
        this.y = this.targetY;
        this.targetY = null;
      }
    }
  }

  // Update heading interpolation
  updateHeading() {
    if (this.targetHeading !== null) {
      const interpFactor = config.player.heading_interp;
      let headingDiff = this.targetHeading - this.heading;
      
      // Handle wrap-around
      if (headingDiff > 180) headingDiff -= 360;
      if (headingDiff < -180) headingDiff += 360;
      
      this.heading += headingDiff * interpFactor;
      
      // Snap to target if close enough
      if (Math.abs(headingDiff) < 1) {
        this.heading = this.targetHeading;
        this.targetHeading = null;
      }
    }
  }

  // Check if player can move to new position
  canMoveTo(newX, newY) {
    const worldSize = config.arena.world_size;
    return newX >= 0 && newX < worldSize && newY >= 0 && newY < worldSize;
  }

  // Reset player state for respawn
  respawn() {
    const pos = this.getRandomValidPosition();
    this.x = pos.x;
    this.y = pos.y;
    this.targetX = null;
    this.targetY = null;
    this.heading = config.player.initial_heading;
    this.targetHeading = null;
    this.alive = true;
    this.shield = true;
    this.speedMode = false;
    this.ammo = config.player.initial_ammo;
    this.killStreak = 0;
  }
}

module.exports = Player;