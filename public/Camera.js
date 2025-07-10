// =================================================================================
// CAMERA SYSTEM - Blueprint Battle
// =================================================================================

class Camera {
    constructor(deltaTime = null) {
        this.x = 0;
        this.y = 0;
        this.rotation = 0;
        this.targetRotation = 0;
        this.shake = 0;
        this.lerpFactor = CONFIG.camera.lerp_factor;
        
        // Phase 10: Delta time for frame-rate independence
        this.deltaTime = deltaTime;
        
        // Look-ahead properties
        this.lookAheadDistance = CONFIG.player.look_ahead.normal;
        this.isMoving = false;
        this.lastMovementTime = 0;
        // Dynamic zoom factor – scales world units so ~`CONFIG.camera.fov_blocks` tiles fit the screen width
        this.zoom = 1;
    }
    
    update(gameState, myPlayerId, deltaTime = 16) {
        // Recompute zoom every frame to react to window resizes
        this.updateZoom();
        // Find my tank
        const myTank = gameState.tanks.find(tank => tank.id === myPlayerId);
        if (!myTank || !myTank.alive) return;
        
        // Frame-rate independent interpolation factor
        const frameRateNormalizer = deltaTime / 16; // Normalize to 60Hz (16ms)
        const adjustedLerpFactor = this.lerpFactor * frameRateNormalizer;
        
        // Update look-ahead distance based on speed mode with smooth transition
        const targetLookAhead = myTank.speedMode ? 
            CONFIG.player.look_ahead.speed_mode : 
            CONFIG.player.look_ahead.normal;
        this.lookAheadDistance = this.lookAheadDistance + (targetLookAhead - this.lookAheadDistance) * (adjustedLerpFactor * 2);
        
        // Calculate target camera position
        let targetX = myTank.x;
        let targetY = myTank.y;
        
        // Enhanced movement detection with smoother transitions
        const wasMoving = this.isMoving;
        this.isMoving = keys.w || keys.s;
        
        // Update movement time for better look-ahead transitions
        if (this.isMoving) {
            this.lastMovementTime = Date.now();
        }
        
        // Apply look-ahead with velocity-based prediction
        const timeSinceMovement = Date.now() - this.lastMovementTime;
        const movementDecay = Math.exp(-timeSinceMovement / 500); // 500ms decay
        const effectiveLookAhead = this.lookAheadDistance * (this.isMoving ? 1.0 : movementDecay);
        
        if (effectiveLookAhead > 5) { // Only apply look-ahead if significant
            // Convert tank heading from degrees to radians
            const headingRad = myTank.heading * Math.PI / 180;
            
            // Calculate look-ahead offset with smooth application
            const lookAheadX = Math.cos(headingRad) * effectiveLookAhead;
            const lookAheadY = Math.sin(headingRad) * effectiveLookAhead;
            
            targetX += lookAheadX;
            targetY += lookAheadY;
        }
        
        // Enhanced camera position interpolation with threshold-based snapping
        const positionDeltaX = targetX - this.x;
        const positionDeltaY = targetY - this.y;
        const positionThreshold = 2.0;
        
        if (Math.abs(positionDeltaX) > positionThreshold) {
            this.x += positionDeltaX * Math.min(adjustedLerpFactor, 1.0);
        } else {
            this.x = targetX; // Snap when very close
        }
        
        if (Math.abs(positionDeltaY) > positionThreshold) {
            this.y += positionDeltaY * Math.min(adjustedLerpFactor, 1.0);
        } else {
            this.y = targetY; // Snap when very close
        }
        
        // Enhanced camera rotation to follow tank
        const tankHeadingRad = myTank.heading * Math.PI / 180;
        this.targetRotation = -tankHeadingRad - Math.PI / 2;
        
        // Improved rotation interpolation with threshold-based snapping
        let rotationDiff = normalizeAngle(this.targetRotation - this.rotation);
        const rotationThreshold = 0.02; // ~1 degree in radians
        
        if (Math.abs(rotationDiff) > rotationThreshold) {
            this.rotation += rotationDiff * Math.min(adjustedLerpFactor, 1.0);
        } else {
            this.rotation = this.targetRotation; // Snap when very close
        }
        this.rotation = normalizeAngle(this.rotation);
        
        // Update camera shake with decay
        this.updateShake(deltaTime);
    }
    
    // Trigger camera shake (called externally)
    addShake(intensity) {
        const defaultMag = CONFIG ? CONFIG.camera.shake_magnitude : 15;
        this.shake = Math.max(this.shake, intensity ?? defaultMag);
    }
    
    // Update camera shake with frame-rate independent decay
    updateShake(deltaTime = 16) {
        if (this.shake > 0) {
            const frameRateNormalizer = deltaTime / 16; // Normalize to 60Hz (16ms)
            const shakeDecay = CONFIG?.camera?.shake_decay ?? 0.9;
            const adjustedDecay = Math.pow(shakeDecay, frameRateNormalizer);
            
            this.shake *= adjustedDecay;
            
            // Stop shake when very small
            const shakeThreshold = CONFIG?.camera?.shake_threshold ?? 1;
            if (this.shake < shakeThreshold) {
                this.shake = 0;
            }
        }
    }
    
    // Get current shake offset
    getShakeOffset() {
        if (this.shake <= 0) return { x: 0, y: 0 };
        
        // Generate random shake offset
        const angle = Math.random() * Math.PI * 2;
        const magnitude = this.shake;
        
        return {
            x: Math.cos(angle) * magnitude,
            y: Math.sin(angle) * magnitude
        };
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
        if (canvas) {
            const cssWidth = DPR.logicalWidth(); // convert backing store width to CSS pixel width
            this.zoom = cssWidth / worldWidthForBlocks;
        } else {
            this.zoom = 1;
        }
    }
    
    // Convert world coordinates to screen coordinates
    worldToScreen(worldX, worldY) {
        // Apply camera shake offset
        const shakeOffset = this.getShakeOffset();
        
        // Apply camera transformation
        const cos = Math.cos(-this.rotation);
        const sin = Math.sin(-this.rotation);
        
        // Translate to camera position (with shake)
        const translatedX = worldX - (this.x + shakeOffset.x);
        const translatedY = worldY - (this.y + shakeOffset.y);
        
        // Apply rotation
        const rotatedX = translatedX * cos - translatedY * sin;
        const rotatedY = translatedX * sin + translatedY * cos;
        
        // Apply zoom (scale)
        const scaledX = rotatedX * this.zoom;
        const scaledY = rotatedY * this.zoom;
        
        // Translate to screen center
        const center = DPR.logicalCenter();
        const screenX = scaledX + center.x;
        const screenY = scaledY + center.y;
        
        return { x: screenX, y: screenY };
    }
    
    // Convert screen coordinates to world coordinates
    screenToWorld(screenX, screenY) {
        // Translate from screen center
        const center = DPR.logicalCenter();
        const translatedX = (screenX - center.x) / this.zoom;
        const translatedY = (screenY - center.y) / this.zoom;
        
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
        const bounds = DPR.logicalBounds();
        return screen.x >= -margin && 
               screen.x <= bounds.width + margin && 
               screen.y >= -margin && 
               screen.y <= bounds.height + margin;
    }
    
    // Get camera bounds in world coordinates
    getBounds() {
        const bounds = DPR.logicalBounds();
        
        const corners = [
            this.screenToWorld(0, 0),
            this.screenToWorld(bounds.width, 0),
            this.screenToWorld(bounds.width, bounds.height),
            this.screenToWorld(0, bounds.height)
        ];
        
        const minX = Math.min(...corners.map(c => c.x));
        const maxX = Math.max(...corners.map(c => c.x));
        const minY = Math.min(...corners.map(c => c.y));
        const maxY = Math.max(...corners.map(c => c.y));
        
        return { minX, maxX, minY, maxY };
    }
}