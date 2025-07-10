// =================================================================================
// UI MANAGER (REFACTORED) - Blueprint Battle UI System
// =================================================================================
// Centralized UI coordination system - delegates to specialized subsystems
// Focused on orchestration and communication between UI components

import { UIEventSystem } from './UIEventSystem.js';
import { UIRenderer } from './UIRenderer.js';

export class UIManager {
    constructor(canvas, ctx, config, socket) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.config = config;
        this.socket = socket;
        
        // Initialize core subsystems
        this.eventSystem = new UIEventSystem(canvas, config);
        this.renderer = new UIRenderer(canvas, ctx, config);
        
        // Current UI state
        this.currentState = 'login';
        this.stateData = {};
        
        // Component registry
        this.activeComponents = new Map();
        
        // Revenge notification system
        this.revengeNotification = {
            active: false,
            startTime: 0,
            duration: 3000
        };
        
        // Initialize subsystems
        this.initializeSubsystems();
        
        console.log('UIManager (Refactored) initialized');
    }
    
    // =============================================================================
    // INITIALIZATION
    // =============================================================================
    
    /**
     * Initialize all UI subsystems
     */
    initializeSubsystems() {
        // Activate event handling
        this.eventSystem.activateEventListeners();
        
        // Register state-specific event handlers
        this.registerEventHandlers();
        
        console.log('UIManager: Subsystems initialized');
    }
    
    /**
     * Register event handlers for different UI states
     */
    registerEventHandlers() {
        // Login state handlers
        this.eventSystem.registerHandlers('login', {
            onKeyDown: (key, event) => this.handleLoginKeyInput(key, event),
            onMouseClick: (event, element) => this.handleLoginMouseClick(event, element)
        });
        
        // Death state handlers
        this.eventSystem.registerHandlers('death', {
            onKeyDown: (key, event) => this.handleDeathKeyInput(key, event),
            onMouseClick: (event, element) => this.handleDeathMouseClick(event, element)
        });
        
        // Game state handlers (minimal - game handles its own input)
        this.eventSystem.registerHandlers('game', {
            onMouseClick: (event, element) => this.handleGameMouseClick(event, element)
        });
    }
    
    // =============================================================================
    // STATE MANAGEMENT
    // =============================================================================
    
    /**
     * Transition to a new UI state
     * @param {string} newState - The new state to transition to
     * @param {Object} data - Optional state data
     */
    transitionTo(newState, data = {}) {
        if (this.currentState === newState) return;
        
        const oldState = this.currentState;
        console.log(`UIManager: State transition ${oldState} → ${newState}`);
        
        // Cleanup old state
        this.cleanupState(oldState);
        
        // Set new state
        this.currentState = newState;
        this.stateData = { ...data };
        
        // Setup new state
        this.setupState(newState, data);
        
        // Request full redraw
        this.renderer.requestFullRedraw();
    }
    
    /**
     * Setup state-specific components and interactions
     * @param {string} state - State name
     * @param {Object} data - State data
     */
    setupState(state, data) {
        switch (state) {
            case 'login':
                this.setupLoginState(data);
                break;
            case 'game':
                this.setupGameState(data);
                break;
            case 'death':
                this.setupDeathState(data);
                break;
            case 'connecting':
                this.setupConnectingState(data);
                break;
        }
    }
    
    /**
     * Cleanup state-specific components and interactions
     * @param {string} state - State name
     */
    cleanupState(state) {
        // Unregister interactive elements for this state
        for (const [id, component] of this.activeComponents) {
            if (component.state === state) {
                this.renderer.unregisterComponent(id);
                this.eventSystem.unregisterInteractiveElement(id);
                this.activeComponents.delete(id);
            }
        }
    }
    
    // =============================================================================
    // STATE-SPECIFIC SETUP
    // =============================================================================
    
    /**
     * Setup login state
     * @param {Object} data - Login state data
     */
    setupLoginState(data) {
        // Login state will be handled by LoginPanel component
        // This is just coordination
        this.stateData.playerName = data.playerName || '';
        this.stateData.errorMessage = data.errorMessage || '';
        this.stateData.inputFocused = true;
    }
    
    /**
     * Setup game state  
     * @param {Object} data - Game state data
     */
    setupGameState(data) {
        // Game state coordination
        this.stateData.showLeaderboard = true;
        this.stateData.showKillStreak = true;
        this.stateData.showCrosshair = true;
    }
    
    /**
     * Setup death state
     * @param {Object} data - Death state data
     */
    setupDeathState(data) {
        this.stateData = { ...data };
        this.stateData.showRespawnButton = false; // Will be shown after countdown
    }
    
    /**
     * Setup connecting state
     * @param {Object} data - Connecting state data
     */
    setupConnectingState(data) {
        this.stateData.message = data.message || 'Connecting...';
    }
    
    // =============================================================================
    // EVENT HANDLING DELEGATION
    // =============================================================================
    
    /**
     * Handle login keyboard input
     * @param {string} key - Key pressed
     * @param {KeyboardEvent} event - Keyboard event
     * @returns {boolean} True if handled
     */
    handleLoginKeyInput(key, event) {
        if (key === 'Enter') {
            this.handlePlayButton();
            return true;
        }
        
        if (key === 'Backspace') {
            this.stateData.playerName = this.stateData.playerName.slice(0, -1);
            this.stateData.errorMessage = '';
            return true;
        }
        
        if (key.length === 1 && this.stateData.playerName.length < 20) {
            this.stateData.playerName += key;
            this.stateData.errorMessage = '';
            return true;
        }
        
        return false;
    }
    
    /**
     * Handle death keyboard input
     * @param {string} key - Key pressed  
     * @param {KeyboardEvent} event - Keyboard event
     * @returns {boolean} True if handled
     */
    handleDeathKeyInput(key, event) {
        if ((key === 'Enter' || key === ' ') && this.stateData.showRespawnButton) {
            this.handleRespawnButton();
            return true;
        }
        return false;
    }
    
    /**
     * Handle login mouse clicks
     * @param {MouseEvent} event - Mouse event
     * @param {Object} element - Interactive element
     * @returns {boolean} True if handled
     */
    handleLoginMouseClick(event, element) {
        if (element && element.id === 'playButton') {
            this.handlePlayButton();
            return true;
        }
        return false;
    }
    
    /**
     * Handle death mouse clicks
     * @param {MouseEvent} event - Mouse event
     * @param {Object} element - Interactive element
     * @returns {boolean} True if handled
     */
    handleDeathMouseClick(event, element) {
        if (element && element.id === 'respawnButton' && this.stateData.showRespawnButton) {
            this.handleRespawnButton();
            return true;
        }
        return false;
    }
    
    /**
     * Handle game mouse clicks
     * @param {MouseEvent} event - Mouse event
     * @param {Object} element - Interactive element
     * @returns {boolean} True if handled
     */
    handleGameMouseClick(event, element) {
        // Game state has minimal UI interaction
        // Most game input handled by game systems
        return false;
    }
    
    // =============================================================================
    // ACTION HANDLERS
    // =============================================================================
    
    /**
     * Handle play button action
     */
    handlePlayButton() {
        const playerName = this.stateData.playerName.trim();
        
        if (!playerName) {
            this.stateData.errorMessage = 'Please enter your name';
            return;
        }
        
        if (playerName.length < 2) {
            this.stateData.errorMessage = 'Name must be at least 2 characters';
            return;
        }
        
        // Emit player join event
        this.socket.emit('playerJoin', { name: playerName });
        this.transitionTo('connecting', { message: 'Joining game...' });
    }
    
    /**
     * Handle respawn button action
     */
    handleRespawnButton() {
        this.socket.emit('playerRespawn');
        this.transitionTo('game');
    }
    
    /**
     * Show revenge notification
     */
    showRevengeNotification() {
        this.revengeNotification.active = true;
        this.revengeNotification.startTime = Date.now();
    }
    
    // =============================================================================
    // RENDERING COORDINATION
    // =============================================================================
    
    /**
     * Main render method - delegates to renderer
     * @param {Object} gameState - Current game state
     * @param {string} myPlayerId - Current player ID
     */
    render(gameState, myPlayerId) {
        // Update revenge notification
        this.updateRevengeNotification();
        
        // Prepare render state
        const renderState = {
            currentState: this.currentState,
            stateData: this.stateData,
            gameState: gameState,
            myPlayerId: myPlayerId,
            revengeNotification: this.revengeNotification
        };
        
        // Delegate to renderer
        this.renderer.render(renderState);
    }
    
    /**
     * Update revenge notification state
     */
    updateRevengeNotification() {
        if (this.revengeNotification.active) {
            const elapsed = Date.now() - this.revengeNotification.startTime;
            if (elapsed >= this.revengeNotification.duration) {
                this.revengeNotification.active = false;
            }
        }
    }
    
    // =============================================================================
    // PUBLIC API
    // =============================================================================
    
    /**
     * Get current UI state
     * @returns {string} Current state
     */
    getCurrentState() {
        return this.currentState;
    }
    
    /**
     * Check if login overlay is visible
     * @returns {boolean} True if login is visible
     */
    isLoginVisible() {
        return this.currentState === 'login';
    }
    
    /**
     * Handle canvas resize
     */
    onResize() {
        this.renderer.onResize();
    }
    
    /**
     * Get debug information
     * @returns {Object} Debug info
     */
    getDebugInfo() {
        return {
            currentState: this.currentState,
            stateData: this.stateData,
            eventSystem: this.eventSystem.getDebugInfo(),
            renderer: this.renderer.getDebugInfo(),
            revengeNotification: this.revengeNotification
        };
    }
    
    /**
     * Cleanup resources
     */
    cleanup() {
        this.eventSystem.cleanup();
        this.renderer.cleanup();
        this.activeComponents.clear();
    }
}