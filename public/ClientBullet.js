// =================================================================================
// CLIENT BULLET RENDERING - Blueprint Battle
// =================================================================================

class ClientBullet {
    constructor(bulletData) {
        this.data = bulletData;
        this.radius = CONFIG.bullet.radius;
        this.maxLife = CONFIG.bullet.life_frames;
        
        // Visual properties
        this.trailLength = CONFIG.visual.bullet_trail_length;
        this.trailPositions = [];
        this.glowIntensity = 1.0;
        
        // Calculate alpha based on bullet life (fade out near end of life)
        this.alpha = Math.min(1.0, this.data.life / (this.maxLife * CONFIG.visual.bullet_fade_threshold));
    }
    
    draw(ctx) {
        if (!this.data.active) return;
        
        // Don't draw if not visible
        if (!camera.isVisible(this.data.x, this.data.y, this.radius * CONFIG.visual.bullet_visibility_margin)) {
            return;
        }
        
        // Update visual properties
        this.updateVisualProperties();
        
        // Draw bullet trail
        this.drawTrail(ctx);
        
        // Draw main bullet
        this.drawBullet(ctx);
    }
    
    updateVisualProperties() {
        // Update alpha based on remaining life
        this.alpha = Math.min(1.0, this.data.life / (this.maxLife * CONFIG.visual.bullet_fade_threshold));
        
        // Update glow intensity based on speed (faster = brighter)
        const speed = Math.sqrt(this.data.vx * this.data.vx + this.data.vy * this.data.vy);
        this.glowIntensity = Math.min(1.0, speed / CONFIG.bullet.initial_speed);
        
        // Update trail positions
        this.updateTrail();
    }
    
    updateTrail() {
        // Add current position to trail
        this.trailPositions.unshift({
            x: this.data.x,
            y: this.data.y,
            alpha: this.alpha
        });
        
        // Limit trail length
        if (this.trailPositions.length > this.trailLength) {
            this.trailPositions.pop();
        }
    }
    
    drawTrail(ctx) {
        if (this.trailPositions.length < 2) return;
        
        ctx.save();
        
        // Draw trail segments
        for (let i = 1; i < this.trailPositions.length; i++) {
            const current = this.trailPositions[i - 1];
            const previous = this.trailPositions[i];
            
            // Calculate trail segment properties
            const segmentAlpha = (previous.alpha * (this.trailLength - i) / this.trailLength) * CONFIG.visual.bullet_trail_alpha;
            const segmentWidth = this.radius * (this.trailLength - i) / this.trailLength;
            
            if (segmentAlpha <= 0) continue;
            
            // Draw trail segment
            ctx.globalAlpha = segmentAlpha;
            ctx.strokeStyle = PALETTE.glowAccent;
            ctx.lineWidth = segmentWidth;
            ctx.lineCap = 'round';
            
            // Add subtle glow
            ctx.shadowColor = PALETTE.glowAccent;
            ctx.shadowBlur = segmentWidth * 2;
            
            ctx.beginPath();
            ctx.moveTo(previous.x, previous.y);
            ctx.lineTo(current.x, current.y);
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    drawBullet(ctx) {
        const x = this.data.x;
        const y = this.data.y;
        
        ctx.save();
        
        // Set bullet color and glow
        ctx.fillStyle = PALETTE.glowAccent;
        ctx.shadowColor = PALETTE.glowAccent;
        ctx.shadowBlur = CONFIG.visual.bullet_glow_shadow_blur * this.glowIntensity;
        ctx.globalAlpha = this.alpha;
        
        // Draw main bullet circle
        ctx.beginPath();
        ctx.arc(x, y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw inner bright core
        ctx.shadowBlur = CONFIG.visual.bullet_glow_shadow_blur * this.glowIntensity * CONFIG.patterns.shadow_blur_multiplier;
        ctx.globalAlpha = this.alpha * CONFIG.visual.bullet_inner_alpha;
        ctx.fillStyle = CONFIG.colors.white;
        
        ctx.beginPath();
        ctx.arc(x, y, this.radius * CONFIG.visual.bullet_inner_radius_ratio, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
    
    // Get bullet bounds for collision detection
    getBounds() {
        return {
            left: this.data.x - this.radius,
            right: this.data.x + this.radius,
            top: this.data.y - this.radius,
            bottom: this.data.y + this.radius
        };
    }
    
    // Check if point is within bullet bounds
    containsPoint(x, y) {
        const dx = x - this.data.x;
        const dy = y - this.data.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= this.radius;
    }
    
    // Get bullet center position
    getCenter() {
        return { x: this.data.x, y: this.data.y };
    }
    
    // Get bullet velocity
    getVelocity() {
        return { vx: this.data.vx, vy: this.data.vy };
    }
    
    // Get bullet direction in radians
    getDirection() {
        return Math.atan2(this.data.vy, this.data.vx);
    }
    
    // Get bullet speed
    getSpeed() {
        return Math.sqrt(this.data.vx * this.data.vx + this.data.vy * this.data.vy);
    }
    
    // Check if bullet is about to expire
    isExpiring() {
        return this.data.life < this.maxLife * 0.2;
    }
    
    // Get life percentage (0-1)
    getLifePercentage() {
        return this.data.life / this.maxLife;
    }
    
    // Check if bullet is near end of life and should start fading
    isNearEndOfLife() {
        return this.data.life < this.maxLife * CONFIG.visual.bullet_fade_threshold * 0.67;
    }
}