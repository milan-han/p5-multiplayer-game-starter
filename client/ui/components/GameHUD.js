// =================================================================================
// GAME HUD COMPONENT - Blueprint Battle UI System
// =================================================================================
// In-game UI elements including crosshair, kill streak display, and status indicators
// Extracted from UIManager for better organization and performance

import { BaseComponent } from './BaseComponent.js';
import { UIUtils } from '../utils/UIUtils.js';

export class GameHUD extends BaseComponent {
    constructor(canvas, ctx, config, options = {}) {
        super(canvas, ctx, config, options);
        
        // HUD-specific configuration
        this.hudConfig = config.ui;
        this.killStreakConfig = config.ui.killstreak_display;
        
        // Component state
        this.state = {
            showCrosshair: true,
            showKillStreak: true,
            killStreak: 0,
            playerStats: {
                ammo: 0,
                health: 100,
                shield: false
            },
            visible: true
        };
        
        // Layout calculations
        this.layout = this.calculateLayout();
        
        // Animation state
        this.animations = {
            crosshairPulse: 0,
            killStreakGlow: 0,
            ammoIndicator: 0
        };
        
        console.log('GameHUD component initialized');
    }
    
    // =============================================================================
    // LAYOUT CALCULATIONS
    // =============================================================================
    
    /**
     * Calculate HUD element layout
     * @returns {Object} Layout configuration
     */
    calculateLayout() {
        const center = UIUtils.getCenter(this.canvas);
        const killStreakConfig = this.killStreakConfig;
        
        return {
            // Crosshair (center of screen)
            crosshair: {
                x: center.x,
                y: center.y,
                size: this.hudConfig.crosshair_size || 5
            },
            
            // Kill streak display (bottom-right)
            killStreak: {
                x: this.canvas.width - killStreakConfig.position.right - killStreakConfig.width,
                y: this.canvas.height - killStreakConfig.position.bottom - killStreakConfig.height,
                width: killStreakConfig.width,
                height: killStreakConfig.height
            },
            
            // Ammo indicator (near crosshair)
            ammoIndicator: {
                x: center.x + 30,
                y: center.y + 20,
                radius: 8
            },
            
            // Health bar (bottom-left)
            healthBar: {
                x: 20,
                y: this.canvas.height - 40,
                width: 150,
                height: 8
            }
        };
    }
    
    // =============================================================================
    // COMPONENT LIFECYCLE
    // =============================================================================
    
    /**
     * Update component with new game state
     * @param {number} deltaTime - Time since last update
     * @param {Object} state - External state data
     */
    update(deltaTime, state) {
        super.update(deltaTime, state);
        
        // Update HUD state from external data
        if (state.showCrosshair !== undefined) {
            this.state.showCrosshair = state.showCrosshair;
        }
        
        if (state.showKillStreak !== undefined) {
            this.state.showKillStreak = state.showKillStreak;
        }
        
        if (state.killStreak !== undefined) {
            // Trigger animation if kill streak changed
            if (this.state.killStreak !== state.killStreak) {
                this.animations.killStreakGlow = Date.now();
            }
            this.state.killStreak = state.killStreak;
        }
        
        if (state.playerStats) {
            this.state.playerStats = { ...state.playerStats };
        }
        
        if (state.visible !== undefined) {
            this.state.visible = state.visible;
        }
        
        // Update animations
        this.updateHUDAnimations(deltaTime);
        
        this.markDirty();
    }
    
    /**
     * Update HUD-specific animations
     * @param {number} deltaTime - Time since last update
     */
    updateHUDAnimations(deltaTime) {
        // Crosshair pulse animation
        this.animations.crosshairPulse += deltaTime * 0.003;
        if (this.animations.crosshairPulse > Math.PI * 2) {
            this.animations.crosshairPulse -= Math.PI * 2;
        }
        
        // Ammo indicator pulse when low
        if (this.state.playerStats.ammo === 0) {
            this.animations.ammoIndicator += deltaTime * 0.008;
            if (this.animations.ammoIndicator > Math.PI * 2) {
                this.animations.ammoIndicator -= Math.PI * 2;
            }
        }
    }
    
    // =============================================================================
    // RENDERING
    // =============================================================================
    
    /**
     * Draw the game HUD
     * @param {Object} state - Component state
     * @param {Object} context - Rendering context
     */
    draw(state, context) {
        if (!this.state.visible) {
            return;
        }
        
        if (this.state.showCrosshair) {
            this.drawCrosshair();
        }
        
        if (this.state.showKillStreak) {
            this.drawKillStreakDisplay();
        }
        
        this.drawAmmoIndicator();
        this.drawHealthBar();
        
        // Draw shield indicator if active
        if (this.state.playerStats.shield) {
            this.drawShieldStatus();
        }
    }
    
    /**
     * Draw crosshair in center of screen
     */
    drawCrosshair() {
        const crosshair = this.layout.crosshair;
        const size = crosshair.size;
        
        this.ctx.save();
        
        // Crosshair color with subtle pulse
        const pulse = (Math.sin(this.animations.crosshairPulse) + 1) * 0.5;
        const alpha = 0.6 + pulse * 0.2;
        this.ctx.strokeStyle = UIUtils.withAlpha(this.colors.primary, alpha);
        this.ctx.lineWidth = 1;
        
        // Draw crosshair lines
        this.ctx.beginPath();
        // Horizontal line
        this.ctx.moveTo(crosshair.x - size, crosshair.y);
        this.ctx.lineTo(crosshair.x + size, crosshair.y);
        // Vertical line
        this.ctx.moveTo(crosshair.x, crosshair.y - size);
        this.ctx.lineTo(crosshair.x, crosshair.y + size);
        this.ctx.stroke();
        
        // Center dot
        this.ctx.fillStyle = UIUtils.withAlpha(this.colors.accent, alpha);
        this.ctx.beginPath();
        this.ctx.arc(crosshair.x, crosshair.y, 1, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    /**
     * Draw kill streak display
     */
    drawKillStreakDisplay() {
        const layout = this.layout.killStreak;
        const config = this.killStreakConfig;
        
        if (this.state.killStreak <= 0) {
            return; // Don't show if no kill streak
        }
        
        this.ctx.save();
        
        // Calculate glow effect for recent kill streak changes
        let glowIntensity = config.glow_intensity;
        const timeSinceChange = Date.now() - this.animations.killStreakGlow;
        if (timeSinceChange < 2000) {
            const glowFactor = Math.max(0, 1 - timeSinceChange / 2000);
            glowIntensity += 15 * glowFactor;
        }
        
        // Draw frosted glass panel
        this.drawFrostedGlassPanel(
            layout.x,
            layout.y,
            layout.width,
            layout.height,
            {
                frostedAlpha: config.frosted_glass_alpha,
                borderWidth: config.border_width
            }
        );
        
        // Setup text styling
        this.ctx.font = `${config.label_font_size}px ${this.typography.title.family}`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.letterSpacing = '0.05em';
        
        // Draw "KILL STREAK" label
        this.ctx.fillStyle = this.colors.uiTextDim;
        this.ctx.fillText(
            'KILL STREAK',
            layout.x + layout.width / 2,
            layout.y + config.padding
        );
        
        // Draw kill streak number with glow
        this.ctx.font = `bold ${config.font_size}px ${this.typography.title.family}`;
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = this.colors.uiCyan;
        
        if (glowIntensity > 0) {
            this.ctx.shadowBlur = glowIntensity;
            this.ctx.shadowColor = this.colors.uiCyan;
        }
        
        this.ctx.fillText(
            String(this.state.killStreak),
            layout.x + layout.width / 2,
            layout.y + layout.height / 2 + 5
        );
        
        this.ctx.restore();
    }
    
    /**
     * Draw ammo indicator near crosshair
     */
    drawAmmoIndicator() {
        const layout = this.layout.ammoIndicator;
        const ammo = this.state.playerStats.ammo;
        
        this.ctx.save();
        
        // Color based on ammo count
        let color = this.colors.uiCyan;
        let alpha = 0.7;
        
        if (ammo === 0) {
            color = this.colors.error;
            // Pulse when out of ammo
            const pulse = (Math.sin(this.animations.ammoIndicator) + 1) * 0.5;
            alpha = 0.5 + pulse * 0.5;
        } else if (ammo <= 1) {
            color = this.colors.accent;
        }
        
        // Draw ammo circle
        this.ctx.fillStyle = UIUtils.withAlpha(color, alpha);
        this.ctx.beginPath();
        this.ctx.arc(layout.x, layout.y, layout.radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw ammo count text
        this.ctx.font = `bold 12px ${this.typography.monospace.family}`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = this.colors.base;
        this.ctx.fillText(String(ammo), layout.x, layout.y);
        
        this.ctx.restore();
    }
    
    /**
     * Draw health bar
     */
    drawHealthBar() {
        const layout = this.layout.healthBar;
        const health = this.state.playerStats.health || 100;
        const healthPercent = Math.max(0, Math.min(1, health / 100));
        
        this.ctx.save();
        
        // Background bar
        this.ctx.fillStyle = UIUtils.withAlpha(this.colors.uiCyan, 0.2);
        this.ctx.fillRect(layout.x, layout.y, layout.width, layout.height);
        
        // Health bar fill
        let healthColor = this.colors.uiCyan;
        if (healthPercent < 0.3) {
            healthColor = this.colors.error;
        } else if (healthPercent < 0.6) {
            healthColor = this.colors.accent;
        }
        
        this.ctx.fillStyle = UIUtils.withAlpha(healthColor, 0.8);
        this.ctx.fillRect(layout.x, layout.y, layout.width * healthPercent, layout.height);
        
        // Border
        this.ctx.strokeStyle = UIUtils.withAlpha(this.colors.uiCyan, 0.6);
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(layout.x, layout.y, layout.width, layout.height);
        
        // Health text
        this.ctx.font = `10px ${this.typography.monospace.family}`;
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillStyle = this.colors.uiCyan;
        this.ctx.fillText('HEALTH', layout.x, layout.y - 2);
        
        this.ctx.restore();
    }
    
    /**
     * Draw shield status indicator
     */
    drawShieldStatus() {
        const center = UIUtils.getCenter(this.canvas);
        
        this.ctx.save();
        
        // Shield indicator near crosshair
        const shieldX = center.x - 25;
        const shieldY = center.y - 15;
        
        // Shield icon with glow
        this.ctx.shadowBlur = 8;
        this.ctx.shadowColor = this.colors.accent;
        this.ctx.strokeStyle = this.colors.accent;
        this.ctx.fillStyle = UIUtils.withAlpha(this.colors.accent, 0.3);
        this.ctx.lineWidth = 2;
        
        // Draw shield shape
        this.ctx.beginPath();
        this.ctx.moveTo(shieldX + 7, shieldY);
        this.ctx.lineTo(shieldX + 12, shieldY + 4);
        this.ctx.lineTo(shieldX + 12, shieldY + 8);
        this.ctx.lineTo(shieldX + 7, shieldY + 14);
        this.ctx.lineTo(shieldX + 2, shieldY + 8);
        this.ctx.lineTo(shieldX + 2, shieldY + 4);
        this.ctx.closePath();
        
        this.ctx.fill();
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    /**
     * Draw frosted glass panel (shared utility)
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Panel width
     * @param {number} height - Panel height
     * @param {Object} options - Styling options
     */
    drawFrostedGlassPanel(x, y, width, height, options = {}) {
        this.ctx.save();
        
        const frostedAlpha = options.frostedAlpha || 0.12;
        const borderWidth = options.borderWidth || 1;
        
        // Base frosted glass layer
        this.ctx.fillStyle = UIUtils.withAlpha(this.colors.uiCyan, frostedAlpha);
        this.ctx.fillRect(x, y, width, height);
        
        // Border
        this.ctx.strokeStyle = UIUtils.withAlpha(this.colors.uiCyan, 0.8);
        this.ctx.lineWidth = borderWidth;
        this.ctx.strokeRect(x, y, width, height);
        
        this.ctx.restore();
    }
    
    // =============================================================================
    // COMPONENT INTERFACE
    // =============================================================================
    
    /**
     * Set crosshair visibility
     * @param {boolean} visible - Whether crosshair should be visible
     */
    setCrosshairVisible(visible) {
        if (this.state.showCrosshair !== visible) {
            this.state.showCrosshair = visible;
            this.markDirty();
        }
    }
    
    /**
     * Set kill streak display visibility
     * @param {boolean} visible - Whether kill streak should be visible
     */
    setKillStreakVisible(visible) {
        if (this.state.showKillStreak !== visible) {
            this.state.showKillStreak = visible;
            this.markDirty();
        }
    }
    
    /**
     * Update kill streak value
     * @param {number} killStreak - New kill streak value
     */
    updateKillStreak(killStreak) {
        if (this.state.killStreak !== killStreak) {
            // Trigger glow animation for changes
            if (killStreak > this.state.killStreak) {
                this.animations.killStreakGlow = Date.now();
            }
            this.state.killStreak = killStreak;
            this.markDirty();
        }
    }
    
    /**
     * Update player stats
     * @param {Object} stats - Player statistics
     */
    updatePlayerStats(stats) {
        const changed = JSON.stringify(this.state.playerStats) !== JSON.stringify(stats);
        if (changed) {
            this.state.playerStats = { ...stats };
            this.markDirty();
        }
    }
    
    /**
     * Get component bounds (for interaction)
     * @returns {Object} Component bounds
     */
    getBounds() {
        // HUD typically doesn't have interactive bounds
        return UIUtils.createBounds(0, 0, 0, 0);
    }
    
    /**
     * Get kill streak display bounds
     * @returns {Object} Kill streak display bounds
     */
    getKillStreakBounds() {
        return this.layout.killStreak;
    }
    
    /**
     * Handle canvas resize
     */
    onResize() {
        this.layout = this.calculateLayout();
        this.markDirty();
    }
    
    /**
     * Get current HUD state
     * @returns {Object} Current state
     */
    getState() {
        return {
            crosshairVisible: this.state.showCrosshair,
            killStreakVisible: this.state.showKillStreak,
            killStreak: this.state.killStreak,
            playerStats: { ...this.state.playerStats },
            visible: this.state.visible
        };
    }
}