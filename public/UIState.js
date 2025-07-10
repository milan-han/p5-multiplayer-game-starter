// =================================================================================
// UI STATE MANAGEMENT - Blueprint Battle
// =================================================================================
// Centralized state management for all UI components with proper state machine

class UIState {
    constructor(config) {
        this.config = config;
        
        // UI State Machine
        this.state = 'login'; // 'login', 'game', 'death', 'connecting'
        this.previousState = null;
        this.stateTransitionTime = 0;
        
        // Login state
        this.loginState = {
            playerName: '',
            inputFocused: false,
            buttonHovered: false,
            errorMessage: '',
            showCursor: false,
            cursorBlinkTime: 0
        };
        
        // Death state
        this.deathState = {
            isDead: false,
            deathTime: 0,
            respawnTime: 0,
            showRespawnButton: false,
            buttonHovered: false
        };
        
        // Game UI state
        this.gameState = {
            showLeaderboard: true,
            showKillStreak: true,
            showCrosshair: true,
            uiAlpha: 1.0
        };
        
        // Interactive element tracking
        this.interactiveElements = new Map();
        
        // Event listeners
        this.eventListeners = new Map();
        
        // Animation state
        this.animations = {
            glowPulse: 0,
            fadeTransition: 0,
            pulseSpeed: 0.05
        };
        
        // Input state
        this.inputState = {
            mouseX: 0,
            mouseY: 0,
            mousePressed: false,
            keyPressed: new Set()
        };
        
        // State change callbacks
        this.stateChangeCallbacks = new Map();
        
        console.log('UIState initialized with state:', this.state);
    }
    
    // =============================================================================
    // STATE MACHINE MANAGEMENT
    // =============================================================================
    
    /**
     * Transition to a new UI state
     * @param {string} newState - The new state to transition to
     * @param {Object} data - Optional data for the transition
     */
    transitionTo(newState, data = {}) {
        if (this.state === newState) return;
        
        const oldState = this.state;
        this.previousState = oldState;
        this.state = newState;
        this.stateTransitionTime = Date.now();
        
        console.log(`UI State transition: ${oldState} → ${newState}`);
        
        // Handle state exit logic
        this.handleStateExit(oldState);
        
        // Handle state entry logic
        this.handleStateEntry(newState, data);
        
        // Trigger callbacks
        this.triggerStateChangeCallbacks(oldState, newState, data);
    }
    
    /**
     * Handle logic when exiting a state
     * @param {string} exitingState - The state being exited
     */
    handleStateExit(exitingState) {
        switch (exitingState) {
            case 'login':
                this.cleanupLoginState();
                break;
            case 'death':
                this.cleanupDeathState();
                break;
            case 'game':
                this.cleanupGameState();
                break;
        }
    }
    
    /**
     * Handle logic when entering a state
     * @param {string} enteringState - The state being entered
     * @param {Object} data - Optional data for the transition
     */
    handleStateEntry(enteringState, data) {
        switch (enteringState) {
            case 'login':
                this.setupLoginState(data);
                break;
            case 'death':
                this.setupDeathState(data);
                break;
            case 'game':
                this.setupGameState(data);
                break;
            case 'connecting':
                this.setupConnectingState(data);
                break;
        }
    }
    
    // =============================================================================
    // STATE SETUP AND CLEANUP
    // =============================================================================
    
    setupLoginState(data) {
        this.loginState = {
            playerName: data.playerName || '',
            inputFocused: true,
            buttonHovered: false,
            errorMessage: '',
            showCursor: true,
            cursorBlinkTime: 0
        };
        
        this.startCursorBlink();
    }
    
    cleanupLoginState() {
        this.stopCursorBlink();
    }
    
    setupDeathState(data) {
        this.deathState = {
            isDead: true,
            deathTime: data.deathTime || Date.now(),
            respawnTime: data.respawnTime || (Date.now() + this.config.combat.respawn_delay_ms),
            showRespawnButton: false,
            buttonHovered: false,
            stats: data.stats || { killStreak: 0, timeAlive: 0 }
        };
    }
    
    cleanupDeathState() {
        this.deathState = {
            isDead: false,
            deathTime: 0,
            respawnTime: 0,
            showRespawnButton: false,
            buttonHovered: false,
            stats: { killStreak: 0, timeAlive: 0 }
        };
    }
    
    setupGameState(data) {
        this.gameState = {
            showLeaderboard: true,
            showKillStreak: true,
            showCrosshair: true,
            uiAlpha: 1.0,
            ...data
        };
    }
    
    cleanupGameState() {
        // Reset any game-specific UI state
    }
    
    setupConnectingState(data) {
        // Setup connecting state
    }
    
    // =============================================================================
    // LOGIN STATE MANAGEMENT
    // =============================================================================
    
    /**
     * Update login input value
     * @param {string} value - New input value
     */
    updateLoginInput(value) {
        if (this.state !== 'login') return;
        
        this.loginState.playerName = value;
        this.loginState.errorMessage = ''; // Clear error on input
    }
    
    /**
     * Set login input focus state
     * @param {boolean} focused - Whether input is focused
     */
    setLoginInputFocus(focused) {
        if (this.state !== 'login') return;
        
        this.loginState.inputFocused = focused;
        if (focused) {
            this.startCursorBlink();
        } else {
            this.stopCursorBlink();
        }
    }
    
    /**
     * Set login button hover state
     * @param {boolean} hovered - Whether button is hovered
     */
    setLoginButtonHover(hovered) {
        if (this.state !== 'login') return;
        
        this.loginState.buttonHovered = hovered;
    }
    
    /**
     * Set login error message
     * @param {string} message - Error message
     */
    setLoginError(message) {
        if (this.state !== 'login') return;
        
        this.loginState.errorMessage = message;
    }
    
    /**
     * Validate login input
     * @returns {boolean} Whether login input is valid
     */
    validateLoginInput() {
        if (!this.loginState.playerName.trim()) {
            this.setLoginError('Please enter your name');
            return false;
        }
        
        if (this.loginState.playerName.trim().length < 2) {
            this.setLoginError('Name must be at least 2 characters');
            return false;
        }
        
        return true;
    }
    
    // =============================================================================
    // DEATH STATE MANAGEMENT
    // =============================================================================
    
    /**
     * Update death state countdown
     */
    updateDeathCountdown() {
        if (this.state !== 'death') return;
        
        const now = Date.now();
        const remainingTime = Math.max(0, this.deathState.respawnTime - now);
        const shouldShowButton = remainingTime <= 0;
        
        if (shouldShowButton !== this.deathState.showRespawnButton) {
            this.deathState.showRespawnButton = shouldShowButton;
        }
        
        return {
            secondsLeft: Math.ceil(remainingTime / 1000),
            showButton: shouldShowButton
        };
    }
    
    /**
     * Set death respawn button hover state
     * @param {boolean} hovered - Whether button is hovered
     */
    setDeathButtonHover(hovered) {
        if (this.state !== 'death') return;
        
        this.deathState.buttonHovered = hovered;
    }
    
    // =============================================================================
    // INTERACTIVE ELEMENT MANAGEMENT
    // =============================================================================
    
    /**
     * Register an interactive element for hit testing
     * @param {string} id - Element ID
     * @param {Object} bounds - Element bounds {x, y, width, height}
     * @param {string} type - Element type ('button', 'input', etc.)
     * @param {Function} callback - Callback function
     */
    registerInteractiveElement(id, bounds, type, callback) {
        this.interactiveElements.set(id, {
            bounds,
            type,
            callback,
            hovered: false,
            pressed: false
        });
    }
    
    /**
     * Unregister an interactive element
     * @param {string} id - Element ID
     */
    unregisterInteractiveElement(id) {
        this.interactiveElements.delete(id);
    }
    
    /**
     * Update interactive element hover states based on mouse position
     * @param {number} mouseX - Mouse X position
     * @param {number} mouseY - Mouse Y position
     */
    updateInteractiveElements(mouseX, mouseY) {
        this.inputState.mouseX = mouseX;
        this.inputState.mouseY = mouseY;
        
        for (const [id, element] of this.interactiveElements) {
            const wasHovered = element.hovered;
            const isHovered = this.isPointInBounds(mouseX, mouseY, element.bounds);
            
            if (isHovered !== wasHovered) {
                element.hovered = isHovered;
                
                // Update specific UI state based on element type
                if (id === 'loginButton') {
                    this.setLoginButtonHover(isHovered);
                } else if (id === 'deathButton') {
                    this.setDeathButtonHover(isHovered);
                }
            }
        }
    }
    
    /**
     * Handle mouse click on interactive elements
     * @param {number} mouseX - Mouse X position
     * @param {number} mouseY - Mouse Y position
     */
    handleMouseClick(mouseX, mouseY) {
        for (const [id, element] of this.interactiveElements) {
            if (this.isPointInBounds(mouseX, mouseY, element.bounds)) {
                element.callback(id, element);
                return true; // Event was handled
            }
        }
        return false; // No element was clicked
    }
    
    // =============================================================================
    // ANIMATION AND TIMING
    // =============================================================================
    
    /**
     * Update animation states
     * @param {number} deltaTime - Time since last update
     */
    updateAnimations(deltaTime) {
        this.animations.glowPulse += this.animations.pulseSpeed;
        if (this.animations.glowPulse > Math.PI * 2) {
            this.animations.glowPulse = 0;
        }
        
        // Update cursor blink
        if (this.state === 'login' && this.loginState.inputFocused) {
            this.loginState.cursorBlinkTime += deltaTime;
            this.loginState.showCursor = Math.sin(this.loginState.cursorBlinkTime * 0.003) > 0;
        }
        
        // Update death state countdown
        if (this.state === 'death') {
            this.updateDeathCountdown();
        }
    }
    
    /**
     * Start cursor blink animation
     */
    startCursorBlink() {
        this.loginState.cursorBlinkTime = 0;
        this.loginState.showCursor = true;
    }
    
    /**
     * Stop cursor blink animation
     */
    stopCursorBlink() {
        this.loginState.showCursor = false;
    }
    
    /**
     * Get current glow pulse intensity
     * @returns {number} Pulse intensity (0-1)
     */
    getGlowPulse() {
        return Math.sin(this.animations.glowPulse) * 0.3 + 1;
    }
    
    // =============================================================================
    // STATE CHANGE CALLBACKS
    // =============================================================================
    
    /**
     * Register a callback for state changes
     * @param {string} id - Callback ID
     * @param {Function} callback - Callback function (oldState, newState, data)
     */
    onStateChange(id, callback) {
        this.stateChangeCallbacks.set(id, callback);
    }
    
    /**
     * Unregister a state change callback
     * @param {string} id - Callback ID
     */
    offStateChange(id) {
        this.stateChangeCallbacks.delete(id);
    }
    
    /**
     * Trigger all state change callbacks
     * @param {string} oldState - Previous state
     * @param {string} newState - New state
     * @param {Object} data - Transition data
     */
    triggerStateChangeCallbacks(oldState, newState, data) {
        for (const [id, callback] of this.stateChangeCallbacks) {
            try {
                callback(oldState, newState, data);
            } catch (error) {
                console.error(`Error in state change callback ${id}:`, error);
            }
        }
    }
    
    // =============================================================================
    // UTILITY METHODS
    // =============================================================================
    
    /**
     * Check if point is within bounds
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Object} bounds - Bounds object {x, y, width, height}
     * @returns {boolean} Whether point is within bounds
     */
    isPointInBounds(x, y, bounds) {
        return x >= bounds.x && 
               x <= bounds.x + bounds.width && 
               y >= bounds.y && 
               y <= bounds.y + bounds.height;
    }
    
    /**
     * Get current state
     * @returns {string} Current state
     */
    getCurrentState() {
        return this.state;
    }
    
    /**
     * Get state data for current state
     * @returns {Object} State data
     */
    getStateData() {
        switch (this.state) {
            case 'login':
                return { ...this.loginState };
            case 'death':
                return { ...this.deathState };
            case 'game':
                return { ...this.gameState };
            default:
                return {};
        }
    }
    
    /**
     * Check if UI is in a specific state
     * @param {string} state - State to check
     * @returns {boolean} Whether UI is in the specified state
     */
    isInState(state) {
        return this.state === state;
    }
    
    /**
     * Get time since last state transition
     * @returns {number} Time in milliseconds
     */
    getTimeSinceTransition() {
        return Date.now() - this.stateTransitionTime;
    }
    
    /**
     * Clean up all state and event listeners
     */
    cleanup() {
        this.cleanupLoginState();
        this.cleanupDeathState();
        this.cleanupGameState();
        
        this.interactiveElements.clear();
        this.eventListeners.clear();
        this.stateChangeCallbacks.clear();
        
        console.log('UIState cleaned up');
    }
    
    /**
     * Get debug information
     * @returns {Object} Debug information
     */
    getDebugInfo() {
        return {
            currentState: this.state,
            previousState: this.previousState,
            timeSinceTransition: this.getTimeSinceTransition(),
            interactiveElements: Array.from(this.interactiveElements.keys()),
            animations: { ...this.animations },
            stateData: this.getStateData()
        };
    }
}