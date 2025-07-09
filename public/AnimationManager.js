// =================================================================================
// ANIMATION MANAGER - Blueprint Battle
// =================================================================================

class AnimationManager {
    constructor(canvas, ctx, deltaTime) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.deltaTime = deltaTime;
        
        // Rendering layers
        this.renderLayers = {
            background: [],
            arena: [],
            entities: [],
            effects: [],
            ui: []
        };
        
        // Batch rendering state
        this.batchState = {
            globalAlpha: 1,
            globalCompositeOperation: 'source-over',
            fillStyle: '#000000',
            strokeStyle: '#000000',
            lineWidth: 1,
            shadowBlur: 0,
            shadowColor: '#000000'
        };
        
        // Animation state machines for all entities
        this.entityAnimations = new Map();
        
        // Background pattern cache
        this.backgroundPattern = null;
        
        // Performance tracking
        this.performanceStats = {
            renderTime: 0,
            drawCalls: 0,
            entitiesRendered: 0,
            effectsRendered: 0
        };
        
        // Create background pattern
        this.createBackgroundPattern();
    }
    
    // Main render function - single clear → draw → present cycle
    render(gameState, camera, myPlayerId) {
        const startTime = performance.now();
        
        // Clear canvas
        this.clearCanvas();
        
        // Apply camera transformation
        this.applyCamera(camera);
        
        // Render all layers in order
        this.renderBackground();
        this.renderArena(gameState.arena);
        this.renderEntities(gameState, myPlayerId);
        this.renderEffects(gameState, myPlayerId);
        
        // Restore camera transformation
        this.restoreCamera();
        
        // Render UI (screen space)
        this.renderUI(gameState, myPlayerId);
        
        // Update performance stats
        this.updatePerformanceStats(startTime);
        
        // Clear render queues
        this.clearRenderQueues();
    }
    
    // Clear canvas with background pattern
    clearCanvas() {
        const dpr = window.devicePixelRatio || 1;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background pattern
        if (this.backgroundPattern) {
            this.ctx.fillStyle = this.backgroundPattern;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
    
    // Apply camera transformation
    applyCamera(camera) {
        this.ctx.save();
        
        // Translate to screen center (CSS pixels)
        const dpr = window.devicePixelRatio || 1;
        this.ctx.translate(this.canvas.width / (2 * dpr), this.canvas.height / (2 * dpr));
        
        // Apply camera shake
        if (camera.shake > CONFIG.camera.shake_threshold) {
            this.ctx.translate(
                (Math.random() - 0.5) * camera.shake,
                (Math.random() - 0.5) * camera.shake
            );
        }
        
        // Apply camera rotation and position
        this.ctx.rotate(camera.rotation);
        this.ctx.scale(camera.zoom, camera.zoom);
        
        // Pixel-snap translation for crisp rendering
        const factor = camera.zoom * dpr;
        const roundedCamX = Math.round(camera.x * factor) / factor;
        const roundedCamY = Math.round(camera.y * factor) / factor;
        this.ctx.translate(-roundedCamX, -roundedCamY);
    }
    
    // Restore camera transformation
    restoreCamera() {
        this.ctx.restore();
    }
    
    // Render background layer
    renderBackground() {
        // Background is already rendered in clearCanvas
    }
    
    // Render arena layer
    renderArena(arenaData) {
        if (!arenaData) return;
        
        this.ctx.save();
        
        // Batch arena drawing for performance
        this.setBatchState({
            strokeStyle: PALETTE.dimStroke,
            lineWidth: CONFIG.visual.arena_tile_line_width,
            globalAlpha: CONFIG.visual.arena_tile_alpha
        });
        
        // Draw arena tiles
        this.drawArenaTiles(arenaData.tiles);
        
        // Draw ammo spawns
        this.setBatchState({
            strokeStyle: PALETTE.glowAccent,
            lineWidth: CONFIG.visual.arena_ammo_line_width,
            globalAlpha: CONFIG.visual.arena_ammo_alpha,
            shadowBlur: CONFIG.visual.arena_ammo_shadow_blur,
            shadowColor: PALETTE.glowAccent
        });
        
        this.drawAmmoSpawns(arenaData.ammo);
        
        this.ctx.restore();
    }
    
    // Render entities layer
    renderEntities(gameState, myPlayerId) {
        if (!gameState.tanks && !gameState.bullets) return;
        
        this.performanceStats.entitiesRendered = 0;
        
        // Render tanks
        if (gameState.tanks) {
            gameState.tanks.forEach(tankData => {
                this.renderTank(tankData, tankData.id === myPlayerId);
            });
        }
        
        // Render bullets
        if (gameState.bullets) {
            gameState.bullets.forEach(bulletData => {
                this.renderBullet(bulletData);
            });
        }
    }
    
    // Render effects layer
    renderEffects(gameState, myPlayerId) {
        this.performanceStats.effectsRendered = 0;
        
        // Render entity-specific effects
        if (gameState.tanks) {
            gameState.tanks.forEach(tankData => {
                this.renderTankEffects(tankData, tankData.id === myPlayerId);
            });
        }
        
        // Render global effects
        this.renderGlobalEffects();
    }
    
    // Render UI layer
    renderUI(gameState, myPlayerId) {
        if (!gameState.tanks) return;
        
        const myTank = gameState.tanks.find(tank => tank.id === myPlayerId);
        if (!myTank) return;
        
        this.ctx.save();
        
        // Draw kill streak display
        this.drawKillStreakDisplay(myTank.killStreak);
        
        // Draw leaderboard
        this.drawLeaderboard(gameState.tanks, myPlayerId);
        
        // Draw death screen if applicable
        if (!myTank.alive) {
            this.drawDeathScreen(myTank);
        }
        
        this.ctx.restore();
    }
    
    // Render a single tank with animation state
    renderTank(tankData, isMyTank) {
        if (!tankData.alive) return;
        
        // Get or create animation state machine
        let animationState = this.entityAnimations.get(tankData.id);
        if (!animationState) {
            animationState = new AnimationStateMachine(tankData.id, this.deltaTime);
            this.entityAnimations.set(tankData.id, animationState);
        }
        
        // Update animation state
        animationState.update(tankData, this.getEntityEvents(tankData.id));
        
        // Get animation values
        const animValues = animationState.getAnimationValues();
        
        // Don't render if not visible
        if (!camera.isVisible(tankData.x, tankData.y, CONFIG.arena.tile_size)) {
            return;
        }
        
        this.ctx.save();
        
        // Apply position offset from animations
        const renderX = tankData.x + animValues.positionOffset.x;
        const renderY = tankData.y + animValues.positionOffset.y;
        
        // Draw tank body
        this.drawTankBody(renderX, renderY, tankData, isMyTank, animValues);
        
        // Draw ammo indicator
        if (tankData.ammo > 0) {
            this.drawAmmoIndicator(renderX, renderY, animValues);
        }
        
        // Draw shield
        if (animValues.shieldAlpha > 0) {
            this.drawShield(renderX, renderY, tankData, animValues);
        }
        
        this.ctx.restore();
        this.performanceStats.entitiesRendered++;
    }
    
    // Render tank effects
    renderTankEffects(tankData, isMyTank) {
        const animationState = this.entityAnimations.get(tankData.id);
        if (!animationState) return;
        
        const animValues = animationState.getAnimationValues();
        
        this.ctx.save();
        
        // Muzzle flash
        if (animValues.muzzleFlashAlpha > 0) {
            this.drawMuzzleFlash(tankData.x, tankData.y, animValues);
        }
        
        // Hit flash
        if (animValues.hitFlashAlpha > 0) {
            this.drawHitFlash(tankData.x, tankData.y, animValues);
        }
        
        // Death fade
        if (animValues.deathFadeAlpha > 0) {
            this.drawDeathFade(tankData.x, tankData.y, animValues);
        }
        
        this.ctx.restore();
        this.performanceStats.effectsRendered++;
    }
    
    // Render a single bullet
    renderBullet(bulletData) {
        if (!bulletData.active) return;
        
        // Don't render if not visible
        if (!camera.isVisible(bulletData.x, bulletData.y, bulletData.radius * 4)) {
            return;
        }
        
        this.ctx.save();
        
        // Calculate bullet alpha based on life
        const alpha = Math.min(1.0, bulletData.life / (CONFIG.bullet.life_frames * CONFIG.visual.bullet_fade_threshold));
        
        // Set bullet glow
        this.setBatchState({
            fillStyle: PALETTE.glowAccent,
            shadowColor: PALETTE.glowAccent,
            shadowBlur: CONFIG.visual.bullet_glow_shadow_blur,
            globalAlpha: alpha
        });
        
        // Draw bullet
        this.ctx.beginPath();
        this.ctx.arc(bulletData.x, bulletData.y, bulletData.radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw inner bright core
        this.setBatchState({
            fillStyle: PALETTE.white,
            globalAlpha: alpha * CONFIG.visual.bullet_inner_alpha,
            shadowBlur: CONFIG.visual.bullet_glow_shadow_blur * 0.5
        });
        
        this.ctx.beginPath();
        this.ctx.arc(bulletData.x, bulletData.y, bulletData.radius * CONFIG.visual.bullet_inner_radius_ratio, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
        this.performanceStats.entitiesRendered++;
    }
    
    // Draw tank body with animation values
    drawTankBody(x, y, tankData, isMyTank, animValues) {
        const tileSize = CONFIG.arena.tile_size;
        const tileRatio = CONFIG.arena.tile_ratio;
        const innerSize = tileSize * tileRatio;
        const halfInnerSize = innerSize / 2;
        
        // Use tank's assigned color
        const rgb = tankData.rgb;
        const color = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        
        this.setBatchState({
            strokeStyle: color,
            shadowColor: color,
            shadowBlur: CONFIG.visual.tank_shadow_blur * (isMyTank ? 1.5 : 1) * animValues.glowIntensity,
            lineWidth: CONFIG.visual.tank_line_width,
            globalAlpha: 1
        });
        
        // Draw tank square
        this.ctx.strokeRect(
            x - halfInnerSize,
            y - halfInnerSize,
            innerSize,
            innerSize
        );
        
        this.performanceStats.drawCalls++;
    }
    
    // Draw ammo indicator with proper state isolation
    drawAmmoIndicator(x, y, animValues) {
        this.saveCanvasState();
        
        // Force white color for ammo indicators (selected state)
        this.setBatchState({
            fillStyle: PALETTE.white,
            shadowColor: PALETTE.white,
            shadowBlur: CONFIG.visual.ammo_indicator_radius * animValues.glowIntensity,
            globalAlpha: 1
        });
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, CONFIG.visual.ammo_indicator_radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.restoreCanvasState();
        this.performanceStats.drawCalls++;
    }
    
    // Draw shield with animation values
    drawShield(x, y, tankData, animValues) {
        const tileSize = CONFIG.arena.tile_size;
        const shieldRadius = tileSize / 2 + CONFIG.player.shield.radius_offset;
        const shieldArcWidth = CONFIG.player.shield.arc_width_deg * Math.PI / 180;
        
        this.ctx.save();
        
        // Position at tank center
        this.ctx.translate(x, y);
        
        // Rotate to tank heading
        const headingRad = tankData.heading * Math.PI / 180;
        this.ctx.rotate(headingRad);
        
        // Shield visual properties
        this.setBatchState({
            strokeStyle: PALETTE.glowAccent,
            shadowColor: PALETTE.glowAccent,
            shadowBlur: CONFIG.visual.shield_shadow_blur * animValues.glowIntensity,
            globalAlpha: animValues.shieldAlpha,
            lineWidth: CONFIG.player.shield.line_width
        });
        
        // Draw shield arc
        this.ctx.beginPath();
        this.ctx.arc(0, 0, shieldRadius, -shieldArcWidth / 2, shieldArcWidth / 2);
        this.ctx.stroke();
        
        this.ctx.restore();
        this.performanceStats.drawCalls++;
    }
    
    // Draw muzzle flash effect
    drawMuzzleFlash(x, y, animValues) {
        this.setBatchState({
            fillStyle: PALETTE.glowAccent,
            shadowColor: PALETTE.glowAccent,
            shadowBlur: CONFIG.visual.combat_effects.muzzle_flash_intensity * animValues.muzzleFlashAlpha,
            globalAlpha: animValues.muzzleFlashAlpha
        });
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, 20, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.performanceStats.drawCalls++;
    }
    
    // Draw hit flash effect
    drawHitFlash(x, y, animValues) {
        this.setBatchState({
            fillStyle: PALETTE.errorAccent,
            shadowColor: PALETTE.errorAccent,
            shadowBlur: 15,
            globalAlpha: animValues.hitFlashAlpha
        });
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, CONFIG.visual.combat_effects.hit_flash_radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.performanceStats.drawCalls++;
    }
    
    // Draw death fade effect
    drawDeathFade(x, y, animValues) {
        this.setBatchState({
            strokeStyle: PALETTE.errorAccent,
            shadowColor: PALETTE.errorAccent,
            shadowBlur: 10,
            lineWidth: 3,
            globalAlpha: animValues.deathFadeAlpha
        });
        
        const size = 60 * (1 - animValues.deathFadeAlpha);
        this.ctx.strokeRect(x - size/2, y - size/2, size, size);
        
        this.performanceStats.drawCalls++;
    }
    
    // Draw arena tiles (batched)
    drawArenaTiles(tiles) {
        if (!tiles) return;
        
        this.ctx.beginPath();
        
        const tileSize = CONFIG.arena.tile_size;
        const tileRatio = CONFIG.arena.tile_ratio;
        const innerSize = tileSize * tileRatio;
        const halfInnerSize = innerSize / 2;
        
        tiles.forEach(tile => {
            if (camera.isVisible(tile.x, tile.y, tileSize)) {
                this.ctx.rect(
                    tile.x - halfInnerSize,
                    tile.y - halfInnerSize,
                    innerSize,
                    innerSize
                );
            }
        });
        
        this.ctx.stroke();
        this.performanceStats.drawCalls++;
    }
    
    // Draw ammo spawns (batched) with proper dash pattern
    drawAmmoSpawns(ammo) {
        if (!ammo) return;
        
        // Apply dash pattern for ammo spawns
        this.ctx.setLineDash(CONFIG.patterns.ammo_dash);
        
        this.ctx.beginPath();
        
        ammo.forEach(ammoSpawn => {
            if (camera.isVisible(ammoSpawn.x, ammoSpawn.y, CONFIG.visual.arena_ammo_radius * 2)) {
                this.ctx.moveTo(ammoSpawn.x + CONFIG.visual.arena_ammo_radius, ammoSpawn.y);
                this.ctx.arc(ammoSpawn.x, ammoSpawn.y, CONFIG.visual.arena_ammo_radius, 0, Math.PI * 2);
            }
        });
        
        this.ctx.stroke();
        
        // Reset dash pattern
        this.ctx.setLineDash([]);
        
        this.performanceStats.drawCalls++;
    }
    
    // Draw kill streak display with proper state isolation
    drawKillStreakDisplay(killStreak) {
        this.saveCanvasState();
        
        // Implementation using existing code from game.js
        const dpr = window.devicePixelRatio || 1;
        const logicalCanvasWidth = this.canvas.width / dpr;
        const logicalCanvasHeight = this.canvas.height / dpr;
        
        const logicalRight = CONFIG.ui.killstreak_display.position.right;
        const logicalBottom = CONFIG.ui.killstreak_display.position.bottom;
        const width = CONFIG.ui.killstreak_display.width;
        const height = CONFIG.ui.killstreak_display.height;
        
        const x = logicalCanvasWidth - logicalRight - width;
        const y = logicalCanvasHeight - logicalBottom - height;
        
        // Draw frosted glass background
        this.drawFrostedGlassPanel(x, y, width, height);
        
        // Draw kill streak text
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const displayText = `KILL STREAK: ${killStreak}`;
        
        this.setBatchState({
            fillStyle: CONFIG.colors.leaderboard_cyan,
            font: `${CONFIG.ui.killstreak_display.label_font_size}px ${CONFIG.typography.title_font}`,
            textAlign: 'center',
            textBaseline: 'middle'
        });
        
        if (killStreak > 0) {
            const pulseIntensity = Math.sin(this.deltaTime.getRenderTime() * 5) * 0.3 + 1;
            this.setBatchState({
                shadowBlur: CONFIG.ui.killstreak_display.glow_intensity * pulseIntensity,
                shadowColor: CONFIG.colors.leaderboard_cyan
            });
        }
        
        this.ctx.fillText(displayText, centerX, centerY);
        
        this.restoreCanvasState();
        this.performanceStats.drawCalls++;
    }
    
    // Draw leaderboard with proper state isolation
    drawLeaderboard(tanks, myPlayerId) {
        if (!tanks || tanks.length === 0) return;
        
        this.saveCanvasState();
        
        const dpr = window.devicePixelRatio || 1;
        const logicalCanvasWidth = this.canvas.width / dpr;
        
        const x = logicalCanvasWidth - CONFIG.ui.leaderboard.position.right - CONFIG.ui.leaderboard.width;
        const y = CONFIG.ui.leaderboard.position.top;
        
        // Sort players by kill streak
        const sortedPlayers = tanks
            .map(tank => ({
                ...tank,
                displayName: tank.name || `Player ${tank.id.substring(0, 6)}`
            }))
            .sort((a, b) => b.killStreak - a.killStreak)
            .slice(0, CONFIG.ui.leaderboard.max_players);
        
        const panelHeight = CONFIG.ui.leaderboard.padding * 2 + 
                           CONFIG.ui.leaderboard.row_height * (sortedPlayers.length + 1.5);
        
        // Draw frosted glass background
        this.drawFrostedGlassPanel(x, y, CONFIG.ui.leaderboard.width, panelHeight);
        
        // Draw header
        this.setBatchState({
            fillStyle: CONFIG.colors.leaderboard_cyan,
            font: `${CONFIG.ui.leaderboard.title_font_weight} ${CONFIG.ui.leaderboard.header_font_size}px ${CONFIG.typography.title_font}`,
            textAlign: 'center',
            textBaseline: 'middle'
        });
        
        const headerY = y + CONFIG.ui.leaderboard.padding + CONFIG.ui.leaderboard.row_height / 2;
        this.ctx.fillText('LEADERBOARD', x + CONFIG.ui.leaderboard.width / 2, headerY);
        
        // Draw players
        sortedPlayers.forEach((player, index) => {
            const rowY = y + CONFIG.ui.leaderboard.padding + CONFIG.ui.leaderboard.row_height * (index + 2);
            const playerColor = `rgb(${player.rgb.r}, ${player.rgb.g}, ${player.rgb.b})`;
            
            this.setBatchState({
                fillStyle: playerColor,
                font: `${CONFIG.ui.leaderboard.font_size}px ${CONFIG.typography.primary_font}`,
                textAlign: 'left',
                globalAlpha: player.id === myPlayerId ? 1 : CONFIG.ui.leaderboard.regular_player_alpha
            });
            
            // Draw player name
            this.ctx.fillText(player.displayName.toUpperCase(), x + CONFIG.ui.leaderboard.inner_padding, rowY);
            
            // Draw kill streak
            this.setBatchState({
                font: `${CONFIG.ui.leaderboard.font_size}px ${CONFIG.typography.monospace_font}`,
                textAlign: 'right'
            });
            
            this.ctx.fillText(player.killStreak.toString(), 
                             x + CONFIG.ui.leaderboard.width - CONFIG.ui.leaderboard.inner_padding, 
                             rowY);
        });
        
        this.restoreCanvasState();
        this.performanceStats.drawCalls++;
    }
    
    // Draw death screen
    drawDeathScreen(myTank) {
        // Implementation using existing code from game.js
        const dpr = window.devicePixelRatio || 1;
        const logicalWidth = this.canvas.width / dpr;
        const logicalHeight = this.canvas.height / dpr;
        
        // Draw background overlay
        this.setBatchState({
            fillStyle: PALETTE.base,
            globalAlpha: CONFIG.ui.death_screen.background_alpha
        });
        
        this.ctx.fillRect(0, 0, logicalWidth, logicalHeight);
        
        const centerX = logicalWidth / 2;
        const centerY = logicalHeight / 2;
        
        // Draw death message
        this.setBatchState({
            fillStyle: PALETTE.errorAccent,
            font: `${CONFIG.ui.death_screen.message_font_size}px ${CONFIG.typography.primary_font}`,
            textAlign: 'center',
            textBaseline: 'middle',
            shadowBlur: 15,
            shadowColor: PALETTE.errorAccent,
            globalAlpha: 1
        });
        
        this.ctx.fillText('YOU DIED', centerX, centerY - 80);
        
        this.performanceStats.drawCalls++;
    }
    
    // Draw frosted glass panel with proper state isolation
    drawFrostedGlassPanel(x, y, width, height) {
        this.saveCanvasState();
        
        const unifiedCyan = CONFIG.colors.leaderboard_cyan;
        
        // Base frosted glass layer
        this.setBatchState({
            fillStyle: unifiedCyan,
            globalAlpha: CONFIG.ui.leaderboard.frosted_glass_alpha
        });
        this.ctx.fillRect(x, y, width, height);
        
        // Darker layer for depth
        this.setBatchState({
            fillStyle: PALETTE.base,
            globalAlpha: 0.4
        });
        this.ctx.fillRect(x, y, width, height);
        
        // Cyan tint layer
        this.setBatchState({
            fillStyle: unifiedCyan,
            globalAlpha: 0.1
        });
        this.ctx.fillRect(x, y, width, height);
        
        // Border
        this.setBatchState({
            strokeStyle: unifiedCyan,
            lineWidth: 1,
            globalAlpha: 0.8
        });
        this.ctx.strokeRect(x, y, width, height);
        
        this.restoreCanvasState();
        this.performanceStats.drawCalls++;
    }
    
    // Render global effects
    renderGlobalEffects() {
        // Render any global effects that aren't entity-specific
    }
    
    // Set batch rendering state with proper isolation
    setBatchState(newState) {
        // Save current state if this is the first state change in a batch
        if (!this._stateStack) {
            this._stateStack = [];
        }
        
        // Apply new state
        for (const [key, value] of Object.entries(newState)) {
            if (this.batchState[key] !== value) {
                this.batchState[key] = value;
                this.ctx[key] = value;
            }
        }
    }
    
    // Save current canvas state
    saveCanvasState() {
        this.ctx.save();
    }
    
    // Restore canvas state
    restoreCanvasState() {
        this.ctx.restore();
    }
    
    // Get entity events for animation state machine
    getEntityEvents(entityId) {
        // This would be populated by the main game loop
        return [];
    }
    
    // Create background pattern
    createBackgroundPattern() {
        const patternCanvas = document.createElement('canvas');
        const patternCtx = patternCanvas.getContext('2d');
        const size = CONFIG.background_pattern.cell_size;
        const dotRadius = CONFIG.background_pattern.dot_radius;
        
        patternCanvas.width = size;
        patternCanvas.height = size;
        
        patternCtx.fillStyle = PALETTE.base;
        patternCtx.fillRect(0, 0, size, size);
        
        patternCtx.fillStyle = PALETTE.dimStroke;
        patternCtx.globalAlpha = CONFIG.background_pattern.dot_alpha;
        patternCtx.beginPath();
        patternCtx.arc(size / 2, size / 2, dotRadius, 0, Math.PI * 2);
        patternCtx.fill();
        
        this.backgroundPattern = this.ctx.createPattern(patternCanvas, 'repeat');
    }
    
    // Update performance statistics
    updatePerformanceStats(startTime) {
        this.performanceStats.renderTime = performance.now() - startTime;
    }
    
    // Clear render queues
    clearRenderQueues() {
        for (const layer of Object.values(this.renderLayers)) {
            layer.length = 0;
        }
        this.performanceStats.drawCalls = 0;
    }
    
    // Get performance statistics
    getPerformanceStats() {
        return { ...this.performanceStats };
    }
    
    // Clean up animation state machines for disconnected entities
    cleanupAnimations(activeEntityIds) {
        const toRemove = [];
        
        for (const entityId of this.entityAnimations.keys()) {
            if (!activeEntityIds.includes(entityId)) {
                toRemove.push(entityId);
            }
        }
        
        toRemove.forEach(entityId => {
            this.entityAnimations.delete(entityId);
        });
    }
    
    // Resize handler
    onResize() {
        this.createBackgroundPattern();
    }
    
    // Get debug information
    getDebugInfo() {
        return {
            activeAnimations: this.entityAnimations.size,
            performanceStats: this.performanceStats,
            batchState: { ...this.batchState }
        };
    }
}