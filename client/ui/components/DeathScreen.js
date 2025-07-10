// =================================================================================
// DEATH SCREEN COMPONENT - Blueprint Battle UI System
// =================================================================================
// Death overlay with respawn countdown, statistics, and respawn button
// Extracted from UIManager for better separation of concerns

import { BaseComponent } from './BaseComponent.js';
import { UIUtils } from '../utils/UIUtils.js';

export class DeathScreen extends BaseComponent {
    constructor(canvas, ctx, config, options = {}) {
        super(canvas, ctx, config, options);
        
        // Death screen configuration
        this.deathConfig = config.ui.death_screen;
        
        // Component state
        this.state = {
            isDead: false,
            deathMessage: 'YOU WERE ELIMINATED',
            killerName: null,
            respawnTime: 0,
            secondsLeft: 0,
            showRespawnButton: false,
            buttonHovered: false,
            stats: null, // Death statistics
            visible: false
        };
        
        // Layout calculations
        this.layout = this.calculateLayout();
        
        // Animation state
        this.animations = {
            fadeIn: 0,
            pulse: 0,
            countdownPulse: 0,
            buttonGlow: 0
        };
        
        console.log('DeathScreen component initialized');
    }
    
    // =============================================================================
    // LAYOUT CALCULATIONS
    // =============================================================================
    
    /**
     * Calculate death screen layout
     * @returns {Object} Layout configuration
     */
    calculateLayout() {
        const center = UIUtils.getCenter(this.canvas);
        const config = this.deathConfig;
        
        // Calculate total content height for vertical centering
        const messageHeight = config.message_font_size + 20;
        const countdownHeight = config.countdown_font_size + 20;
        const buttonHeight = config.button_height + 20;
        const totalHeight = messageHeight + countdownHeight + buttonHeight + config.element_spacing * 2;
        
        return {
            // Death message
            message: {
                x: center.x,
                y: center.y - totalHeight / 2 + messageHeight / 2,
                fontSize: config.message_font_size
            },
            
            // Killer info (if applicable)
            killer: {
                x: center.x,
                y: center.y - totalHeight / 2 + messageHeight + 15,
                fontSize: 16
            },
            
            // Countdown timer
            countdown: {
                x: center.x,
                y: center.y - countdownHeight / 2,
                fontSize: config.countdown_font_size
            },
            
            // Statistics display
            stats: {
                x: center.x,
                y: center.y + 30,
                fontSize: 14,
                lineHeight: 20
            },
            
            // Respawn button
            button: {
                x: center.x - config.button_width / 2,
                y: center.y + totalHeight / 2 - config.button_height,
                width: config.button_width,
                height: config.button_height
            }
        };
    }
    
    // =============================================================================
    // COMPONENT LIFECYCLE
    // =============================================================================
    
    /**
     * Update component with death state data
     * @param {number} deltaTime - Time since last update
     * @param {Object} state - External state data
     */
    update(deltaTime, state) {
        super.update(deltaTime, state);
        
        // Update death state from external data
        if (state.isDead !== undefined) {
            this.state.isDead = state.isDead;
            this.state.visible = state.isDead;
        }
        
        if (state.deathMessage !== undefined) {
            this.state.deathMessage = state.deathMessage;
        }
        
        if (state.killerName !== undefined) {
            this.state.killerName = state.killerName;
        }
        
        if (state.respawnTime !== undefined) {
            this.state.respawnTime = state.respawnTime;
        }
        
        if (state.showRespawnButton !== undefined) {
            this.state.showRespawnButton = state.showRespawnButton;
        }
        
        if (state.buttonHovered !== undefined) {
            this.state.buttonHovered = state.buttonHovered;
        }
        
        if (state.stats !== undefined) {
            this.state.stats = state.stats;
        }
        
        // Update countdown
        this.updateCountdown();
        
        // Update animations
        this.updateDeathAnimations(deltaTime);
        
        this.markDirty();
    }
    
    /**
     * Update respawn countdown
     */
    updateCountdown() {
        if (this.state.respawnTime > 0) {
            const now = Date.now();
            const timeLeft = Math.max(0, this.state.respawnTime - now);
            this.state.secondsLeft = Math.ceil(timeLeft / 1000);
            
            // Show respawn button when countdown is finished
            if (timeLeft <= 0 && !this.state.showRespawnButton) {
                this.state.showRespawnButton = true;
            }
        }
    }
    
    /**
     * Update death screen animations
     * @param {number} deltaTime - Time since last update
     */
    updateDeathAnimations(deltaTime) {
        // Fade in animation
        if (this.state.visible && this.animations.fadeIn < 1) {
            this.animations.fadeIn = Math.min(1, this.animations.fadeIn + deltaTime * 0.002);
        } else if (!this.state.visible && this.animations.fadeIn > 0) {
            this.animations.fadeIn = Math.max(0, this.animations.fadeIn - deltaTime * 0.004);
        }
        
        // General pulse animation
        this.animations.pulse += deltaTime * this.deathConfig.pulse_speed;
        if (this.animations.pulse > Math.PI * 2) {
            this.animations.pulse -= Math.PI * 2;
        }
        
        // Countdown pulse animation
        if (this.state.secondsLeft > 0) {
            this.animations.countdownPulse += deltaTime * 0.003;
            if (this.animations.countdownPulse > Math.PI * 2) {
                this.animations.countdownPulse -= Math.PI * 2;
            }
        }
        
        // Button glow animation
        if (this.state.buttonHovered) {
            this.animations.buttonGlow += deltaTime * 0.008;
            if (this.animations.buttonGlow > Math.PI * 2) {
                this.animations.buttonGlow -= Math.PI * 2;
            }
        }
    }
    
    // =============================================================================
    // RENDERING
    // =============================================================================
    
    /**
     * Draw the death screen
     * @param {Object} state - Component state
     * @param {Object} context - Rendering context
     */
    draw(state, context) {
        if (!this.state.visible || this.animations.fadeIn <= 0) {
            return;
        }
        
        this.drawBackground();
        this.drawDeathMessage();
        
        if (this.state.killerName) {
            this.drawKillerInfo();
        }
        
        if (this.state.secondsLeft > 0) {
            this.drawCountdown();
        }
        
        if (this.state.stats) {
            this.drawStatistics();
        }
        
        if (this.state.showRespawnButton) {
            this.drawRespawnButton();
        }
    }
    
    /**
     * Draw semi-transparent background overlay
     */
    drawBackground() {
        this.ctx.save();
        
        const alpha = this.deathConfig.background_alpha * this.animations.fadeIn;
        this.ctx.fillStyle = UIUtils.withAlpha(this.colors.base, alpha);
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.restore();
    }
    
    /**
     * Draw death message
     */
    drawDeathMessage() {
        const layout = this.layout.message;
        
        this.ctx.save();
        
        // Setup message text style
        this.ctx.font = `bold ${layout.fontSize}px ${this.typography.primary.family}`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.letterSpacing = '0.05em';
        
        // Draw message with glow effect
        const pulse = (Math.sin(this.animations.pulse) + 1) * 0.5;
        const glowIntensity = this.deathConfig.glow_intensity * (0.7 + pulse * 0.3);
        
        this.ctx.shadowBlur = glowIntensity;
        this.ctx.shadowColor = this.colors.error;
        this.ctx.fillStyle = this.colors.error;
        this.ctx.globalAlpha = this.animations.fadeIn;
        
        this.ctx.fillText(this.state.deathMessage, layout.x, layout.y);
        
        this.ctx.restore();
    }
    
    /**
     * Draw killer information
     */
    drawKillerInfo() {
        const layout = this.layout.killer;
        
        this.ctx.save();
        
        // Setup killer text style
        this.ctx.font = `${layout.fontSize}px ${this.typography.primary.family}`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = this.colors.uiTextDim;
        this.ctx.globalAlpha = this.animations.fadeIn * 0.8;
        
        const killerText = `Eliminated by ${this.state.killerName}`;
        this.ctx.fillText(killerText, layout.x, layout.y);
        
        this.ctx.restore();
    }
    
    /**
     * Draw respawn countdown
     */
    drawCountdown() {
        const layout = this.layout.countdown;
        
        if (this.state.secondsLeft <= 0) {
            return;
        }
        
        this.ctx.save();
        
        // Setup countdown text style
        this.ctx.font = `bold ${layout.fontSize}px ${this.typography.primary.family}`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Countdown color and glow effect
        const pulse = (Math.sin(this.animations.countdownPulse) + 1) * 0.5;
        const glowIntensity = 20 + pulse * 10;
        
        this.ctx.shadowBlur = glowIntensity;
        this.ctx.shadowColor = this.colors.accent;
        this.ctx.fillStyle = this.colors.accent;
        this.ctx.globalAlpha = this.animations.fadeIn;
        
        // Draw countdown number
        this.ctx.fillText(String(this.state.secondsLeft), layout.x, layout.y);
        
        // Draw \"respawning in\" text above countdown
        this.ctx.font = `16px ${this.typography.primary.family}`;
        this.ctx.fillStyle = this.colors.uiTextDim;
        this.ctx.shadowBlur = 0;
        this.ctx.fillText('Respawning in', layout.x, layout.y - 40);
        
        this.ctx.restore();
    }
    
    /**
     * Draw death statistics if available
     */
    drawStatistics() {
        const layout = this.layout.stats;
        const stats = this.state.stats;
        
        if (!stats) return;
        
        this.ctx.save();
        
        // Setup stats text style
        this.ctx.font = `${layout.fontSize}px ${this.typography.monospace.family}`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = this.colors.uiCyan;
        this.ctx.globalAlpha = this.animations.fadeIn * 0.8;
        
        let yOffset = 0;
        
        // Display various statistics
        if (stats.timeAlive !== undefined) {
            const timeText = `Time Alive: ${this.formatTime(stats.timeAlive)}`;\n            this.ctx.fillText(timeText, layout.x, layout.y + yOffset);\n            yOffset += layout.lineHeight;\n        }\n        \n        if (stats.damageDone !== undefined) {\n            const damageText = `Damage Done: ${stats.damageDone}`;\n            this.ctx.fillText(damageText, layout.x, layout.y + yOffset);\n            yOffset += layout.lineHeight;\n        }\n        \n        if (stats.shotsHit !== undefined && stats.shotsFired !== undefined) {\n            const accuracy = stats.shotsFired > 0 ? (stats.shotsHit / stats.shotsFired * 100).toFixed(1) : '0';\n            const accuracyText = `Accuracy: ${accuracy}%`;\n            this.ctx.fillText(accuracyText, layout.x, layout.y + yOffset);\n            yOffset += layout.lineHeight;\n        }\n        \n        this.ctx.restore();\n    }\n    \n    /**\n     * Draw respawn button\n     */\n    drawRespawnButton() {\n        const layout = this.layout.button;\n        \n        this.ctx.save();\n        \n        // Button background with hover effect\n        const isHovered = this.state.buttonHovered;\n        const glowIntensity = isHovered ? this.deathConfig.glow_intensity : 0;\n        \n        // Draw frosted glass panel\n        this.drawFrostedGlassPanel(\n            layout.x,\n            layout.y,\n            layout.width,\n            layout.height,\n            {\n                frostedAlpha: 0.15,\n                borderWidth: 1\n            }\n        );\n        \n        // Hover glow effect\n        if (isHovered) {\n            const buttonPulse = (Math.sin(this.animations.buttonGlow) + 1) * 0.5;\n            this.ctx.shadowBlur = glowIntensity * (0.7 + buttonPulse * 0.3);\n            this.ctx.shadowColor = this.colors.accent;\n            this.ctx.strokeStyle = UIUtils.withAlpha(this.colors.accent, 0.5 + buttonPulse * 0.3);\n            this.ctx.lineWidth = 1;\n            this.ctx.strokeRect(layout.x, layout.y, layout.width, layout.height);\n        }\n        \n        // Button text\n        this.ctx.font = `bold 18px ${this.typography.monospace.family}`;\n        this.ctx.textAlign = 'center';\n        this.ctx.textBaseline = 'middle';\n        this.ctx.letterSpacing = '0.1em';\n        this.ctx.fillStyle = isHovered ? this.colors.accent : this.colors.primary;\n        this.ctx.globalAlpha = this.animations.fadeIn;\n        \n        this.ctx.fillText(\n            'RESPAWN',\n            layout.x + layout.width / 2,\n            layout.y + layout.height / 2\n        );\n        \n        this.ctx.restore();\n    }\n    \n    /**\n     * Draw frosted glass panel (shared utility)\n     * @param {number} x - X position\n     * @param {number} y - Y position\n     * @param {number} width - Panel width\n     * @param {number} height - Panel height\n     * @param {Object} options - Styling options\n     */\n    drawFrostedGlassPanel(x, y, width, height, options = {}) {\n        this.ctx.save();\n        \n        const frostedAlpha = options.frostedAlpha || 0.12;\n        const borderWidth = options.borderWidth || 1;\n        \n        // Base frosted glass layer\n        this.ctx.fillStyle = UIUtils.withAlpha(this.colors.uiCyan, frostedAlpha);\n        this.ctx.fillRect(x, y, width, height);\n        \n        // Border\n        this.ctx.strokeStyle = UIUtils.withAlpha(this.colors.uiCyan, 0.8);\n        this.ctx.lineWidth = borderWidth;\n        this.ctx.strokeRect(x, y, width, height);\n        \n        this.ctx.restore();\n    }\n    \n    // =============================================================================\n    // UTILITY METHODS\n    // =============================================================================\n    \n    /**\n     * Format time in seconds to MM:SS format\n     * @param {number} seconds - Time in seconds\n     * @returns {string} Formatted time string\n     */\n    formatTime(seconds) {\n        const minutes = Math.floor(seconds / 60);\n        const remainingSeconds = seconds % 60;\n        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;\n    }\n    \n    // =============================================================================\n    // COMPONENT INTERFACE\n    // =============================================================================\n    \n    /**\n     * Show death screen with data\n     * @param {Object} deathData - Death information\n     */\n    showDeathScreen(deathData) {\n        this.state.isDead = true;\n        this.state.visible = true;\n        this.state.deathMessage = deathData.message || 'YOU WERE ELIMINATED';\n        this.state.killerName = deathData.killerName || null;\n        this.state.respawnTime = deathData.respawnTime || 0;\n        this.state.stats = deathData.stats || null;\n        this.state.showRespawnButton = false;\n        this.animations.fadeIn = 0;\n        this.markDirty();\n    }\n    \n    /**\n     * Hide death screen\n     */\n    hideDeathScreen() {\n        this.state.isDead = false;\n        this.state.visible = false;\n        this.state.showRespawnButton = false;\n        this.markDirty();\n    }\n    \n    /**\n     * Set button hover state\n     * @param {boolean} hovered - Whether button is hovered\n     */\n    setButtonHovered(hovered) {\n        if (this.state.buttonHovered !== hovered) {\n            this.state.buttonHovered = hovered;\n            this.markDirty();\n        }\n    }\n    \n    /**\n     * Get component bounds\n     * @returns {Object} Component bounds\n     */\n    getBounds() {\n        if (!this.state.visible) {\n            return UIUtils.createBounds(0, 0, 0, 0);\n        }\n        return UIUtils.createBounds(0, 0, this.canvas.width, this.canvas.height);\n    }\n    \n    /**\n     * Get respawn button bounds\n     * @returns {Object} Button bounds\n     */\n    getButtonBounds() {\n        if (!this.state.showRespawnButton) {\n            return UIUtils.createBounds(0, 0, 0, 0);\n        }\n        const button = this.layout.button;\n        return UIUtils.createBounds(button.x, button.y, button.width, button.height);\n    }\n    \n    /**\n     * Handle canvas resize\n     */\n    onResize() {\n        this.layout = this.calculateLayout();\n        this.markDirty();\n    }\n    \n    /**\n     * Get current death screen state\n     * @returns {Object} Current state\n     */\n    getState() {\n        return {\n            isDead: this.state.isDead,\n            visible: this.state.visible,\n            secondsLeft: this.state.secondsLeft,\n            showRespawnButton: this.state.showRespawnButton,\n            killerName: this.state.killerName,\n            fadeIn: this.animations.fadeIn\n        };\n    }\n}";