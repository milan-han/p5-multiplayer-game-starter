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
        // Use lighter color and lower alpha to match prototype
        ctx.strokeStyle = PALETTE.dimStroke;
        ctx.globalAlpha = CONFIG.visual.arena_grid_alpha;
        ctx.lineWidth = CONFIG.visual.arena_grid_line_width;
        
        // Calculate visible grid range aligned to world coordinates
        const startX = Math.floor((bounds.minX - margin) / this.tileSize) * this.tileSize;
        const endX = Math.ceil((bounds.maxX + margin) / this.tileSize) * this.tileSize;
        const startY = Math.floor((bounds.minY - margin) / this.tileSize) * this.tileSize;
        const endY = Math.ceil((bounds.maxY + margin) / this.tileSize) * this.tileSize;
        
        // Draw vertical lines that extend beyond visible area to ensure intersection
        for (let x = startX; x <= endX; x += this.tileSize) {
            ctx.beginPath();
            ctx.moveTo(x, bounds.minY - margin * 2);
            ctx.lineTo(x, bounds.maxY + margin * 2);
            ctx.stroke();
        }
        
        // Draw horizontal lines that extend beyond visible area to ensure intersection
        for (let y = startY; y <= endY; y += this.tileSize) {
            ctx.beginPath();
            ctx.moveTo(bounds.minX - margin * 2, y);
            ctx.lineTo(bounds.maxX + margin * 2, y);
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
            ctx.strokeStyle = CONFIG.colors.tile_outline;
            ctx.lineWidth = CONFIG.visual.arena_tile_line_width;
            ctx.globalAlpha = CONFIG.visual.arena_tile_alpha;
            ctx.strokeRect(
                x - this.halfInnerSize,
                y - this.halfInnerSize,
                this.innerSize,
                this.innerSize
            );
            
            // Draw tile coordinate label
            ctx.font = `${CONFIG.typography.tile_label_size}px ${CONFIG.typography.primary_font}`;
            ctx.fillStyle = PALETTE.dimStroke;
            ctx.globalAlpha = CONFIG.visual.arena_label_alpha;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Generate coordinate label
            const label = this.generateTileLabel(tile.gridX, tile.gridY);
            ctx.fillText(label, x, y + this.halfInnerSize - CONFIG.ui.tile_label_offset);
            
            // Draw crosshair aligned with grid intersections
            ctx.strokeStyle = PALETTE.dimStroke;
            ctx.lineWidth = CONFIG.visual.arena_grid_line_width;
            ctx.globalAlpha = CONFIG.visual.arena_grid_alpha;
            ctx.beginPath();
            ctx.moveTo(x - CONFIG.ui.crosshair_size, y);
            ctx.lineTo(x + CONFIG.ui.crosshair_size, y);
            ctx.moveTo(x, y - CONFIG.ui.crosshair_size);
            ctx.lineTo(x, y + CONFIG.ui.crosshair_size);
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
            
            // Draw ammo pickup circle with dashed outline (like prototype)
            ctx.strokeStyle = PALETTE.glowAccent;
            ctx.lineWidth = CONFIG.visual.arena_ammo_line_width;
            ctx.globalAlpha = CONFIG.visual.arena_ammo_alpha;
            ctx.setLineDash(CONFIG.patterns.ammo_dash);
            
            // Add subtle glow effect with dashed lines
            ctx.shadowColor = PALETTE.glowAccent;
            ctx.shadowBlur = CONFIG.visual.arena_ammo_shadow_blur;
            
            ctx.beginPath();
            ctx.arc(ammo.x, ammo.y, CONFIG.visual.arena_ammo_radius, 0, Math.PI * 2);
            ctx.stroke();
            
            // Reset dash, shadow, and alpha
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
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