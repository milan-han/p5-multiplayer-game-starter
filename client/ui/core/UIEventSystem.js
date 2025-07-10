// =================================================================================
// UI EVENT SYSTEM - Blueprint Battle UI System
// =================================================================================
// Centralized event handling system for all UI interactions
// Provides efficient event delegation and spatial lookup for interactive elements

export class UIEventSystem {
    constructor(canvas, config) {
        this.canvas = canvas;
        this.config = config;
        
        // Interactive elements registry
        this.interactiveElements = new Map();
        
        // Event handler registry  
        this.eventHandlers = new Map();
        
        // Current interaction state
        this.interactionState = {
            mouseX: 0,
            mouseY: 0,
            mousePressed: false,
            hoveredElement: null,
            focusedElement: null,
            keyPressed: new Set()
        };
        
        // Cursor state management
        this.cursorState = {
            type: 'default',
            needsUpdate: false
        };
        
        // Event delegation functions (bound to this)
        this.boundHandlers = {
            mouseMove: (e) => this.handleMouseMove(e),
            mouseClick: (e) => this.handleMouseClick(e),
            mouseDown: (e) => this.handleMouseDown(e),
            mouseUp: (e) => this.handleMouseUp(e),
            keyDown: (e) => this.handleKeyDown(e),
            keyUp: (e) => this.handleKeyUp(e)
        };
        
        // Performance tracking
        this.stats = {
            eventsProcessed: 0,
            spatialQueries: 0,
            lastResetTime: Date.now()
        };
        
        console.log('UIEventSystem initialized');
    }
    
    // =============================================================================
    // EVENT HANDLER REGISTRATION
    // =============================================================================
    
    /**
     * Register event handlers for specific UI states
     * @param {string} state - UI state name
     * @param {Object} handlers - Handler functions for this state
     */
    registerHandlers(state, handlers) {
        this.eventHandlers.set(state, {
            onMouseClick: handlers.onMouseClick || null,
            onKeyDown: handlers.onKeyDown || null,
            onKeyUp: handlers.onKeyUp || null,
            onMouseMove: handlers.onMouseMove || null,
            onInteraction: handlers.onInteraction || null
        });
    }
    
    /**
     * Unregister handlers for a specific state
     * @param {string} state - UI state name
     */
    unregisterHandlers(state) {
        this.eventHandlers.delete(state);
    }
    
    /**
     * Activate event listeners for canvas
     */
    activateEventListeners() {
        // Mouse events (always active for UI interaction)
        this.canvas.addEventListener('mousemove', this.boundHandlers.mouseMove);
        this.canvas.addEventListener('click', this.boundHandlers.mouseClick);
        this.canvas.addEventListener('mousedown', this.boundHandlers.mouseDown);
        this.canvas.addEventListener('mouseup', this.boundHandlers.mouseUp);
        
        // Keyboard events (document-level for accessibility)
        document.addEventListener('keydown', this.boundHandlers.keyDown);
        document.addEventListener('keyup', this.boundHandlers.keyUp);
        
        console.log('UIEventSystem: Event listeners activated');
    }
    
    /**
     * Deactivate event listeners
     */
    deactivateEventListeners() {
        this.canvas.removeEventListener('mousemove', this.boundHandlers.mouseMove);
        this.canvas.removeEventListener('click', this.boundHandlers.mouseClick);
        this.canvas.removeEventListener('mousedown', this.boundHandlers.mouseDown);
        this.canvas.removeEventListener('mouseup', this.boundHandlers.mouseUp);
        
        document.removeEventListener('keydown', this.boundHandlers.keyDown);
        document.removeEventListener('keyup', this.boundHandlers.keyUp);
        
        console.log('UIEventSystem: Event listeners deactivated');
    }
    
    // =============================================================================
    // INTERACTIVE ELEMENT MANAGEMENT
    // =============================================================================
    
    /**
     * Register an interactive element for event handling
     * @param {string} id - Unique element identifier
     * @param {Object} bounds - Element bounds {x, y, width, height}
     * @param {string} type - Element type ('button', 'input', 'panel')
     * @param {Function} callback - Callback function for interactions
     * @param {Object} options - Additional options
     */
    registerInteractiveElement(id, bounds, type, callback, options = {}) {
        this.interactiveElements.set(id, {
            id,
            bounds: { ...bounds },
            type,
            callback,
            hovered: false,
            pressed: false,
            enabled: options.enabled !== false,
            cursor: options.cursor || (type === 'button' ? 'pointer' : 'default'),
            tooltip: options.tooltip || null,
            zIndex: options.zIndex || 0
        });
    }
    
    /**
     * Unregister an interactive element
     * @param {string} id - Element identifier
     */
    unregisterInteractiveElement(id) {
        const element = this.interactiveElements.get(id);
        if (element && element === this.interactionState.hoveredElement) {
            this.interactionState.hoveredElement = null;
            this.updateCursor('default');
        }
        this.interactiveElements.delete(id);
    }
    
    /**
     * Update bounds for an existing interactive element
     * @param {string} id - Element identifier
     * @param {Object} bounds - New bounds {x, y, width, height}
     */
    updateElementBounds(id, bounds) {
        const element = this.interactiveElements.get(id);
        if (element) {
            element.bounds = { ...bounds };
        }
    }
    
    /**
     * Enable or disable an interactive element
     * @param {string} id - Element identifier
     * @param {boolean} enabled - Whether element is enabled
     */
    setElementEnabled(id, enabled) {
        const element = this.interactiveElements.get(id);
        if (element) {
            element.enabled = enabled;
            if (!enabled && element === this.interactionState.hoveredElement) {
                this.interactionState.hoveredElement = null;
                this.updateCursor('default');
            }
        }
    }
    
    // =============================================================================
    // EVENT HANDLING
    // =============================================================================
    
    /**
     * Handle mouse move events
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        this.interactionState.mouseX = x;
        this.interactionState.mouseY = y;
        
        // Update interactive element hover states
        this.updateInteractiveElementStates(x, y);
        
        this.stats.eventsProcessed++;
    }
    
    /**
     * Handle mouse click events
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseClick(event) {
        const x = this.interactionState.mouseX;
        const y = this.interactionState.mouseY;
        
        // Find clicked interactive element
        const clickedElement = this.findInteractiveElementAt(x, y);
        
        if (clickedElement && clickedElement.enabled) {
            // Call element callback
            if (clickedElement.callback) {
                const handled = clickedElement.callback(event, clickedElement);
                if (handled) {
                    event.preventDefault();
                    this.stats.eventsProcessed++;
                    return true;
                }
            }
        }
        
        this.stats.eventsProcessed++;
        return false;
    }
    
    /**
     * Handle mouse down events
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseDown(event) {
        this.interactionState.mousePressed = true;
        
        const element = this.findInteractiveElementAt(
            this.interactionState.mouseX, 
            this.interactionState.mouseY
        );
        
        if (element && element.enabled) {
            element.pressed = true;
        }
    }
    
    /**
     * Handle mouse up events
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseUp(event) {
        this.interactionState.mousePressed = false;
        
        // Reset pressed state for all elements
        for (const element of this.interactiveElements.values()) {
            element.pressed = false;
        }
    }
    
    /**
     * Handle key down events
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyDown(event) {
        this.interactionState.keyPressed.add(event.key);
        
        // Delegate to current state handlers
        for (const handlers of this.eventHandlers.values()) {
            if (handlers.onKeyDown) {
                const handled = handlers.onKeyDown(event.key, event);
                if (handled) {
                    event.preventDefault();
                    break;
                }
            }
        }
        
        this.stats.eventsProcessed++;
    }
    
    /**
     * Handle key up events
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyUp(event) {
        this.interactionState.keyPressed.delete(event.key);
        
        // Delegate to current state handlers
        for (const handlers of this.eventHandlers.values()) {
            if (handlers.onKeyUp) {
                handlers.onKeyUp(event.key, event);
            }
        }
        
        this.stats.eventsProcessed++;
    }
    
    // =============================================================================
    // SPATIAL INTERACTION QUERIES
    // =============================================================================
    
    /**
     * Find interactive element at specific coordinates
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Object|null} Interactive element or null
     */
    findInteractiveElementAt(x, y) {
        let topElement = null;
        let highestZ = -Infinity;
        
        for (const element of this.interactiveElements.values()) {
            if (element.enabled && this.isPointInBounds(x, y, element.bounds)) {
                if (element.zIndex > highestZ) {
                    highestZ = element.zIndex;
                    topElement = element;
                }
            }
        }
        
        this.stats.spatialQueries++;
        return topElement;
    }
    
    /**
     * Update hover states for all interactive elements
     * @param {number} x - Mouse X coordinate
     * @param {number} y - Mouse Y coordinate
     */
    updateInteractiveElementStates(x, y) {
        const hoveredElement = this.findInteractiveElementAt(x, y);
        
        // Update hover states
        for (const element of this.interactiveElements.values()) {
            const wasHovered = element.hovered;
            element.hovered = (element === hoveredElement && element.enabled);
            
            // Trigger hover state changes
            if (element.hovered !== wasHovered) {
                this.onElementHoverChange(element, element.hovered);
            }
        }
        
        // Update cursor if hovered element changed
        if (this.interactionState.hoveredElement !== hoveredElement) {
            this.interactionState.hoveredElement = hoveredElement;
            this.updateCursor(hoveredElement ? hoveredElement.cursor : 'default');
        }
    }
    
    /**
     * Check if point is within bounds
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Object} bounds - Bounds object {x, y, width, height}
     * @returns {boolean} True if point is within bounds
     */
    isPointInBounds(x, y, bounds) {
        return x >= bounds.x && 
               x <= bounds.x + bounds.width && 
               y >= bounds.y && 
               y <= bounds.y + bounds.height;
    }
    
    // =============================================================================
    // CURSOR MANAGEMENT
    // =============================================================================
    
    /**
     * Update cursor type
     * @param {string} cursorType - CSS cursor type
     */
    updateCursor(cursorType) {
        if (this.cursorState.type !== cursorType) {
            this.cursorState.type = cursorType;
            this.cursorState.needsUpdate = true;
            this.canvas.style.cursor = cursorType;
        }
    }
    
    // =============================================================================
    // CALLBACKS AND EVENTS
    // =============================================================================
    
    /**
     * Handle element hover state changes
     * @param {Object} element - Interactive element
     * @param {boolean} hovered - New hover state
     */
    onElementHoverChange(element, hovered) {
        // Override in subclasses or register callbacks
        console.log(`Element ${element.id} hover: ${hovered}`);
    }
    
    // =============================================================================
    // STATE AND DEBUGGING
    // =============================================================================
    
    /**
     * Get current interaction state
     * @returns {Object} Interaction state
     */
    getInteractionState() {
        return { ...this.interactionState };
    }
    
    /**
     * Get performance statistics
     * @returns {Object} Performance stats
     */
    getStats() {
        return { ...this.stats };
    }
    
    /**
     * Reset performance statistics
     */
    resetStats() {
        this.stats = {
            eventsProcessed: 0,
            spatialQueries: 0,
            lastResetTime: Date.now()
        };
    }
    
    /**
     * Get debug information
     * @returns {Object} Debug info
     */
    getDebugInfo() {
        return {
            interactiveElements: Array.from(this.interactiveElements.keys()),
            hoveredElement: this.interactionState.hoveredElement?.id || null,
            cursorType: this.cursorState.type,
            stats: this.getStats()
        };
    }
    
    /**
     * Cleanup resources
     */
    cleanup() {
        this.deactivateEventListeners();
        this.interactiveElements.clear();
        this.eventHandlers.clear();
        this.interactionState.hoveredElement = null;
        this.interactionState.focusedElement = null;
    }
}