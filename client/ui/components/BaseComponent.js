// =================================================================================
// BASE COMPONENT - Blueprint Battle UI System
// =================================================================================
// Abstract base class for all UI components providing common functionality
// Handles canvas state management, dirty checking, and theme integration

export class BaseComponent {
    constructor(canvas, ctx, config, options = {}) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.config = config;
        this.options = options;
        
        // Component state
        this.dirty = true;
        this.visible = true;
        this.alpha = 1.0;
        
        // Canvas state stack for proper isolation
        this.stateStack = [];
        
        // Theme and styling shortcuts
        this.colors = this.setupColors(config);
        this.typography = this.setupTypography(config);
        
        // Animation state
        this.animationState = {
            pulse: 0,
            fade: 0,
            lastUpdate: 0
        };
    }
    
    // =============================================================================
    // ABSTRACT METHODS - Override in subclasses
    // =============================================================================
    
    /**
     * Render the component - override in subclasses
     * @param {Object} state - Component state data
     * @param {Object} context - Additional rendering context
     */
    draw(state, context) {
        throw new Error('BaseComponent.draw() must be implemented by subclass');
    }
    
    /**
     * Update component logic - override if needed
     * @param {number} deltaTime - Time since last update
     * @param {Object} state - Component state data
     */
    update(deltaTime, state) {
        // Base implementation updates animation state
        this.updateAnimations(deltaTime);
    }
    
    // =============================================================================
    // CANVAS STATE MANAGEMENT
    // =============================================================================
    
    /**
     * Save current canvas state with isolation
     */
    saveState() {
        this.ctx.save();
        this.stateStack.push({
            fillStyle: this.ctx.fillStyle,
            strokeStyle: this.ctx.strokeStyle,
            globalAlpha: this.ctx.globalAlpha,
            shadowBlur: this.ctx.shadowBlur,
            shadowColor: this.ctx.shadowColor,
            font: this.ctx.font,
            textAlign: this.ctx.textAlign,
            textBaseline: this.ctx.textBaseline,
            lineWidth: this.ctx.lineWidth
        });
    }
    
    /**
     * Restore previous canvas state
     */
    restoreState() {
        this.ctx.restore();
        if (this.stateStack.length > 0) {
            this.stateStack.pop();
        }
    }
    
    // =============================================================================
    // RENDERING COORDINATION
    // =============================================================================
    
    /**
     * Main render method with dirty checking and state management
     * @param {Object} state - Component state data
     * @param {Object} context - Additional rendering context
     */
    render(state, context = {}) {
        if (!this.visible || this.alpha <= 0) {
            return false;
        }
        
        // Skip render if not dirty (optimization)
        if (!this.dirty && !context.forceRender) {
            return false;
        }
        
        this.saveState();
        
        try {
            // Apply component alpha
            if (this.alpha < 1.0) {
                this.ctx.globalAlpha *= this.alpha;
            }
            
            // Call subclass implementation
            this.draw(state, context);
            
            // Mark as clean after successful render
            this.dirty = false;
            
        } finally {
            this.restoreState();
        }
        
        return true;
    }
    
    // =============================================================================
    // THEME AND STYLING
    // =============================================================================
    
    /**
     * Setup color palette for component
     * @param {Object} config - Configuration object
     * @returns {Object} Color palette
     */
    setupColors(config) {
        return {
            base: config.colors.base,
            primary: config.colors.primary,
            primaryDim: config.colors.primary_dim,
            accent: config.colors.accent_cyan,
            error: config.colors.accent_error,
            white: config.colors.white,
            uiCyan: config.colors.ui_cyan,
            uiBackground: config.colors.ui_background,
            uiBorder: config.colors.ui_border,
            uiTextDim: config.colors.ui_text_dim
        };
    }
    
    /**
     * Setup typography system for component
     * @param {Object} config - Configuration object
     * @returns {Object} Typography system
     */
    setupTypography(config) {
        return {
            primary: {
                family: config.typography.primary_font,
                weight: config.typography.weights?.semibold || 600,
                letterSpacing: config.typography.letter_spacing?.normal || '0em'
            },
            title: {
                family: config.typography.title_font,
                weight: config.typography.weights?.bold || 700,
                letterSpacing: config.typography.letter_spacing?.wider || '0.08em'
            },
            monospace: {
                family: config.typography.monospace_font,
                weight: config.typography.weights?.regular || 400,
                letterSpacing: config.typography.letter_spacing?.wide || '0.05em'
            }
        };
    }
    
    // =============================================================================
    // ANIMATION SYSTEM
    // =============================================================================
    
    /**
     * Update component animations
     * @param {number} deltaTime - Time since last update in milliseconds
     */
    updateAnimations(deltaTime) {
        this.animationState.lastUpdate = Date.now();
        
        // Update pulse animation
        this.animationState.pulse += deltaTime * 0.005;
        if (this.animationState.pulse > Math.PI * 2) {
            this.animationState.pulse -= Math.PI * 2;
        }
        
        // Mark dirty if animations are active
        if (this.hasActiveAnimations()) {
            this.markDirty();
        }
    }
    
    /**
     * Check if component has active animations
     * @returns {boolean} True if animations are active
     */
    hasActiveAnimations() {
        return this.animationState.pulse > 0 || this.animationState.fade > 0;
    }
    
    /**
     * Get current pulse value for glow effects
     * @returns {number} Pulse value (0-1)
     */
    getPulse() {
        return (Math.sin(this.animationState.pulse) + 1) * 0.5;
    }
    
    // =============================================================================
    // COMPONENT LIFECYCLE
    // =============================================================================
    
    /**
     * Mark component as needing re-render
     */
    markDirty() {
        this.dirty = true;
    }
    
    /**
     * Set component visibility
     * @param {boolean} visible - Whether component should be visible
     */
    setVisible(visible) {
        if (this.visible !== visible) {
            this.visible = visible;
            this.markDirty();
        }
    }
    
    /**
     * Set component alpha
     * @param {number} alpha - Alpha value (0-1)
     */
    setAlpha(alpha) {
        alpha = Math.max(0, Math.min(1, alpha));
        if (this.alpha !== alpha) {
            this.alpha = alpha;
            this.markDirty();
        }
    }
    
    /**
     * Get component bounds for interaction
     * @returns {Object} Bounds object {x, y, width, height}
     */
    getBounds() {
        return { x: 0, y: 0, width: 0, height: 0 };
    }
    
    /**
     * Check if point is within component bounds
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean} True if point is within bounds
     */
    isPointInBounds(x, y) {
        const bounds = this.getBounds();
        return x >= bounds.x && 
               x <= bounds.x + bounds.width && 
               y >= bounds.y && 
               y <= bounds.y + bounds.height;
    }
    
    /**
     * Cleanup component resources
     */
    cleanup() {
        this.stateStack = [];
        this.visible = false;
        this.dirty = false;
    }
    
    /**
     * Get component debug info
     * @returns {Object} Debug information
     */
    getDebugInfo() {
        return {
            className: this.constructor.name,
            visible: this.visible,
            dirty: this.dirty,
            alpha: this.alpha,
            bounds: this.getBounds(),
            hasAnimations: this.hasActiveAnimations()
        };
    }
}