const configLoader = require('../shared/ConfigLoader');

const config = configLoader.getAll();

// Priority queue implementation for A* algorithm
class PriorityQueue {
  constructor() {
    this.items = [];
  }
  
  enqueue(element, priority) {
    const queueElement = { element, priority };
    let added = false;
    
    for (let i = 0; i < this.items.length; i++) {
      if (queueElement.priority < this.items[i].priority) {
        this.items.splice(i, 0, queueElement);
        added = true;
        break;
      }
    }
    
    if (!added) {
      this.items.push(queueElement);
    }
  }
  
  dequeue() {
    return this.items.shift()?.element;
  }
  
  isEmpty() {
    return this.items.length === 0;
  }
}

// Node for A* pathfinding
class PathNode {
  constructor(gridX, gridY, parent = null) {
    this.gridX = gridX;
    this.gridY = gridY;
    this.parent = parent;
    this.gCost = 0; // Distance from start
    this.hCost = 0; // Heuristic distance to goal
    this.fCost = 0; // Total cost (g + h)
  }
  
  get key() {
    return `${this.gridX},${this.gridY}`;
  }
  
  equals(other) {
    return this.gridX === other.gridX && this.gridY === other.gridY;
  }
}

class BotPathfinder {
  constructor(arena) {
    this.arena = arena;
    this.pathCache = new Map(); // Cache recent paths for performance
    this.maxPathLength = 20;    // Limit search depth to prevent lag
    this.cacheTimeout = 5000;   // 5 second cache timeout
    
    // Movement directions (4-directional movement)
    this.directions = [
      { dx: 0, dy: -1 }, // North
      { dx: 1, dy: 0 },  // East  
      { dx: 0, dy: 1 },  // South
      { dx: -1, dy: 0 }  // West
    ];
  }
  
  // Find path from start to target using A* algorithm
  findPath(startGrid, targetGrid, options = {}) {
    const {
      avoidEnemies = false,
      enemyPositions = [],
      maxSearchNodes = 500,
      allowPartialPath = true
    } = options;
    
    // Check cache first
    const cacheKey = `${startGrid.gridX},${startGrid.gridY}->${targetGrid.gridX},${targetGrid.gridY}`;
    const cachedPath = this.getCachedPath(cacheKey);
    if (cachedPath) {
      return cachedPath;
    }
    
    // Validate start and target positions
    if (!this.arena.isValidTile(startGrid.gridX, startGrid.gridY) ||
        !this.arena.isValidTile(targetGrid.gridX, targetGrid.gridY)) {
      return [];
    }
    
    // If already at target, return empty path
    if (startGrid.gridX === targetGrid.gridX && startGrid.gridY === targetGrid.gridY) {
      return [];
    }
    
    const openSet = new PriorityQueue();
    const closedSet = new Set();
    const openSetMap = new Map();
    
    const startNode = new PathNode(startGrid.gridX, startGrid.gridY);
    startNode.gCost = 0;
    startNode.hCost = this.calculateHeuristic(startNode, targetGrid);
    startNode.fCost = startNode.gCost + startNode.hCost;
    
    openSet.enqueue(startNode, startNode.fCost);
    openSetMap.set(startNode.key, startNode);
    
    let searchedNodes = 0;
    let bestNode = startNode; // Track closest node for partial paths
    
    while (!openSet.isEmpty() && searchedNodes < maxSearchNodes) {
      const currentNode = openSet.dequeue();
      openSetMap.delete(currentNode.key);
      closedSet.add(currentNode.key);
      searchedNodes++;
      
      // Update best node (closest to target)
      if (currentNode.hCost < bestNode.hCost) {
        bestNode = currentNode;
      }
      
      // Check if we reached the target
      if (currentNode.gridX === targetGrid.gridX && currentNode.gridY === targetGrid.gridY) {
        const path = this.reconstructPath(currentNode);
        this.cachePath(cacheKey, path);
        return path;
      }
      
      // Explore neighbors
      for (const direction of this.directions) {
        const neighborX = currentNode.gridX + direction.dx;
        const neighborY = currentNode.gridY + direction.dy;
        const neighborKey = `${neighborX},${neighborY}`;
        
        // Skip if already processed
        if (closedSet.has(neighborKey)) {
          continue;
        }
        
        // Skip if not a valid tile
        if (!this.arena.isValidTile(neighborX, neighborY)) {
          continue;
        }
        
        // Skip if avoiding enemies and this position has an enemy
        if (avoidEnemies && this.hasEnemyAt(neighborX, neighborY, enemyPositions)) {
          continue;
        }
        
        const tentativeGCost = currentNode.gCost + 1;
        const existingNode = openSetMap.get(neighborKey);
        
        if (!existingNode) {
          // New node
          const neighborNode = new PathNode(neighborX, neighborY, currentNode);
          neighborNode.gCost = tentativeGCost;
          neighborNode.hCost = this.calculateHeuristic(neighborNode, targetGrid);
          neighborNode.fCost = neighborNode.gCost + neighborNode.hCost;
          
          openSet.enqueue(neighborNode, neighborNode.fCost);
          openSetMap.set(neighborKey, neighborNode);
        } else if (tentativeGCost < existingNode.gCost) {
          // Better path to existing node
          existingNode.parent = currentNode;
          existingNode.gCost = tentativeGCost;
          existingNode.fCost = existingNode.gCost + existingNode.hCost;
        }
      }
    }
    
    // No complete path found
    if (allowPartialPath && bestNode !== startNode) {
      // Return partial path to closest node
      const partialPath = this.reconstructPath(bestNode);
      this.cachePath(cacheKey, partialPath);
      return partialPath;
    }
    
    return []; // No path found
  }
  
  // Calculate Euclidean distance heuristic
  calculateHeuristic(node, target) {
    const dx = target.gridX - node.gridX;
    const dy = target.gridY - node.gridY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  // Check if there's an enemy at the given position
  hasEnemyAt(gridX, gridY, enemyPositions) {
    return enemyPositions.some(enemy => 
      enemy.gridX === gridX && enemy.gridY === gridY
    );
  }
  
  // Reconstruct path from goal to start
  reconstructPath(goalNode) {
    const path = [];
    let currentNode = goalNode;
    
    while (currentNode.parent) {
      path.unshift({
        gridX: currentNode.gridX,
        gridY: currentNode.gridY
      });
      currentNode = currentNode.parent;
    }
    
    // Limit path length to prevent overwhelming bots
    return path.slice(0, this.maxPathLength);
  }
  
  // Cache a path for future use
  cachePath(cacheKey, path) {
    this.pathCache.set(cacheKey, {
      path: [...path], // Copy the path
      timestamp: Date.now()
    });
    
    // Clean up old cache entries
    this.cleanCache();
  }
  
  // Get cached path if still valid
  getCachedPath(cacheKey) {
    const cached = this.pathCache.get(cacheKey);
    if (!cached) return null;
    
    // Check if cache is still valid
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.pathCache.delete(cacheKey);
      return null;
    }
    
    return [...cached.path]; // Return copy of cached path
  }
  
  // Clean up expired cache entries
  cleanCache() {
    const now = Date.now();
    for (const [key, cached] of this.pathCache) {
      if (now - cached.timestamp > this.cacheTimeout) {
        this.pathCache.delete(key);
      }
    }
  }
  
  // Find path to nearest ammo spawn
  findPathToNearestAmmo(startGrid) {
    const ammoSpawns = this.arena.getAllAmmoSpawns();
    if (ammoSpawns.length === 0) return [];
    
    let bestPath = [];
    let shortestDistance = Infinity;
    
    for (const ammo of ammoSpawns) {
      const distance = this.calculateHeuristic(
        { gridX: startGrid.gridX, gridY: startGrid.gridY },
        { gridX: ammo.gridX, gridY: ammo.gridY }
      );
      
      // Only try pathfinding to nearby ammo to save computation
      if (distance < shortestDistance && distance <= 10) {
        const path = this.findPath(startGrid, ammo, { maxSearchNodes: 200 });
        if (path.length > 0 && path.length < shortestDistance) {
          bestPath = path;
          shortestDistance = path.length;
        }
      }
    }
    
    return bestPath;
  }
  
  // Find flanking position around a target
  findFlankingPath(startGrid, targetGrid, enemyPositions = []) {
    // Try to find a path to positions around the target
    const flankingPositions = [
      { gridX: targetGrid.gridX + 2, gridY: targetGrid.gridY },     // Right
      { gridX: targetGrid.gridX - 2, gridY: targetGrid.gridY },     // Left
      { gridX: targetGrid.gridX, gridY: targetGrid.gridY + 2 },     // Below
      { gridX: targetGrid.gridX, gridY: targetGrid.gridY - 2 },     // Above
      { gridX: targetGrid.gridX + 1, gridY: targetGrid.gridY + 1 }, // Diagonal
      { gridX: targetGrid.gridX - 1, gridY: targetGrid.gridY + 1 }, // Diagonal
      { gridX: targetGrid.gridX + 1, gridY: targetGrid.gridY - 1 }, // Diagonal
      { gridX: targetGrid.gridX - 1, gridY: targetGrid.gridY - 1 }  // Diagonal
    ];
    
    for (const flankPos of flankingPositions) {
      if (this.arena.isValidTile(flankPos.gridX, flankPos.gridY)) {
        const path = this.findPath(startGrid, flankPos, {
          avoidEnemies: true,
          enemyPositions,
          maxSearchNodes: 300
        });
        
        if (path.length > 0) {
          return path;
        }
      }
    }
    
    return []; // No flanking path found
  }
  
  // Get next move direction from path
  getNextMoveDirection(currentGrid, path) {
    if (path.length === 0) return null;
    
    const nextStep = path[0];
    const dx = nextStep.gridX - currentGrid.gridX;
    const dy = nextStep.gridY - currentGrid.gridY;
    
    // Convert grid direction to heading
    if (dx === 1) return 0;    // East
    if (dx === -1) return 180; // West
    if (dy === 1) return 90;   // South
    if (dy === -1) return -90; // North
    
    return null; // Invalid direction
  }
  
  // Check if we've reached the next step in path
  hasReachedNextStep(currentGrid, path) {
    if (path.length === 0) return true;
    
    const nextStep = path[0];
    return currentGrid.gridX === nextStep.gridX && 
           currentGrid.gridY === nextStep.gridY;
  }
  
  // Remove completed steps from path
  updatePath(currentGrid, path) {
    while (path.length > 0 && this.hasReachedNextStep(currentGrid, path)) {
      path.shift(); // Remove completed step
    }
    return path;
  }
  
  // Clear all cached paths (useful when arena changes)
  clearCache() {
    this.pathCache.clear();
  }
  
  // Get cache statistics for debugging
  getCacheStats() {
    return {
      entries: this.pathCache.size,
      oldestEntry: Math.min(...Array.from(this.pathCache.values()).map(c => c.timestamp)),
      newestEntry: Math.max(...Array.from(this.pathCache.values()).map(c => c.timestamp))
    };
  }
}

module.exports = BotPathfinder; 