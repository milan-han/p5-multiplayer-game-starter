// =================================================================================
// CAMERA SYSTEM - Blueprint Battle
// =================================================================================

class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.rotation = 0;
        this.targetRotation = 0;
        this.shake = 0;
        this.lerpFactor = CONFIG.camera.lerp_factor;
        
        // Look-ahead properties
        this.lookAheadDistance = CONFIG.player.look_ahead.normal;
        this.isMoving = false;
        this.lastMovementTime = 0;
        // Dynamic zoom factor – scales world units so ~`CONFIG.camera.fov_blocks` tiles fit the screen width
        this.zoom = 1;
    }
    
    update(gameState, myPlayerId) {
        // Recompute zoom every frame to react to window resizes
        this.updateZoom();
        // Find my tank
        const myTank = gameState.tanks.find(tank => tank.id === myPlayerId);
        if (!myTank || !myTank.alive) return;
        
        // Update look-ahead distance based on speed mode
        this.lookAheadDistance = myTank.speedMode ? 
            CONFIG.player.look_ahead.speed_mode : 
            CONFIG.player.look_ahead.normal;
        
        // Calculate target camera position
        let targetX = myTank.x;
        let targetY = myTank.y;
        
        // Determine if player is actively pressing movement keys
        this.isMoving = keys.w || keys.s;

        if (this.isMoving) {
            // Convert tank heading from degrees to radians
            const headingRad = myTank.heading * Math.PI / 180;
            
            // Calculate look-ahead offset
            const lookAheadX = Math.cos(headingRad) * this.lookAheadDistance;
            const lookAheadY = Math.sin(headingRad) * this.lookAheadDistance;
            
            targetX += lookAheadX;
            targetY += lookAheadY;
        }
        
        // Smoothly interpolate camera position
        this.x = lerp(this.x, targetX, this.lerpFactor);
        this.y = lerp(this.y, targetY, this.lerpFactor);
        
        // Update camera rotation to follow tank
        const tankHeadingRad = myTank.heading * Math.PI / 180;
        this.targetRotation = -tankHeadingRad - Math.PI / 2;
        
        // Smooth rotation interpolation with angle wrapping
        let rotationDiff = normalizeAngle(this.targetRotation - this.rotation);
        this.rotation += rotationDiff * this.lerpFactor;
        this.rotation = normalizeAngle(this.rotation);
    }
    
    // Trigger camera shake (called externally)
    addShake(intensity) {
        const defaultMag = CONFIG ? CONFIG.camera.shake_magnitude : 15;
        this.shake = Math.max(this.shake, intensity ?? defaultMag);
    }
    
    // No longer needed because we read keys state directly, keep for back-compat but do nothing
    onPlayerMove() {}
    
    // ---------------------------------------------------------------------------------
    // ZOOM / FOV HELPERS
    // ---------------------------------------------------------------------------------
    updateZoom() {
        // Desired number of blocks to show across the screen (defaults to 12)
        const desiredBlocks = (CONFIG?.camera?.fov_blocks) ?? 12;
        const worldWidthForBlocks = desiredBlocks * CONFIG.arena.tile_size;
        // Account for device pixel ratio so calculation is based on CSS pixels, not backing store pixels
        const dpr = window.devicePixelRatio || 1;
        if (canvas) {
            const cssWidth = canvas.width / dpr; // convert backing store width to CSS pixel width
            this.zoom = cssWidth / worldWidthForBlocks;
        } else {
            this.zoom = 1;
        }
    }
    
    // Convert world coordinates to screen coordinates
    worldToScreen(worldX, worldY) {
        // Apply camera transformation
        const cos = Math.cos(-this.rotation);
        const sin = Math.sin(-this.rotation);
        
        // Translate to camera position
        const translatedX = worldX - this.x;
        const translatedY = worldY - this.y;
        
        // Apply rotation
        const rotatedX = translatedX * cos - translatedY * sin;
        const rotatedY = translatedX * sin + translatedY * cos;
        
        // Apply zoom (scale)
        const scaledX = rotatedX * this.zoom;
        const scaledY = rotatedY * this.zoom;
        
        // Translate to screen center
        const screenX = scaledX + canvas.width / 2;
        const screenY = scaledY + canvas.height / 2;
        
        return { x: screenX, y: screenY };
    }
    
    // Convert screen coordinates to world coordinates
    screenToWorld(screenX, screenY) {
        // Translate from screen center
        const translatedX = (screenX - canvas.width / 2) / this.zoom;
        const translatedY = (screenY - canvas.height / 2) / this.zoom;
        
        // Apply inverse rotation
        const cos = Math.cos(this.rotation);
        const sin = Math.sin(this.rotation);
        
        const rotatedX = translatedX * cos - translatedY * sin;
        const rotatedY = translatedX * sin + translatedY * cos;
        
        // Translate to world position
        const worldX = rotatedX + this.x;
        const worldY = rotatedY + this.y;
        
        return { x: worldX, y: worldY };
    }
    
    // Check if a point is visible on screen
    isVisible(worldX, worldY, margin = CONFIG.camera.visibility_margin) {
        const screen = this.worldToScreen(worldX, worldY);
        return screen.x >= -margin && 
               screen.x <= canvas.width + margin && 
               screen.y >= -margin && 
               screen.y <= canvas.height + margin;
    }
    
    // Get camera bounds in world coordinates
    getBounds() {
        const halfWidth = canvas.width / 2;
        const halfHeight = canvas.height / 2;
        
        const corners = [
            this.screenToWorld(0, 0),
            this.screenToWorld(canvas.width, 0),
            this.screenToWorld(canvas.width, canvas.height),
            this.screenToWorld(0, canvas.height)
        ];
        
        const minX = Math.min(...corners.map(c => c.x));
        const maxX = Math.max(...corners.map(c => c.x));
        const minY = Math.min(...corners.map(c => c.y));
        const maxY = Math.max(...corners.map(c => c.y));
        
        return { minX, maxX, minY, maxY };
    }
}