// =================================================================================
// UI RENDERER - Blueprint Battle UI System
// =================================================================================
// Centralized rendering coordination and optimization for UI components
// Handles background patterns, performance monitoring, and render scheduling

export class UIRenderer {
    constructor(canvas, ctx, config) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.config = config;
        
        // Background pattern cache
        this.backgroundPattern = null;
        this.backgroundNeedsUpdate = true;
        
        // Registered components
        this.components = new Map();
        this.renderOrder = [];
        
        // Performance tracking
        this.performance = {
            lastRenderTime: 0,
            renderCount: 0,
            avgRenderTime: 0,
            componentsRendered: 0,
            componentsSkipped: 0,
            lastFrameTime: 0
        };
        
        // Render state
        this.renderState = {
            currentFrame: 0,
            isRendering: false,
            needsFullRedraw: true,
            viewportBounds: this.getViewportBounds()
        };
        
        // Optimization settings
        this.optimization = {
            enableDirtyChecking: true,
            enableViewportCulling: true,
            enablePerformanceMonitoring: true,
            targetFPS: 60,
            maxRenderTime: 16.67 // ~60 FPS
        };
        
        this.initializeBackgroundPattern();
        
        console.log('UIRenderer initialized');
    }
    
    // =============================================================================
    // COMPONENT REGISTRATION
    // =============================================================================
    
    /**
     * Register a UI component for rendering
     * @param {string} id - Unique component identifier
     * @param {Object} component - Component instance
     * @param {number} zIndex - Rendering order (higher = rendered later)
     */
    registerComponent(id, component, zIndex = 0) {
        this.components.set(id, {
            id,
            component,
            zIndex,
            enabled: true,
            visible: true,
            lastRendered: 0
        });
        
        // Update render order
        this.updateRenderOrder();
        
        console.log(`UIRenderer: Registered component '${id}' with zIndex ${zIndex}`);
    }
    
    /**
     * Unregister a UI component
     * @param {string} id - Component identifier
     */
    unregisterComponent(id) {
        this.components.delete(id);
        this.updateRenderOrder();
        
        console.log(`UIRenderer: Unregistered component '${id}'`);
    }
    
    /**
     * Update the rendering order based on zIndex
     */
    updateRenderOrder() {
        this.renderOrder = Array.from(this.components.values())
            .sort((a, b) => a.zIndex - b.zIndex)
            .map(comp => comp.id);
    }
    
    /**
     * Set component visibility
     * @param {string} id - Component identifier
     * @param {boolean} visible - Visibility state
     */
    setComponentVisible(id, visible) {
        const comp = this.components.get(id);
        if (comp) {
            comp.visible = visible;
            if (visible) {
                this.requestFullRedraw();
            }
        }
    }
    
    /**
     * Enable or disable a component
     * @param {string} id - Component identifier
     * @param {boolean} enabled - Enabled state
     */
    setComponentEnabled(id, enabled) {
        const comp = this.components.get(id);
        if (comp) {
            comp.enabled = enabled;
        }
    }
    
    // =============================================================================
    // BACKGROUND PATTERN MANAGEMENT
    // =============================================================================
    
    /**
     * Initialize background pattern
     */
    initializeBackgroundPattern() {
        this.createBackgroundPattern();
    }
    
    /**
     * Create the background dot pattern
     */
    createBackgroundPattern() {
        const cellSize = this.config.background_pattern.cell_size;
        const dotRadius = this.config.background_pattern.dot_radius;
        const dotAlpha = this.config.background_pattern.dot_alpha;
        
        // Create pattern canvas
        const patternCanvas = document.createElement('canvas');
        patternCanvas.width = cellSize;
        patternCanvas.height = cellSize;
        const patternCtx = patternCanvas.getContext('2d');
        
        // Draw dot in center
        patternCtx.fillStyle = this.config.colors.primary_dim || '#3A5F7F';
        patternCtx.globalAlpha = dotAlpha;
        patternCtx.beginPath();
        patternCtx.arc(cellSize / 2, cellSize / 2, dotRadius, 0, Math.PI * 2);
        patternCtx.fill();
        
        // Create pattern
        this.backgroundPattern = this.ctx.createPattern(patternCanvas, 'repeat');
        this.backgroundNeedsUpdate = false;
        
        console.log('UIRenderer: Background pattern created');
    }
    
    /**
     * Render background pattern
     */
    renderBackground() {
        if (!this.backgroundPattern && this.backgroundNeedsUpdate) {
            this.createBackgroundPattern();
        }
        
        if (this.backgroundPattern) {
            this.ctx.save();
            this.ctx.fillStyle = this.config.colors.base || '#000000';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = this.backgroundPattern;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.restore();
        }
    }
    
    // =============================================================================
    // RENDERING COORDINATION
    // =============================================================================
    
    /**
     * Main render method
     * @param {Object} state - Global UI state
     * @param {Object} context - Additional rendering context
     */
    render(state, context = {}) {
        if (this.renderState.isRendering) {
            console.warn('UIRenderer: Render called while already rendering');
            return;
        }
        
        const startTime = performance.now();
        this.renderState.isRendering = true;
        this.renderState.currentFrame++;
        
        try {
            // Clear canvas if needed
            if (this.renderState.needsFullRedraw || context.forceFullRedraw) {
                this.clearCanvas();
                this.renderBackground();
                this.renderState.needsFullRedraw = false;
            }
            
            // Render components in order
            this.renderComponents(state, context);
            
        } finally {
            this.renderState.isRendering = false;
            this.updatePerformanceStats(startTime);
        }
    }
    
    /**
     * Render all registered components
     * @param {Object} state - Global UI state
     * @param {Object} context - Rendering context
     */
    renderComponents(state, context) {
        let componentsRendered = 0;
        let componentsSkipped = 0;
        
        for (const componentId of this.renderOrder) {
            const comp = this.components.get(componentId);
            
            if (!comp || !comp.enabled || !comp.visible) {
                componentsSkipped++;
                continue;
            }
            
            // Viewport culling (if enabled)
            if (this.optimization.enableViewportCulling && comp.component.getBounds) {
                const bounds = comp.component.getBounds();
                if (!this.isInViewport(bounds)) {
                    componentsSkipped++;
                    continue;
                }
            }
            
            // Render component
            try {
                const componentState = state[componentId] || {};
                const rendered = comp.component.render(componentState, context);
                
                if (rendered) {
                    comp.lastRendered = this.renderState.currentFrame;
                    componentsRendered++;
                } else {
                    componentsSkipped++;
                }
                
            } catch (error) {
                console.error(`UIRenderer: Error rendering component '${componentId}':`, error);
                componentsSkipped++;
            }
        }
        
        this.performance.componentsRendered = componentsRendered;
        this.performance.componentsSkipped = componentsSkipped;
    }
    
    /**
     * Clear the entire canvas
     */
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    /**
     * Request a full redraw on next render
     */
    requestFullRedraw() {
        this.renderState.needsFullRedraw = true;
    }
    
    // =============================================================================
    // VIEWPORT AND CULLING
    // =============================================================================
    
    /**
     * Get current viewport bounds
     * @returns {Object} Viewport bounds
     */
    getViewportBounds() {
        return {
            x: 0,
            y: 0,
            width: this.canvas.width,
            height: this.canvas.height
        };
    }
    
    /**
     * Check if bounds intersect with viewport
     * @param {Object} bounds - Object bounds to check
     * @returns {boolean} True if object is in viewport
     */
    isInViewport(bounds) {
        const viewport = this.getViewportBounds();
        
        return !(bounds.x + bounds.width < viewport.x ||
                bounds.x > viewport.x + viewport.width ||
                bounds.y + bounds.height < viewport.y ||
                bounds.y > viewport.y + viewport.height);
    }
    
    /**
     * Update viewport bounds (call on resize)
     */
    updateViewportBounds() {
        this.renderState.viewportBounds = this.getViewportBounds();
        this.requestFullRedraw();
    }
    
    // =============================================================================
    // PERFORMANCE MONITORING
    // =============================================================================
    
    /**
     * Update performance statistics
     * @param {number} startTime - Render start time
     */
    updatePerformanceStats(startTime) {
        if (!this.optimization.enablePerformanceMonitoring) {
            return;
        }
        
        const renderTime = performance.now() - startTime;
        this.performance.lastRenderTime = renderTime;
        this.performance.renderCount++;
        
        // Calculate rolling average
        const alpha = 0.1; // Smoothing factor
        this.performance.avgRenderTime = 
            this.performance.avgRenderTime * (1 - alpha) + renderTime * alpha;
        
        // Performance warnings
        if (renderTime > this.optimization.maxRenderTime) {
            console.warn(`UIRenderer: Slow render detected: ${renderTime.toFixed(2)}ms`);
        }
        
        this.performance.lastFrameTime = Date.now();
    }
    
    /**
     * Get performance statistics
     * @returns {Object} Performance data
     */
    getPerformanceStats() {
        return { ...this.performance };
    }
    
    /**
     * Reset performance statistics
     */
    resetPerformanceStats() {
        this.performance = {
            lastRenderTime: 0,
            renderCount: 0,
            avgRenderTime: 0,
            componentsRendered: 0,
            componentsSkipped: 0,
            lastFrameTime: Date.now()
        };
    }
    
    /**
     * Get current FPS estimate
     * @returns {number} Estimated FPS
     */
    getEstimatedFPS() {
        if (this.performance.avgRenderTime <= 0) {
            return 0;
        }
        return Math.min(60, 1000 / this.performance.avgRenderTime);
    }
    
    // =============================================================================
    // OPTIMIZATION SETTINGS
    // =============================================================================
    
    /**
     * Configure optimization settings
     * @param {Object} settings - Optimization settings
     */
    setOptimizationSettings(settings) {
        this.optimization = { ...this.optimization, ...settings };
    }
    
    /**
     * Enable or disable dirty checking
     * @param {boolean} enabled - Enable dirty checking
     */
    setDirtyCheckingEnabled(enabled) {
        this.optimization.enableDirtyChecking = enabled;
        if (!enabled) {
            this.requestFullRedraw();
        }
    }
    
    /**
     * Enable or disable viewport culling
     * @param {boolean} enabled - Enable viewport culling
     */
    setViewportCullingEnabled(enabled) {
        this.optimization.enableViewportCulling = enabled;
    }
    
    // =============================================================================
    // LIFECYCLE AND UTILITIES
    // =============================================================================
    
    /**
     * Handle canvas resize
     */
    onResize() {
        this.updateViewportBounds();
        this.backgroundNeedsUpdate = true;
        this.requestFullRedraw();
        
        console.log('UIRenderer: Canvas resized, requesting full redraw');
    }
    
    /**
     * Get debug information
     * @returns {Object} Debug info
     */
    getDebugInfo() {
        return {
            components: Array.from(this.components.keys()),
            renderOrder: [...this.renderOrder],
            performance: this.getPerformanceStats(),
            optimization: { ...this.optimization },
            renderState: { ...this.renderState },
            estimatedFPS: this.getEstimatedFPS()
        };
    }
    
    /**
     * Cleanup resources
     */
    cleanup() {
        this.components.clear();
        this.renderOrder = [];
        this.backgroundPattern = null;
        this.renderState.isRendering = false;
        
        console.log('UIRenderer: Cleanup completed');
    }
}