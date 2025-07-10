// =================================================================================
// LOGIN PANEL - Blueprint Battle UI System
// =================================================================================
// Login form component with input field, button, and error handling
// Extracted from UIManager and UIComponents for better separation of concerns

import { BaseComponent } from './BaseComponent.js';
import { UIUtils } from '../utils/UIUtils.js';

export class LoginPanel extends BaseComponent {
    constructor(canvas, ctx, config, options = {}) {
        super(canvas, ctx, config, options);
        
        // Login-specific styling
        this.loginConfig = config.ui.login_overlay;
        
        // Component state
        this.state = {
            playerName: '',
            errorMessage: '',
            inputFocused: true,
            buttonHovered: false,
            showCursor: false,
            cursorBlinkTime: 0
        };
        
        // Layout calculations
        this.layout = this.calculateLayout();
        
        // Animation state
        this.animations = {
            glowPulse: 0,
            titleGlow: 0,
            cursorBlink: 0
        };
        
        console.log('LoginPanel initialized');
    }
    
    // =============================================================================
    // LAYOUT CALCULATIONS
    // =============================================================================
    
    /**
     * Calculate component layout based on canvas size
     * @returns {Object} Layout object with positions and dimensions
     */
    calculateLayout() {
        const center = UIUtils.getCenter(this.canvas);
        
        const inputWidth = this.loginConfig.input_width;
        const inputHeight = this.loginConfig.input_height;
        const buttonWidth = this.loginConfig.button_width;
        const buttonHeight = this.loginConfig.button_height;
        const spacing = this.loginConfig.element_spacing;
        
        // Calculate total height for vertical centering
        const titleHeight = this.loginConfig.title_font_size + 20;
        const totalHeight = titleHeight + spacing + inputHeight + spacing + buttonHeight;
        
        return {
            // Title
            title: {
                x: center.x,
                y: center.y - totalHeight / 2 + titleHeight / 2,
                fontSize: this.loginConfig.title_font_size
            },
            
            // Input field
            input: {
                x: center.x - inputWidth / 2,
                y: center.y - inputHeight / 2 - spacing / 2,
                width: inputWidth,
                height: inputHeight
            },
            
            // Play button
            button: {
                x: center.x - buttonWidth / 2,
                y: center.y + spacing / 2,
                width: buttonWidth,
                height: buttonHeight
            },
            
            // Error message
            error: {
                x: center.x,
                y: center.y + spacing / 2 + buttonHeight + 30
            }
        };
    }
    
    // =============================================================================
    // COMPONENT LIFECYCLE
    // =============================================================================
    
    /**
     * Update component state and animations
     * @param {number} deltaTime - Time since last update
     * @param {Object} state - External state data
     */
    update(deltaTime, state) {
        super.update(deltaTime, state);
        
        // Update state from external data
        if (state.playerName !== undefined) {
            this.state.playerName = state.playerName;
        }
        if (state.errorMessage !== undefined) {
            this.state.errorMessage = state.errorMessage;
        }
        if (state.inputFocused !== undefined) {
            this.state.inputFocused = state.inputFocused;
        }
        
        // Update animations
        this.updateLoginAnimations(deltaTime);
        
        // Mark dirty if state changed
        this.markDirty();
    }
    
    /**
     * Update login-specific animations
     * @param {number} deltaTime - Time since last update
     */
    updateLoginAnimations(deltaTime) {
        // Glow pulse animation
        this.animations.glowPulse += deltaTime * 0.005;
        if (this.animations.glowPulse > Math.PI * 2) {
            this.animations.glowPulse -= Math.PI * 2;
        }
        
        // Title glow animation
        this.animations.titleGlow += deltaTime * 0.003;
        if (this.animations.titleGlow > Math.PI * 2) {
            this.animations.titleGlow -= Math.PI * 2;
        }
        
        // Cursor blink animation
        if (this.state.inputFocused) {
            this.animations.cursorBlink += deltaTime;
            this.state.showCursor = (this.animations.cursorBlink % 1000) < 500;
        } else {
            this.state.showCursor = false;
        }
    }
    
    // =============================================================================
    // RENDERING
    // =============================================================================
    
    /**
     * Draw the login panel
     * @param {Object} state - Component state
     * @param {Object} context - Rendering context
     */
    draw(state, context) {
        this.drawBackground();
        this.drawTitle();
        this.drawInputField();
        this.drawPlayButton();
        
        if (this.state.errorMessage) {
            this.drawErrorMessage();
        }
    }
    
    /**
     * Draw background overlay
     */
    drawBackground() {
        this.ctx.save();
        
        // Semi-transparent background
        this.ctx.fillStyle = this.colors.base;
        this.ctx.globalAlpha = this.loginConfig.background_alpha;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.restore();
    }
    
    /**
     * Draw login title
     */
    drawTitle() {
        this.ctx.save();
        
        const titleLayout = this.layout.title;
        const glowIntensity = this.loginConfig.title_glow_intensity;
        const titleGlow = (Math.sin(this.animations.titleGlow) + 1) * 0.5;
        
        // Setup title font
        this.ctx.font = `bold ${titleLayout.fontSize}px ${this.typography.title.family}`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.letterSpacing = this.typography.title.letterSpacing;
        
        // Draw title with glow effect
        this.ctx.shadowBlur = glowIntensity * (0.5 + titleGlow * 0.5);
        this.ctx.shadowColor = this.colors.accent;
        this.ctx.fillStyle = this.colors.primary;
        this.ctx.fillText('BLUEPRINT BATTLE', titleLayout.x, titleLayout.y);
        
        this.ctx.restore();
    }
    
    /**
     * Draw input field
     */
    drawInputField() {
        const inputLayout = this.layout.input;
        
        this.ctx.save();
        
        // Draw frosted glass background
        this.drawFrostedGlassPanel(
            inputLayout.x, 
            inputLayout.y, 
            inputLayout.width, 
            inputLayout.height,
            {
                frostedAlpha: this.loginConfig.input_background_alpha,
                borderWidth: this.loginConfig.border_width
            }
        );
        
        // Setup text for input
        this.ctx.font = `${this.loginConfig.font_size}px ${this.typography.monospace.family}`;
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        this.ctx.letterSpacing = this.typography.monospace.letterSpacing;
        
        // Draw input text
        if (this.state.playerName) {
            this.ctx.fillStyle = this.colors.primary;
            this.ctx.fillText(
                this.state.playerName,
                inputLayout.x + this.loginConfig.padding_vertical,
                inputLayout.y + inputLayout.height / 2
            );
        } else {
            // Placeholder text
            this.ctx.fillStyle = this.colors.uiTextDim;
            this.ctx.fillText(
                'Enter your name...',
                inputLayout.x + this.loginConfig.padding_vertical,
                inputLayout.y + inputLayout.height / 2
            );
        }
        
        // Draw cursor if focused
        if (this.state.inputFocused && this.state.showCursor && this.state.playerName) {
            const textWidth = this.ctx.measureText(this.state.playerName).width;
            this.ctx.fillStyle = this.colors.accent;
            this.ctx.fillRect(
                inputLayout.x + this.loginConfig.padding_vertical + textWidth + 2,
                inputLayout.y + inputLayout.height / 2 - this.loginConfig.font_size / 2,
                2,
                this.loginConfig.font_size
            );
        }
        
        // Focus glow effect
        if (this.state.inputFocused) {
            const pulse = this.getPulse();
            this.ctx.shadowBlur = this.loginConfig.glow_intensity * (0.5 + pulse * 0.5);
            this.ctx.shadowColor = this.colors.accent;
            this.ctx.strokeStyle = UIUtils.withAlpha(this.colors.accent, 0.3 + pulse * 0.3);
            this.ctx.lineWidth = this.loginConfig.border_width;
            this.ctx.strokeRect(inputLayout.x, inputLayout.y, inputLayout.width, inputLayout.height);
        }
        
        this.ctx.restore();
    }
    
    /**
     * Draw play button
     */
    drawPlayButton() {
        const buttonLayout = this.layout.button;
        
        this.ctx.save();
        
        // Determine button state styling
        const isHovered = this.state.buttonHovered;
        const glowIntensity = isHovered ? this.loginConfig.glow_intensity : 0;
        const innerGlowAlpha = isHovered ? this.loginConfig.button_inner_glow_alpha : 0;
        
        // Draw frosted glass background
        this.drawFrostedGlassPanel(
            buttonLayout.x, 
            buttonLayout.y, 
            buttonLayout.width, 
            buttonLayout.height,
            {
                frostedAlpha: this.loginConfig.frosted_glass_alpha + innerGlowAlpha,
                borderWidth: this.loginConfig.border_width
            }
        );
        
        // Hover glow effect
        if (isHovered) {
            const pulse = this.getPulse();
            this.ctx.shadowBlur = glowIntensity * (0.7 + pulse * 0.3);
            this.ctx.shadowColor = this.colors.accent;
            this.ctx.strokeStyle = UIUtils.withAlpha(this.colors.accent, 0.5 + pulse * 0.3);
            this.ctx.lineWidth = this.loginConfig.border_width;
            this.ctx.strokeRect(buttonLayout.x, buttonLayout.y, buttonLayout.width, buttonLayout.height);
        }
        
        // Draw button text
        this.ctx.font = `bold ${this.loginConfig.font_size}px ${this.typography.monospace.family}`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.letterSpacing = this.typography.title.letterSpacing;
        this.ctx.fillStyle = isHovered ? this.colors.accent : this.colors.primary;
        this.ctx.fillText(
            'PLAY',
            buttonLayout.x + buttonLayout.width / 2,
            buttonLayout.y + buttonLayout.height / 2
        );
        
        this.ctx.restore();
    }
    
    /**
     * Draw error message
     */
    drawErrorMessage() {
        if (!this.state.errorMessage) return;
        
        this.ctx.save();
        
        const errorLayout = this.layout.error;
        
        // Setup error text style
        this.ctx.font = `${this.loginConfig.font_size}px ${this.typography.primary.family}`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = this.colors.error;
        
        // Draw error text with subtle glow
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = this.colors.error;
        this.ctx.fillText(this.state.errorMessage, errorLayout.x, errorLayout.y);
        
        this.ctx.restore();
    }
    
    /**
     * Draw frosted glass panel (extracted from UIComponents)
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Panel width
     * @param {number} height - Panel height
     * @param {Object} options - Styling options
     */
    drawFrostedGlassPanel(x, y, width, height, options = {}) {
        this.ctx.save();
        
        const frostedAlpha = options.frostedAlpha || this.loginConfig.frosted_glass_alpha;
        const borderWidth = options.borderWidth || this.loginConfig.border_width;
        
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
    // INTERACTION HANDLING
    // =============================================================================
    
    /**
     * Set button hover state
     * @param {boolean} hovered - Whether button is hovered
     */
    setButtonHovered(hovered) {
        if (this.state.buttonHovered !== hovered) {
            this.state.buttonHovered = hovered;
            this.markDirty();
        }
    }
    
    /**
     * Set input focus state
     * @param {boolean} focused - Whether input is focused
     */
    setInputFocused(focused) {
        if (this.state.inputFocused !== focused) {
            this.state.inputFocused = focused;
            if (focused) {
                this.animations.cursorBlink = 0;
            }
            this.markDirty();
        }
    }
    
    /**
     * Update player name
     * @param {string} name - New player name
     */
    updatePlayerName(name) {
        if (this.state.playerName !== name) {
            this.state.playerName = name;
            this.state.errorMessage = ''; // Clear error on input change
            this.markDirty();
        }
    }
    
    /**
     * Set error message
     * @param {string} message - Error message to display
     */
    setError(message) {
        if (this.state.errorMessage !== message) {
            this.state.errorMessage = message;
            this.markDirty();
        }
    }
    
    /**
     * Validate input and return validation result
     * @returns {Object} Validation result {valid, error}
     */
    validateInput() {
        const name = this.state.playerName.trim();
        
        if (!name) {
            return { valid: false, error: 'Please enter your name' };
        }
        
        if (name.length < 2) {
            return { valid: false, error: 'Name must be at least 2 characters' };
        }
        
        if (name.length > 20) {
            return { valid: false, error: 'Name must be 20 characters or less' };
        }
        
        return { valid: true, error: null };
    }
    
    // =============================================================================
    // COMPONENT INTERFACE
    // =============================================================================
    
    /**
     * Get component bounds for interaction
     * @returns {Object} Combined bounds of interactive elements
     */
    getBounds() {
        return UIUtils.createBounds(0, 0, this.canvas.width, this.canvas.height);
    }
    
    /**
     * Get input field bounds
     * @returns {Object} Input field bounds
     */
    getInputBounds() {
        const input = this.layout.input;
        return UIUtils.createBounds(input.x, input.y, input.width, input.height);
    }
    
    /**
     * Get button bounds
     * @returns {Object} Button bounds
     */
    getButtonBounds() {
        const button = this.layout.button;
        return UIUtils.createBounds(button.x, button.y, button.width, button.height);
    }
    
    /**
     * Handle canvas resize
     */
    onResize() {
        this.layout = this.calculateLayout();
        this.markDirty();
    }
    
    /**
     * Get current state for external access
     * @returns {Object} Current component state
     */
    getState() {
        return { ...this.state };
    }
}