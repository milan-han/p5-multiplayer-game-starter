// =================================================================================
// CLIENT TANK RENDERING - Blueprint Battle
// =================================================================================

class ClientTank {
    constructor(tankData) {
        this.data = tankData;
        this.tileSize = CONFIG.arena.tile_size;
        this.tileRatio = CONFIG.arena.tile_ratio;
        this.innerSize = this.tileSize * this.tileRatio;
        this.halfInnerSize = this.innerSize / 2;
        
        // Shield properties
        this.shieldRadius = this.halfInnerSize + CONFIG.player.shield.radius_offset;
        this.shieldArcWidth = CONFIG.player.shield.arc_width_deg * Math.PI / 180;
        this.shieldLineWidth = CONFIG.player.shield.line_width;
        
        // Animation properties
        this.shieldAlpha = this.data.shield ? 1.0 : 0.0;
        this.targetShieldAlpha = this.data.shield ? 1.0 : 0.0;
        
        // Position interpolation for smooth movement
        this.displayX = this.data.x;
        this.displayY = this.data.y;
        this.displayHeading = this.data.heading;
        
        // Input prediction for own tank
        this.predictedX = this.data.x;
        this.predictedY = this.data.y;
        this.predictedHeading = this.data.heading;
        this.lastInputTime = 0;
        this.pendingInputs = [];
    }
    
    update(newData, isMyTank) {
        const prevData = this.data;
        this.data = newData;
        
        if (isMyTank) {
            // For own tank, apply server reconciliation
            this.reconcileServerState();
        } else {
            // For other tanks, interpolate position smoothly
            this.interpolatePosition();
        }
        
        // Update shield alpha animation
        this.updateShieldAlpha();
    }
    
    reconcileServerState() {
        // Server reconciliation for input prediction
        const serverX = this.data.x;
        const serverY = this.data.y;
        const serverHeading = this.data.heading;
        
        // Check if our prediction was correct
        const predictionError = Math.abs(this.predictedX - serverX) + Math.abs(this.predictedY - serverY);
        const headingError = Math.abs(this.predictedHeading - serverHeading);
        
        if (predictionError > 5 || headingError > 5) {
            // Prediction was wrong, snap to server position
            this.predictedX = serverX;
            this.predictedY = serverY;
            this.predictedHeading = serverHeading;
        }
        
        // Update display position to predicted position
        this.displayX = this.predictedX;
        this.displayY = this.predictedY;
        this.displayHeading = this.predictedHeading;
    }
    
    interpolatePosition() {
        // Smooth interpolation for other players
        const positionInterp = CONFIG.player.position_interp;
        const headingInterp = CONFIG.player.heading_interp;
        
        this.displayX = this.lerp(this.displayX, this.data.x, positionInterp);
        this.displayY = this.lerp(this.displayY, this.data.y, positionInterp);
        this.displayHeading = this.lerpAngle(this.displayHeading, this.data.heading, headingInterp);
    }
    
    predictInput(inputType, data) {
        // Apply input prediction for immediate feedback
        const timestamp = Date.now();
        const input = { type: inputType, data, timestamp };
        
        this.pendingInputs.push(input);
        this.lastInputTime = timestamp;
        
        // Apply prediction immediately
        this.applyInputPrediction(input);
    }
    
    applyInputPrediction(input) {
        switch (input.type) {
            case 'move':
                if (input.data.direction === 'forward') {
                    this.predictedX += this.tileSize * Math.cos(this.predictedHeading * Math.PI / 180);
                    this.predictedY += this.tileSize * Math.sin(this.predictedHeading * Math.PI / 180);
                } else if (input.data.direction === 'backward') {
                    this.predictedX -= this.tileSize * Math.cos(this.predictedHeading * Math.PI / 180);
                    this.predictedY -= this.tileSize * Math.sin(this.predictedHeading * Math.PI / 180);
                }
                break;
            case 'rotate':
                if (input.data.direction === 'left') {
                    this.predictedHeading -= CONFIG.player.rotation_step_deg;
                } else if (input.data.direction === 'right') {
                    this.predictedHeading += CONFIG.player.rotation_step_deg;
                }
                // Normalize angle
                while (this.predictedHeading < 0) this.predictedHeading += 360;
                while (this.predictedHeading >= 360) this.predictedHeading -= 360;
                break;
        }
    }
    
    lerp(a, b, t) {
        return a + (b - a) * t;
    }
    
    lerpAngle(a, b, t) {
        // Shortest angle interpolation
        let diff = b - a;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        return a + diff * t;
    }
    
    draw(ctx, isMyTank) {
        if (!this.data.alive) return;
        
        // Don't draw if not visible
        if (!camera.isVisible(this.displayX, this.displayY, this.tileSize)) {
            return;
        }
        
        // Draw tank body
        this.drawTankBody(ctx, isMyTank);
        
        // Draw ammo indicator
        if (this.data.ammo > 0) {
            this.drawAmmoIndicator(ctx);
        }
        
        // Draw shield
        if (this.shieldAlpha > 0) {
            this.drawShield(ctx);
        }
    }
    
    updateShieldAlpha() {
        this.targetShieldAlpha = (this.data.shield && !this.data.speedMode) ? 1.0 : 0.0;
        const alphaRate = CONFIG.player.shield_alpha_rate;
        
        if (this.shieldAlpha < this.targetShieldAlpha) {
            this.shieldAlpha = Math.min(1.0, this.shieldAlpha + alphaRate);
        } else if (this.shieldAlpha > this.targetShieldAlpha) {
            this.shieldAlpha = Math.max(0.0, this.shieldAlpha - alphaRate);
        }
    }
    
    drawTankBody(ctx, isMyTank) {
        const x = this.displayX;
        const y = this.displayY;
        
        ctx.save();
        
        // Set tank color (red for self, player's RGB for others)
        if (isMyTank) {
            ctx.strokeStyle = PALETTE.errorAccent;
            ctx.shadowColor = PALETTE.errorAccent;
        } else {
            // Use tank's RGB color
            const rgb = this.data.rgb;
            const color = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
            ctx.strokeStyle = color;
            ctx.shadowColor = color;
        }
        
        // Add glow effect
        ctx.shadowBlur = CONFIG.visual.tank_shadow_blur;
        ctx.lineWidth = CONFIG.visual.tank_line_width;
        
        // Draw tank square
        ctx.strokeRect(
            x - this.halfInnerSize,
            y - this.halfInnerSize,
            this.innerSize,
            this.innerSize
        );
        
        ctx.restore();
    }
    
    drawAmmoIndicator(ctx) {
        const x = this.displayX;
        const y = this.displayY;
        
        ctx.save();
        
        ctx.fillStyle = PALETTE.glowAccent;
        ctx.shadowColor = PALETTE.glowAccent;
        ctx.shadowBlur = 15;
        
        // Draw filled circle indicating ammo
        ctx.beginPath();
        ctx.arc(x, y, CONFIG.visual.ammo_indicator_radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
    
    drawShield(ctx) {
        const x = this.data.x;
        const y = this.data.y;
        
        ctx.save();
        
        // Position at tank center
        ctx.translate(x, y);
        
        // Rotate to tank heading (convert degrees to radians)
        const headingRad = this.data.heading * Math.PI / 180;
        ctx.rotate(headingRad);
        
        // Shield visual properties
        ctx.strokeStyle = PALETTE.glowAccent;
        ctx.shadowColor = PALETTE.glowAccent;
        ctx.shadowBlur = CONFIG.visual.shield_shadow_blur;
        ctx.globalAlpha = this.shieldAlpha;
        ctx.lineWidth = this.shieldLineWidth;
        
        // Draw shield arc
        ctx.beginPath();
        ctx.arc(0, 0, this.shieldRadius, -this.shieldArcWidth / 2, this.shieldArcWidth / 2);
        ctx.stroke();
        
        ctx.restore();
    }
    
    // Get tank bounds for collision detection
    getBounds() {
        return {
            left: this.data.x - this.halfInnerSize,
            right: this.data.x + this.halfInnerSize,
            top: this.data.y - this.halfInnerSize,
            bottom: this.data.y + this.halfInnerSize
        };
    }
    
    // Check if point is within tank bounds
    containsPoint(x, y) {
        const bounds = this.getBounds();
        return x >= bounds.left && x <= bounds.right &&
               y >= bounds.top && y <= bounds.bottom;
    }
    
    // Get tank center position
    getCenter() {
        return { x: this.data.x, y: this.data.y };
    }
    
    // Get tank heading in radians
    getHeadingRad() {
        return this.data.heading * Math.PI / 180;
    }
    
    // Get shield arc endpoints in world coordinates
    getShieldArc() {
        const headingRad = this.getHeadingRad();
        const halfArc = this.shieldArcWidth / 2;
        
        const startAngle = headingRad - halfArc;
        const endAngle = headingRad + halfArc;
        
        return {
            centerX: this.data.x,
            centerY: this.data.y,
            radius: this.shieldRadius,
            startAngle,
            endAngle,
            active: this.shieldAlpha > 0
        };
    }
    
    // Check if a point is protected by the shield
    isProtectedByShield(pointX, pointY) {
        if (this.shieldAlpha <= 0 || !this.data.shield) return false;
        
        const dx = pointX - this.data.x;
        const dy = pointY - this.data.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Check if point is within shield radius
        if (distance > this.shieldRadius) return false;
        
        // Check if point is within shield arc
        const pointAngle = Math.atan2(dy, dx);
        const tankHeading = this.getHeadingRad();
        const halfArc = this.shieldArcWidth / 2;
        
        let angleDiff = pointAngle - tankHeading;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        
        return Math.abs(angleDiff) <= halfArc;
    }
}