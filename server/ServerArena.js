const configLoader = require('../shared/ConfigLoader');

const config = configLoader.getAll();

class ServerArena {
  constructor() {
    this.worldSize = config.arena.world_size;
    this.tileSize = config.arena.tile_size;
    this.tilesPerSide = Math.floor(this.worldSize / this.tileSize);
    
    // Generate the arena tiles
    this.tiles = new Map(); // Map of "x,y" -> true (tile exists)
    this.ammoSpawns = new Map(); // Map of "x,y" -> true (ammo exists)
    
    this.generateArena();
    this.generateAmmoSpawns();
    
    // Track ammo respawn timers
    this.ammoRespawnTimers = new Map(); // Map of "x,y" -> respawn_time
    this.ammoRespawnDelay = config.arena.ammo_respawn_delay_ms; // 15 seconds
  }

  // Generate the arena tiles with procedural generation
  generateArena() {
    const tileDensity = config.arena.tile_density;
    const maxGridCoord = this.tilesPerSide / 2;
    
    // Generate tiles in a coordinate system centered at (0,0)
    for (let x = -maxGridCoord; x < maxGridCoord; x++) {
      for (let y = -maxGridCoord; y < maxGridCoord; y++) {
        // Generate tile based on density probability
        if (Math.random() < tileDensity) {
          this.tiles.set(`${x},${y}`, true);
        }
      }
    }
    
    // Ensure center tile exists for spawning
    if (!this.tiles.has('0,0')) {
      this.tiles.set('0,0', true);
    }
    
    // Ensure there are always some tiles for spawning
    this.ensureMinimumTiles();
  }

  // Ensure there are enough tiles for players to spawn
  ensureMinimumTiles() {
    const minTiles = config.arena.minimum_tiles; // Minimum number of tiles required
    const currentTiles = this.tiles.size;
    const maxGridCoord = this.tilesPerSide / 2;
    
    if (currentTiles < minTiles) {
      // Add random tiles until we have enough
      while (this.tiles.size < minTiles) {
        const x = Math.floor(Math.random() * this.tilesPerSide) - maxGridCoord;
        const y = Math.floor(Math.random() * this.tilesPerSide) - maxGridCoord;
        this.tiles.set(`${x},${y}`, true);
      }
    }
  }

  // Generate initial ammo spawns
  generateAmmoSpawns() {
    const ammoSpawnProbability = config.arena.ammo_spawn_probability;
    
    for (const [tileKey, exists] of this.tiles) {
      if (exists && Math.random() < ammoSpawnProbability) {
        this.ammoSpawns.set(tileKey, true);
      }
    }
  }

  // Check if a tile exists at grid coordinates
  isValidTile(gridX, gridY) {
    const maxGridCoord = this.tilesPerSide / 2;
    
    // Check bounds
    if (gridX < -maxGridCoord || gridX >= maxGridCoord || gridY < -maxGridCoord || gridY >= maxGridCoord) {
      return false;
    }
    
    // Check if tile exists
    return this.tiles.has(`${gridX},${gridY}`);
  }

  // Check if ammo exists at grid coordinates
  hasAmmo(gridX, gridY) {
    return this.ammoSpawns.has(`${gridX},${gridY}`);
  }

  // Remove ammo from grid coordinates
  removeAmmo(gridX, gridY) {
    const tileKey = `${gridX},${gridY}`;
    if (this.ammoSpawns.has(tileKey)) {
      this.ammoSpawns.delete(tileKey);
      // Set respawn timer
      this.ammoRespawnTimers.set(tileKey, Date.now() + this.ammoRespawnDelay);
      return true;
    }
    return false;
  }

  // Get a random valid position for spawning
  getRandomValidPosition() {
    const validTiles = Array.from(this.tiles.keys());
    
    if (validTiles.length === 0) {
      // Fallback to center if no tiles exist
      return {
        x: this.worldSize / 2,
        y: this.worldSize / 2
      };
    }
    
    const randomTile = validTiles[Math.floor(Math.random() * validTiles.length)];
    const [gridX, gridY] = randomTile.split(',').map(Number);
    
    // Convert grid coordinates to world coordinates (centered system)
    const worldX = (gridX + this.tilesPerSide / 2) * this.tileSize + this.tileSize / 2;
    const worldY = (gridY + this.tilesPerSide / 2) * this.tileSize + this.tileSize / 2;
    
    return {
      x: worldX,
      y: worldY
    };
  }

  // Get all valid tiles as an array
  getAllValidTiles() {
    return Array.from(this.tiles.keys()).map(tileKey => {
      const [gridX, gridY] = tileKey.split(',').map(Number);
      const worldX = (gridX + this.tilesPerSide / 2) * this.tileSize + this.tileSize / 2;
      const worldY = (gridY + this.tilesPerSide / 2) * this.tileSize + this.tileSize / 2;
      return {
        gridX,
        gridY,
        x: worldX,
        y: worldY
      };
    });
  }

  // Get all current ammo spawns
  getAllAmmoSpawns() {
    return Array.from(this.ammoSpawns.keys()).map(tileKey => {
      const [gridX, gridY] = tileKey.split(',').map(Number);
      const worldX = (gridX + this.tilesPerSide / 2) * this.tileSize + this.tileSize / 2;
      const worldY = (gridY + this.tilesPerSide / 2) * this.tileSize + this.tileSize / 2;
      return {
        gridX,
        gridY,
        x: worldX,
        y: worldY
      };
    });
  }

  // Update ammo respawn timers
  update() {
    const now = Date.now();
    
    // Check for ammo respawns
    for (const [tileKey, respawnTime] of this.ammoRespawnTimers) {
      if (now >= respawnTime) {
        // Respawn ammo if tile still exists
        if (this.tiles.has(tileKey)) {
          this.ammoSpawns.set(tileKey, true);
        }
        this.ammoRespawnTimers.delete(tileKey);
      }
    }
  }

  // Check if world coordinates are within bounds
  isWithinBounds(x, y) {
    return x >= 0 && x < this.worldSize && y >= 0 && y < this.worldSize;
  }

  // Convert world coordinates to grid coordinates
  worldToGrid(x, y) {
    const gridX = Math.floor(x / this.tileSize) - this.tilesPerSide / 2;
    const gridY = Math.floor(y / this.tileSize) - this.tilesPerSide / 2;
    return {
      gridX,
      gridY
    };
  }

  // Convert grid coordinates to world coordinates (center of tile)
  gridToWorld(gridX, gridY) {
    const worldX = (gridX + this.tilesPerSide / 2) * this.tileSize + this.tileSize / 2;
    const worldY = (gridY + this.tilesPerSide / 2) * this.tileSize + this.tileSize / 2;
    return {
      x: worldX,
      y: worldY
    };
  }

  // Get neighboring tiles
  getNeighbors(gridX, gridY) {
    const neighbors = [];
    const directions = [
      { dx: 0, dy: -1 }, // up
      { dx: 1, dy: 0 },  // right
      { dx: 0, dy: 1 },  // down
      { dx: -1, dy: 0 }  // left
    ];
    
    for (const { dx, dy } of directions) {
      const newX = gridX + dx;
      const newY = gridY + dy;
      
      if (this.isValidTile(newX, newY)) {
        neighbors.push({ gridX: newX, gridY: newY });
      }
    }
    
    return neighbors;
  }

  // Get arena state for networking
  getState() {
    return {
      tiles: this.getAllValidTiles(),
      ammo: this.getAllAmmoSpawns(),
      worldSize: this.worldSize,
      tileSize: this.tileSize
    };
  }

  // Get arena statistics
  getStats() {
    return {
      totalTiles: this.tiles.size,
      totalAmmo: this.ammoSpawns.size,
      ammoRespawning: this.ammoRespawnTimers.size,
      worldSize: this.worldSize,
      tileSize: this.tileSize,
      tilesPerSide: this.tilesPerSide
    };
  }
}

module.exports = ServerArena;