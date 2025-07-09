// =================================================================================
// CLIENT ARENA RENDERING - Blueprint Battle
// =================================================================================

class ClientArena {
    constructor() {
        this.worldSize = CONFIG.arena.world_size;
        this.tileSize = CONFIG.arena.tile_size;
        this.tileRatio = CONFIG.arena.tile_ratio;
        this.tilesPerSide = Math.floor(this.worldSize / this.tileSize);
        
        // Pre-calculate commonly used values
        this.innerSize = this.tileSize * this.tileRatio;
        this.halfInnerSize = this.innerSize / 2;
        this.maxGridCoord = this.tilesPerSide / 2;
        this.worldHalf = this.worldSize / 2;
    }
    
    draw(ctx, arenaData) {
        if (!arenaData) return;
        
        // Only draw elements that are visible on screen
        const bounds = camera.getBounds();
        const margin = this.tileSize; // Add margin for smooth scrolling
        
        this.drawGridLines(ctx, bounds, margin);
        this.drawTiles(ctx, arenaData.tiles, bounds, margin);
        this.drawAmmo(ctx, arenaData.ammo, bounds, margin);
    }
    
    drawGridLines(ctx, bounds, margin) {
        ctx.strokeStyle = PALETTE.dimStroke;
        ctx.globalAlpha = CONFIG.visual.arena_grid_alpha;
        ctx.lineWidth = CONFIG.visual.arena_grid_line_width;
        
        // Calculate visible grid range
        const startX = Math.floor((bounds.minX - margin) / this.tileSize) * this.tileSize;
        const endX = Math.ceil((bounds.maxX + margin) / this.tileSize) * this.tileSize;
        const startY = Math.floor((bounds.minY - margin) / this.tileSize) * this.tileSize;
        const endY = Math.ceil((bounds.maxY + margin) / this.tileSize) * this.tileSize;
        
        // Draw vertical lines
        for (let x = startX; x <= endX; x += this.tileSize) {
            ctx.beginPath();
            ctx.moveTo(x, bounds.minY - margin);
            ctx.lineTo(x, bounds.maxY + margin);
            ctx.stroke();
        }
        
        // Draw horizontal lines
        for (let y = startY; y <= endY; y += this.tileSize) {
            ctx.beginPath();
            ctx.moveTo(bounds.minX - margin, y);
            ctx.lineTo(bounds.maxX + margin, y);
            ctx.stroke();
        }
        
        ctx.globalAlpha = 1;
    }
    
    drawTiles(ctx, tiles, bounds, margin) {
        if (!tiles) return;
        
        tiles.forEach(tile => {
            // Skip tiles that are not visible
            if (!this.isTileVisible(tile.x, tile.y, bounds, margin)) {
                return;
            }
            
            const x = tile.x;
            const y = tile.y;
            
            // Draw tile outline
            ctx.strokeStyle = 'white';
            ctx.lineWidth = CONFIG.visual.arena_tile_line_width;
            ctx.globalAlpha = CONFIG.visual.arena_tile_alpha;
            ctx.strokeRect(
                x - this.halfInnerSize,
                y - this.halfInnerSize,
                this.innerSize,
                this.innerSize
            );
            
            // Draw tile coordinate label
            ctx.font = '12px Inter';
            ctx.fillStyle = PALETTE.dimStroke;
            ctx.globalAlpha = CONFIG.visual.arena_label_alpha;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Generate coordinate label
            const label = this.generateTileLabel(tile.gridX, tile.gridY);
            ctx.fillText(label, x, y + this.halfInnerSize - 15);
            
            // Draw crosshair
            ctx.strokeStyle = PALETTE.dimStroke;
            ctx.beginPath();
            ctx.moveTo(x - 5, y);
            ctx.lineTo(x + 5, y);
            ctx.moveTo(x, y - 5);
            ctx.lineTo(x, y + 5);
            ctx.stroke();
            
            ctx.globalAlpha = 1;
        });
    }
    
    drawAmmo(ctx, ammoSpawns, bounds, margin) {
        if (!ammoSpawns) return;
        
        ammoSpawns.forEach(ammo => {
            // Skip ammo that is not visible
            if (!this.isTileVisible(ammo.x, ammo.y, bounds, margin)) {
                return;
            }
            
            // Draw ammo pickup circle
            ctx.strokeStyle = PALETTE.glowAccent;
            ctx.lineWidth = CONFIG.visual.arena_ammo_line_width;
            ctx.globalAlpha = 1;
            ctx.setLineDash([4, 4]);
            
            ctx.beginPath();
            ctx.arc(ammo.x, ammo.y, CONFIG.visual.arena_ammo_radius, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.setLineDash([]);
            
            // Add subtle glow effect
            ctx.shadowColor = PALETTE.glowAccent;
            ctx.shadowBlur = CONFIG.visual.arena_ammo_shadow_blur;
            
            ctx.beginPath();
            ctx.arc(ammo.x, ammo.y, CONFIG.visual.arena_ammo_radius, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.shadowBlur = 0;
        });
    }
    
    isTileVisible(x, y, bounds, margin) {
        return x >= bounds.minX - margin &&
               x <= bounds.maxX + margin &&
               y >= bounds.minY - margin &&
               y <= bounds.maxY + margin;
    }
    
    generateTileLabel(gridX, gridY) {
        // Generate coordinate label like in prototype
        const charCode = 65 + gridX + this.maxGridCoord; // A=65
        const letter = String.fromCharCode(Math.max(65, Math.min(90, charCode)));
        const number = gridY + this.maxGridCoord;
        return `[${letter}-${number}]`;
    }
    
    // Convert grid coordinates to world coordinates
    gridToWorld(gridX, gridY) {
        const worldX = (gridX + this.maxGridCoord) * this.tileSize + this.tileSize / 2;
        const worldY = (gridY + this.maxGridCoord) * this.tileSize + this.tileSize / 2;
        return { x: worldX, y: worldY };
    }
    
    // Convert world coordinates to grid coordinates
    worldToGrid(worldX, worldY) {
        const gridX = Math.floor(worldX / this.tileSize) - this.maxGridCoord;
        const gridY = Math.floor(worldY / this.tileSize) - this.maxGridCoord;
        return { gridX, gridY };
    }
    
    // Check if a world position is on a valid tile
    isValidPosition(worldX, worldY, arenaData) {
        if (!arenaData || !arenaData.tiles) return false;
        
        const { gridX, gridY } = this.worldToGrid(worldX, worldY);
        
        return arenaData.tiles.some(tile => 
            tile.gridX === gridX && tile.gridY === gridY
        );
    }
}