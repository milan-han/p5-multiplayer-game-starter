// =================================================================================
// UI MANAGER - Blueprint Battle
// =================================================================================
// Centralized UI rendering system that coordinates UIComponents and UIState
// Single source of truth for all UI rendering

class UIManager {
    constructor(canvas, ctx, config, socket) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.config = config;
        this.socket = socket;
        
        // Initialize UI subsystems
        this.uiComponents = new UIComponents(canvas, ctx, config);
        this.uiState = new UIState(config);
        
        // Background pattern cache
        this.backgroundPattern = null;
        
        // Performance tracking
        this.renderStats = {
            lastRenderTime: 0,
            renderCount: 0,
            avgRenderTime: 0
        };
        
        // Initialize background pattern
        this.createBackgroundPattern();
        
        // Setup event handlers
        this.setupEventHandlers();
        
        // Register for state change callbacks
        this.uiState.onStateChange('uiManager', (oldState, newState, data) => {
            this.handleStateChange(oldState, newState, data);
        });
        
        console.log('UIManager initialized');
    }
    
    // =============================================================================
    // EVENT HANDLING
    // =============================================================================
    
    /**
     * Setup event handlers for UI interactions
     */
    setupEventHandlers() {
        // Mouse events
        this.handleMouseMove = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.uiState.updateInteractiveElements(x, y);
            this.updateCursor();
        };
        
        this.handleMouseClick = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const handled = this.uiState.handleMouseClick(x, y);
            if (handled) {
                e.preventDefault();
            }
        };
        
        // Keyboard events
        this.handleKeyDown = (e) => {
            this.handleKeyInput(e.key, true, e);
        };
        
        this.handleKeyUp = (e) => {
            this.handleKeyInput(e.key, false, e);
        };
        
        // Register events based on current state
        this.registerEventListeners();
    }
    
    /**
     * Register event listeners based on current UI state
     */
    registerEventListeners() {
        // Always register mouse events for UI interaction
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('click', this.handleMouseClick);
        
        // Register keyboard events for certain states
        if (this.uiState.isInState('login') || this.uiState.isInState('death')) {
            document.addEventListener('keydown', this.handleKeyDown);
            document.addEventListener('keyup', this.handleKeyUp);
        }
    }
    
    /**
     * Unregister event listeners
     */
    unregisterEventListeners() {
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('click', this.handleMouseClick);
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
    }
    
    /**
     * Handle keyboard input based on current state
     * @param {string} key - Key pressed
     * @param {boolean} isDown - Whether key is down or up
     * @param {Event} event - Original event
     */
    handleKeyInput(key, isDown, event) {
        if (!isDown) return; // Only handle key down events
        
        switch (this.uiState.getCurrentState()) {
            case 'login':
                this.handleLoginKeyInput(key, event);
                break;
            case 'death':
                this.handleDeathKeyInput(key, event);
                break;
        }
    }
    
    /**
     * Handle keyboard input in login state
     * @param {string} key - Key pressed
     * @param {Event} event - Original event
     */
    handleLoginKeyInput(key, event) {
        if (key === 'Enter') {
            this.handlePlayButton();
            event.preventDefault();
            return;
        }
        
        if (key === 'Backspace') {
            const currentName = this.uiState.loginState.playerName;
            this.uiState.updateLoginInput(currentName.slice(0, -1));
            event.preventDefault();
            return;
        }
        
        // Handle regular character input
        if (key.length === 1 && this.uiState.loginState.playerName.length < 20) {
            const currentName = this.uiState.loginState.playerName;
            this.uiState.updateLoginInput(currentName + key);
            event.preventDefault();
        }
    }
    
    /**
     * Handle keyboard input in death state
     * @param {string} key - Key pressed
     * @param {Event} event - Original event
     */
    handleDeathKeyInput(key, event) {
        if (key === 'Enter' || key === ' ') {
            const deathData = this.uiState.getStateData();
            if (deathData.showRespawnButton) {
                this.handleRespawnButton();
                event.preventDefault();
            }
        }
    }
    
    /**
     * Update cursor style based on hover state
     */
    updateCursor() {
        let shouldShowPointer = false;
        
        for (const [id, element] of this.uiState.interactiveElements) {
            if (element.hovered && element.type === 'button') {
                shouldShowPointer = true;
                break;
            }
        }
        
        this.canvas.style.cursor = shouldShowPointer ? 'pointer' : 'default';
    }
    
    // =============================================================================
    // MAIN RENDERING INTERFACE
    // =============================================================================
    
    /**
     * Main render function called from game loop
     * @param {Object} gameState - Current game state
     * @param {string} myPlayerId - Current player ID
     */
    render(gameState, myPlayerId) {
        const startTime = performance.now();
        
        // Update animations
        this.uiState.updateAnimations(16); // Assume 60fps for now
        
        // Render based on current state
        switch (this.uiState.getCurrentState()) {
            case 'login':
                this.renderLoginOverlay();
                break;
            case 'game':
                this.renderGameUI(gameState, myPlayerId);
                break;
            case 'death':
                this.renderGameUI(gameState, myPlayerId);
                this.renderDeathOverlay();
                break;
            case 'connecting':
                this.renderConnectingOverlay();
                break;
        }
        
        // Update performance stats
        this.updateRenderStats(startTime);
    }
    
    /**
     * Render login overlay
     */
    renderLoginOverlay() {
        const center = this.uiComponents.getCenter();
        const bounds = this.uiComponents.getBounds();
        
        // Clear and draw background
        this.drawBackground();
        
        // Draw background overlay
        this.ctx.fillStyle = this.uiComponents.colors.base;
        this.ctx.globalAlpha = this.config.ui.login_overlay.background_alpha;
        this.ctx.fillRect(0, 0, bounds.width, bounds.height);
        this.ctx.globalAlpha = 1;
        
        // Draw title
        this.uiComponents.drawText('BLUEPRINT BATTLE', center.x, center.y - 85, {
            type: 'title',
            size: this.config.ui.login_overlay.title_font_size,
            color: this.uiComponents.colors.leaderboardCyan,
            align: 'center',
            baseline: 'middle',
            weight: 'bold',
            letterSpacing: '0.08em',
            glow: true,
            glowIntensity: this.config.ui.login_overlay.title_glow_intensity
        });
        
        // Draw subtitle
        this.uiComponents.drawText('Enter your callsign to join the battle', center.x, center.y - 55, {
            type: 'primary',
            size: this.config.ui.login_overlay.font_size - 2,
            color: this.uiComponents.colors.leaderboardCyan,
            align: 'center',
            baseline: 'middle',
            alpha: 0.7
        });
        
        // Draw input field
        const inputWidth = this.config.ui.login_overlay.input_width;
        const inputHeight = this.config.ui.login_overlay.input_height;
        const inputX = center.x - inputWidth / 2;
        const inputY = center.y - inputHeight / 2;
        
        this.uiComponents.drawInputField(inputX, inputY, inputWidth, inputHeight, {
            focused: this.uiState.loginState.inputFocused,
            value: this.uiState.loginState.playerName,
            placeholder: 'CALLSIGN',
            showCursor: this.uiState.loginState.showCursor
        });
        
        // Register input field for interaction
        this.uiState.registerInteractiveElement('loginInput', 
            this.uiComponents.createBounds(inputX, inputY, inputWidth, inputHeight),
            'input',
            () => this.uiState.setLoginInputFocus(true)
        );
        
        // Draw play button
        const buttonWidth = this.config.ui.login_overlay.button_width;
        const buttonHeight = this.config.ui.login_overlay.button_height;
        const buttonX = center.x - buttonWidth / 2;
        const buttonY = center.y + inputHeight / 2 + this.config.ui.login_overlay.element_spacing - buttonHeight / 2;
        
        this.uiComponents.drawButton(buttonX, buttonY, buttonWidth, buttonHeight, 'PLAY', {
            hovered: this.uiState.loginState.buttonHovered
        });
        
        // Register play button for interaction
        this.uiState.registerInteractiveElement('loginButton',
            this.uiComponents.createBounds(buttonX, buttonY, buttonWidth, buttonHeight),
            'button',
            () => this.handlePlayButton()
        );
        
        // Draw error message
        if (this.uiState.loginState.errorMessage) {
            this.uiComponents.drawText(this.uiState.loginState.errorMessage, center.x, buttonY + buttonHeight / 2 + 25, {
                type: 'primary',
                size: this.config.ui.login_overlay.font_size - 2,
                color: this.uiComponents.colors.error,
                align: 'center',
                baseline: 'middle',
                alpha: 0.9
            });
        }
        
        // Draw instructions
        this.uiComponents.drawText('PRESS ENTER TO PLAY', center.x, buttonY + buttonHeight / 2 + 55, {
            type: 'monospace',
            size: this.config.ui.login_overlay.font_size - 3,
            color: this.uiComponents.colors.leaderboardCyan,
            align: 'center',
            baseline: 'middle',
            letterSpacing: '0.05em',
            alpha: 0.4
        });
    }
    
    /**
     * Render game UI elements
     * @param {Object} gameState - Current game state
     * @param {string} myPlayerId - Current player ID
     */
    renderGameUI(gameState, myPlayerId) {
        if (!gameState.tanks) return;
        
        const myTank = gameState.tanks.find(tank => tank.id === myPlayerId);
        if (!myTank) return;
        
        // Draw leaderboard
        this.renderLeaderboard(gameState.tanks, myPlayerId);
        
        // Draw kill streak display
        this.renderKillStreakDisplay(myTank.killStreak);
        
        // Draw crosshair (if enabled)
        if (this.uiState.gameState.showCrosshair) {
            this.renderCrosshair();
        }
    }
    
    /**
     * Render leaderboard
     * @param {Array} tanks - Array of tank data
     * @param {string} myPlayerId - Current player ID
     */
    renderLeaderboard(tanks, myPlayerId) {
        const bounds = this.uiComponents.getBounds();
        const config = this.config.ui.leaderboard;
        
        const panelX = bounds.width - config.position.right - config.width;
        const panelY = config.position.top;
        
        // Sort players by kill streak
        const sortedPlayers = tanks
            .map(tank => ({
                ...tank,
                displayName: tank.name || `Player ${tank.id.substring(0, 6)}`
            }))
            .sort((a, b) => b.killStreak - a.killStreak)
            .slice(0, config.max_players);
        
        if (sortedPlayers.length === 0) return;
        
        const panelHeight = config.padding * 2 + config.row_height * (sortedPlayers.length + 1.5);
        
        // Draw frosted glass background
        this.uiComponents.drawFrostedGlassPanel(panelX, panelY, config.width, panelHeight);
        
        // Draw header
        this.uiComponents.drawText('LEADERBOARD', panelX + config.width / 2, panelY + config.padding + config.row_height / 2, {
            type: 'title',
            size: config.header_font_size,
            color: this.uiComponents.colors.leaderboardCyan,
            align: 'center',
            baseline: 'middle',
            weight: config.title_font_weight,
            letterSpacing: config.title_letter_spacing
        });
        
        // Draw divider line
        const dividerY = panelY + config.padding + config.row_height;
        this.uiComponents.drawDivider(
            panelX + config.inner_padding, 
            dividerY, 
            panelX + config.width - config.inner_padding, 
            dividerY
        );
        
        // Draw players
        sortedPlayers.forEach((player, index) => {
            const rowY = panelY + config.padding + config.row_height * (index + 2);
            const isTopPlayer = index === 0;
            const isCurrentPlayer = player.id === myPlayerId;
            
            this.uiComponents.drawLeaderboardEntry(
                panelX, rowY, config.width, 
                player, isTopPlayer, isCurrentPlayer
            );
        });
    }
    
    /**
     * Render kill streak display
     * @param {number} killStreak - Current kill streak
     */
    renderKillStreakDisplay(killStreak) {
        const bounds = this.uiComponents.getBounds();
        const config = this.config.ui.killstreak_display;
        
        const panelX = bounds.width - config.position.right - config.width;
        const panelY = bounds.height - config.position.bottom - config.height;
        
        // Draw frosted glass background
        this.uiComponents.drawFrostedGlassPanel(panelX, panelY, config.width, config.height);
        
        // Draw kill streak indicator
        this.uiComponents.drawKillStreakIndicator(
            panelX + config.width / 2, 
            panelY + config.height / 2, 
            killStreak
        );
    }
    
    /**
     * Render crosshair
     */
    renderCrosshair() {
        const center = this.uiComponents.getCenter();
        const size = this.config.ui.crosshair_size;
        
        this.ctx.save();
        this.ctx.strokeStyle = this.uiComponents.colors.primary;
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.7;
        
        // Draw crosshair lines
        this.ctx.beginPath();
        this.ctx.moveTo(center.x - size, center.y);
        this.ctx.lineTo(center.x + size, center.y);
        this.ctx.moveTo(center.x, center.y - size);
        this.ctx.lineTo(center.x, center.y + size);
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    /**
     * Render death overlay
     */
    renderDeathOverlay() {
        const center = this.uiComponents.getCenter();
        const bounds = this.uiComponents.getBounds();
        const deathData = this.uiState.updateDeathCountdown();
        
        // Draw background overlay
        this.ctx.fillStyle = this.uiComponents.colors.base;
        this.ctx.globalAlpha = this.config.ui.death_screen.background_alpha;
        this.ctx.fillRect(0, 0, bounds.width, bounds.height);
        this.ctx.globalAlpha = 1;
        
        // Draw death message
        this.uiComponents.drawText('YOU DIED', center.x, center.y - 80, {
            type: 'primary',
            size: this.config.ui.death_screen.message_font_size,
            color: this.uiComponents.colors.error,
            align: 'center',
            baseline: 'middle',
            glow: true,
            glowIntensity: 15
        });
        
        // Draw countdown or respawn message
        if (deathData.secondsLeft > 0) {
            this.uiComponents.drawText('Respawning in', center.x, center.y - 40, {
                type: 'primary',
                size: this.config.ui.death_screen.message_font_size - 4,
                color: this.uiComponents.colors.dim,
                align: 'center',
                baseline: 'middle'
            });
            
            this.uiComponents.drawText(deathData.secondsLeft.toString(), center.x, center.y, {
                type: 'primary',
                size: this.config.ui.death_screen.countdown_font_size,
                color: this.uiComponents.colors.primary,
                align: 'center',
                baseline: 'middle',
                glow: true,
                glowIntensity: this.config.ui.death_screen.glow_intensity * this.uiState.getGlowPulse()
            });
        } else {
            this.uiComponents.drawText('Respawning...', center.x, center.y, {
                type: 'primary',
                size: this.config.ui.death_screen.message_font_size,
                color: this.uiComponents.colors.glow,
                align: 'center',
                baseline: 'middle',
                glow: true,
                glowIntensity: 10
            });
        }
        
        // Draw respawn button if available
        if (deathData.showButton) {
            const buttonWidth = this.config.ui.death_screen.button_width;
            const buttonHeight = this.config.ui.death_screen.button_height;
            const buttonX = center.x - buttonWidth / 2;
            const buttonY = center.y + this.config.ui.death_screen.element_spacing - buttonHeight / 2;
            
            this.uiComponents.drawButton(buttonX, buttonY, buttonWidth, buttonHeight, 'RESPAWN', {
                hovered: this.uiState.deathState.buttonHovered
            });
            
            // Register respawn button
            this.uiState.registerInteractiveElement('deathButton',
                this.uiComponents.createBounds(buttonX, buttonY, buttonWidth, buttonHeight),
                'button',
                () => this.handleRespawnButton()
            );
        }
    }
    
    /**
     * Render connecting overlay
     */
    renderConnectingOverlay() {
        const center = this.uiComponents.getCenter();
        const bounds = this.uiComponents.getBounds();
        
        // Draw background overlay
        this.ctx.fillStyle = this.uiComponents.colors.base;
        this.ctx.globalAlpha = 0.8;
        this.ctx.fillRect(0, 0, bounds.width, bounds.height);
        this.ctx.globalAlpha = 1;
        
        // Draw connecting message
        this.uiComponents.drawText('CONNECTING...', center.x, center.y, {
            type: 'title',
            size: 24,
            color: this.uiComponents.colors.primary,
            align: 'center',
            baseline: 'middle',
            glow: true,
            glowIntensity: 10 * this.uiState.getGlowPulse()
        });
    }
    
    // =============================================================================
    // BUTTON HANDLERS
    // =============================================================================
    
    /**
     * Handle play button click
     */
    handlePlayButton() {
        if (!this.uiState.validateLoginInput()) {
            return;
        }
        
        // Transition to connecting state
        this.uiState.transitionTo('connecting');
        
        // Emit join game event
        this.socket.emit('playerJoin', { 
            name: this.uiState.loginState.playerName.trim() 
        });
    }
    
    /**
     * Handle respawn button click
     */
    handleRespawnButton() {
        // Transition back to game state
        this.uiState.transitionTo('game');
        
        // Emit respawn event if needed
        this.socket.emit('playerRespawn');
    }
    
    // =============================================================================
    // STATE MANAGEMENT
    // =============================================================================
    
    /**
     * Handle UI state changes
     * @param {string} oldState - Previous state
     * @param {string} newState - New state
     * @param {Object} data - Transition data
     */
    handleStateChange(oldState, newState, data) {
        // Clear interactive elements on state change
        this.uiState.interactiveElements.clear();
        
        // Update event listeners
        this.unregisterEventListeners();
        this.registerEventListeners();
        
        console.log(`UIManager handling state change: ${oldState} → ${newState}`);
    }
    
    /**
     * Show login overlay
     */
    showLogin() {
        this.uiState.transitionTo('login');
    }
    
    /**
     * Show game UI
     */
    showGame() {
        this.uiState.transitionTo('game');
    }
    
    /**
     * Show death overlay
     * @param {Object} deathData - Death state data
     */
    showDeath(deathData) {
        this.uiState.transitionTo('death', deathData);
    }
    
    /**
     * Hide all UI overlays
     */
    hideOverlays() {
        this.uiState.transitionTo('game');
    }
    
    // =============================================================================
    // UTILITY METHODS
    // =============================================================================
    
    /**
     * Create background pattern
     */
    createBackgroundPattern() {
        const patternCanvas = document.createElement('canvas');
        const patternCtx = patternCanvas.getContext('2d');
        const size = this.config.background_pattern.cell_size;
        const dotRadius = this.config.background_pattern.dot_radius;
        
        patternCanvas.width = size;
        patternCanvas.height = size;
        
        patternCtx.fillStyle = this.uiComponents.colors.base;
        patternCtx.fillRect(0, 0, size, size);
        
        patternCtx.fillStyle = this.uiComponents.colors.dim;
        patternCtx.globalAlpha = this.config.background_pattern.dot_alpha;
        patternCtx.beginPath();
        patternCtx.arc(size / 2, size / 2, dotRadius, 0, Math.PI * 2);
        patternCtx.fill();
        
        this.backgroundPattern = this.ctx.createPattern(patternCanvas, 'repeat');
    }
    
    /**
     * Draw background pattern
     */
    drawBackground() {
        if (this.backgroundPattern) {
            this.ctx.fillStyle = this.backgroundPattern;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
    
    /**
     * Update render performance statistics
     * @param {number} startTime - Render start time
     */
    updateRenderStats(startTime) {
        const renderTime = performance.now() - startTime;
        this.renderStats.lastRenderTime = renderTime;
        this.renderStats.renderCount++;
        
        // Calculate running average
        const alpha = 0.1;
        this.renderStats.avgRenderTime = this.renderStats.avgRenderTime * (1 - alpha) + renderTime * alpha;
    }
    
    /**
     * Handle canvas resize
     */
    onResize() {
        this.createBackgroundPattern();
        this.uiComponents = new UIComponents(this.canvas, this.ctx, this.config);
    }
    
    /**
     * Get current UI state
     * @returns {string} Current state
     */
    getCurrentState() {
        return this.uiState.getCurrentState();
    }
    
    /**
     * Check if login overlay is visible
     * @returns {boolean} Whether login overlay is visible
     */
    isLoginVisible() {
        return this.uiState.isInState('login');
    }
    
    /**
     * Get render statistics
     * @returns {Object} Render statistics
     */
    getRenderStats() {
        return { ...this.renderStats };
    }
    
    /**
     * Get debug information
     * @returns {Object} Debug information
     */
    getDebugInfo() {
        return {
            uiState: this.uiState.getDebugInfo(),
            renderStats: this.getRenderStats(),
            interactiveElements: Array.from(this.uiState.interactiveElements.keys())
        };
    }
    
    /**
     * Clean up resources
     */
    cleanup() {
        this.unregisterEventListeners();
        this.uiState.cleanup();
        
        console.log('UIManager cleaned up');
    }
}