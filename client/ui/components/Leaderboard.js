// =================================================================================
// LEADERBOARD COMPONENT - Blueprint Battle UI System
// =================================================================================
// Dedicated leaderboard rendering with player rankings, kill streaks, and stats
// Extracted from UIManager and UIComponents for better organization

import { BaseComponent } from './BaseComponent.js';
import { UIUtils } from '../utils/UIUtils.js';

export class Leaderboard extends BaseComponent {
    constructor(canvas, ctx, config, options = {}) {
        super(canvas, ctx, config, options);
        
        // Leaderboard-specific configuration
        this.leaderboardConfig = config.ui.leaderboard;
        
        // Component state
        this.state = {
            players: [],
            currentPlayerId: null,
            visible: true,
            maxPlayers: this.leaderboardConfig.max_players
        };
        
        // Layout calculations
        this.layout = this.calculateLayout();
        
        // Animation state for position changes
        this.animations = {
            pulse: 0,
            playerAnimations: new Map() // Per-player animation state
        };
        
        console.log('Leaderboard component initialized');
    }
    
    // =============================================================================
    // LAYOUT CALCULATIONS
    // =============================================================================
    
    /**
     * Calculate leaderboard layout
     * @returns {Object} Layout configuration
     */
    calculateLayout() {
        const config = this.leaderboardConfig;
        
        return {
            // Panel position (top-right)
            panel: {
                x: this.canvas.width - config.position.right - config.width,
                y: config.position.top,
                width: config.width,
                height: this.calculatePanelHeight()
            },
            
            // Header area
            header: {
                x: this.canvas.width - config.position.right - config.width + config.padding,
                y: config.position.top + config.padding,
                height: config.header_font_size + 10
            },
            
            // Player list area
            playerList: {
                x: this.canvas.width - config.position.right - config.width + config.padding,
                y: config.position.top + config.padding + config.header_font_size + 20,
                width: config.width - config.padding * 2,
                rowHeight: config.row_height
            }
        };
    }
    
    /**
     * Calculate panel height based on number of players
     * @returns {number} Panel height in pixels
     */
    calculatePanelHeight() {
        const config = this.leaderboardConfig;
        const playerCount = Math.min(this.state.players.length, this.state.maxPlayers);
        const headerHeight = config.header_font_size + 20;
        const playersHeight = playerCount * config.row_height;
        const padding = config.padding * 2;
        
        return headerHeight + playersHeight + padding;
    }
    
    // =============================================================================
    // COMPONENT LIFECYCLE
    // =============================================================================
    
    /**
     * Update component with new player data
     * @param {number} deltaTime - Time since last update
     * @param {Object} state - External state data
     */
    update(deltaTime, state) {
        super.update(deltaTime, state);
        
        // Update player data
        if (state.players) {
            this.updatePlayerData(state.players);
        }
        
        if (state.currentPlayerId !== undefined) {
            this.state.currentPlayerId = state.currentPlayerId;
        }
        
        if (state.visible !== undefined) {
            this.state.visible = state.visible;
        }
        
        // Update animations
        this.updateAnimations(deltaTime);
        
        // Recalculate layout if player count changed
        if (this.layout.panel.height !== this.calculatePanelHeight()) {
            this.layout = this.calculateLayout();
            this.markDirty();
        }
    }
    
    /**
     * Update player data and track position changes
     * @param {Array} players - Array of player objects
     */
    updatePlayerData(players) {
        // Sort players by kill streak (descending)
        const sortedPlayers = [...players]
            .filter(player => player && player.name)
            .sort((a, b) => (b.killStreak || 0) - (a.killStreak || 0))
            .slice(0, this.state.maxPlayers);
        
        // Track position changes for animations
        this.trackPositionChanges(this.state.players, sortedPlayers);
        
        this.state.players = sortedPlayers;
        this.markDirty();
    }
    
    /**
     * Track position changes for animation effects
     * @param {Array} oldPlayers - Previous player list
     * @param {Array} newPlayers - New player list
     */
    trackPositionChanges(oldPlayers, newPlayers) {
        const oldPositions = new Map();
        oldPlayers.forEach((player, index) => {
            if (player && player.id) {
                oldPositions.set(player.id, index);
            }
        });
        
        newPlayers.forEach((player, newIndex) => {
            if (player && player.id) {
                const oldIndex = oldPositions.get(player.id);
                if (oldIndex !== undefined && oldIndex !== newIndex) {
                    // Position changed - trigger animation
                    this.animations.playerAnimations.set(player.id, {
                        positionChange: true,
                        pulseStart: Date.now(),
                        pulseDuration: 2000
                    });
                }
            }
        });
    }
    
    /**
     * Update component animations
     * @param {number} deltaTime - Time since last update
     */
    updateAnimations(deltaTime) {
        // Global pulse animation
        this.animations.pulse += deltaTime * this.leaderboardConfig.pulse_speed;
        if (this.animations.pulse > Math.PI * 2) {
            this.animations.pulse -= Math.PI * 2;
        }
        
        // Update per-player animations
        const currentTime = Date.now();
        for (const [playerId, anim] of this.animations.playerAnimations) {
            if (anim.positionChange) {
                const elapsed = currentTime - anim.pulseStart;
                if (elapsed >= anim.pulseDuration) {
                    this.animations.playerAnimations.delete(playerId);
                }
            }
        }
    }
    
    // =============================================================================
    // RENDERING
    // =============================================================================
    
    /**
     * Draw the leaderboard component
     * @param {Object} state - Component state
     * @param {Object} context - Rendering context
     */
    draw(state, context) {
        if (!this.state.visible || this.state.players.length === 0) {
            return;
        }
        
        this.drawPanel();
        this.drawHeader();
        this.drawPlayerList();
    }
    
    /**
     * Draw the leaderboard panel background
     */
    drawPanel() {
        const panel = this.layout.panel;
        
        this.ctx.save();
        
        // Frosted glass background
        this.ctx.fillStyle = UIUtils.withAlpha(
            this.colors.uiCyan, 
            this.leaderboardConfig.frosted_glass_alpha
        );
        this.ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
        
        // Border
        this.ctx.strokeStyle = UIUtils.withAlpha(this.colors.uiCyan, 0.8);
        this.ctx.lineWidth = this.leaderboardConfig.border_width;
        this.ctx.strokeRect(panel.x, panel.y, panel.width, panel.height);
        
        this.ctx.restore();
    }
    
    /**
     * Draw the leaderboard header
     */
    drawHeader() {
        const header = this.layout.header;
        const config = this.leaderboardConfig;
        
        this.ctx.save();
        
        // Setup header text style
        this.ctx.font = `${config.title_font_weight} ${config.header_font_size}px ${this.typography.title.family}`;
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.letterSpacing = config.title_letter_spacing;
        this.ctx.fillStyle = this.colors.uiCyan;
        
        // Draw header text
        this.ctx.fillText('LEADERBOARD', header.x, header.y);
        
        // Draw divider line
        const dividerY = header.y + header.height;
        this.ctx.strokeStyle = UIUtils.withAlpha(this.colors.uiCyan, config.divider_alpha);
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(header.x, dividerY);
        this.ctx.lineTo(header.x + this.layout.playerList.width, dividerY);
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    /**
     * Draw the player list
     */
    drawPlayerList() {
        const playerList = this.layout.playerList;
        
        this.state.players.forEach((player, index) => {
            if (index >= this.state.maxPlayers) return;
            
            const y = playerList.y + index * playerList.rowHeight;
            const isTopPlayer = index === 0;
            const isCurrentPlayer = player.id === this.state.currentPlayerId;
            
            this.drawPlayerEntry(playerList.x, y, playerList.width, player, isTopPlayer, isCurrentPlayer);
        });
    }
    
    /**
     * Draw a single player entry
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Entry width
     * @param {Object} player - Player data
     * @param {boolean} isTopPlayer - Whether this is the top player
     * @param {boolean} isCurrentPlayer - Whether this is the current player
     */
    drawPlayerEntry(x, y, width, player, isTopPlayer, isCurrentPlayer) {
        this.ctx.save();
        
        const config = this.leaderboardConfig;
        const rowHeight = config.row_height;
        
        // Get player animation state
        const playerAnim = this.animations.playerAnimations.get(player.id);
        const hasPositionPulse = playerAnim && playerAnim.positionChange;
        
        // Calculate glow effects
        let glowIntensity = 0;
        let textAlpha = config.regular_player_alpha;
        
        if (isTopPlayer) {
            glowIntensity = config.top_player_glow_intensity;
            textAlpha = 1.0;
        }
        
        if (isCurrentPlayer) {
            textAlpha = 1.0;
            // Add subtle pulse for current player
            const pulse = this.getPulse();
            glowIntensity = Math.max(glowIntensity, 5 + pulse * 3);
        }
        
        if (hasPositionPulse) {
            const elapsed = Date.now() - playerAnim.pulseStart;
            const progress = Math.min(elapsed / playerAnim.pulseDuration, 1);
            const pulseAlpha = Math.sin(progress * Math.PI * 4) * (1 - progress);
            glowIntensity = Math.max(glowIntensity, 10 * pulseAlpha);
        }
        
        // Draw player background if highlighted
        if (isCurrentPlayer || hasPositionPulse) {
            this.ctx.fillStyle = UIUtils.withAlpha(this.colors.uiCyan, 0.1);
            this.ctx.fillRect(x - 5, y - 2, width + 10, rowHeight);
        }
        
        // Setup text style
        this.ctx.font = `${config.font_size}px ${this.typography.primary.family}`;
        this.ctx.textBaseline = 'middle';
        this.ctx.globalAlpha = textAlpha;
        
        // Apply glow effect if needed
        if (glowIntensity > 0) {
            this.ctx.shadowBlur = glowIntensity;
            this.ctx.shadowColor = this.colors.uiCyan;
        }
        
        // Draw rank number
        this.ctx.textAlign = 'left';
        this.ctx.fillStyle = this.colors.uiCyan;
        const rank = String(this.state.players.indexOf(player) + 1);
        this.ctx.fillText(`${rank}.`, x, y + rowHeight / 2);
        
        // Draw crown icon for top player
        if (isTopPlayer) {
            this.drawCrownIcon(x + 25, y + rowHeight / 2 - 8, 16);
        }
        
        // Draw player name
        const nameX = isTopPlayer ? x + 50 : x + 25;
        this.ctx.fillStyle = player.color || this.colors.primary;
        this.ctx.fillText(player.name, nameX, y + rowHeight / 2);
        
        // Draw kill streak
        this.ctx.textAlign = 'right';
        this.ctx.fillStyle = this.colors.uiCyan;
        const killStreakText = `${player.killStreak || 0}`;
        this.ctx.fillText(killStreakText, x + width, y + rowHeight / 2);
        
        // Draw shield indicator if player has shield
        if (player.shield) {
            this.drawShieldIcon(x + width - 25, y + rowHeight / 2 - 7, 14);
        }
        
        this.ctx.restore();
    }
    
    // =============================================================================
    // ICON RENDERING
    // =============================================================================
    
    /**
     * Draw crown icon for top player
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} size - Icon size
     */
    drawCrownIcon(x, y, size = 16) {
        this.ctx.save();
        
        const crownColor = '#FFD700'; // Gold
        this.ctx.strokeStyle = crownColor;
        this.ctx.fillStyle = UIUtils.withAlpha(crownColor, 0.3);
        this.ctx.lineWidth = 1.5;
        
        // Crown shape
        this.ctx.beginPath();
        this.ctx.moveTo(x, y + size * 0.8);
        this.ctx.lineTo(x + size * 0.2, y + size * 0.4);
        this.ctx.lineTo(x + size * 0.4, y + size * 0.6);
        this.ctx.lineTo(x + size * 0.5, y);
        this.ctx.lineTo(x + size * 0.6, y + size * 0.6);
        this.ctx.lineTo(x + size * 0.8, y + size * 0.4);
        this.ctx.lineTo(x + size, y + size * 0.8);
        this.ctx.lineTo(x, y + size * 0.8);
        this.ctx.closePath();
        
        this.ctx.fill();
        this.ctx.stroke();
        
        // Crown base
        this.ctx.fillRect(x, y + size * 0.8, size, size * 0.2);
        this.ctx.strokeRect(x, y + size * 0.8, size, size * 0.2);
        
        this.ctx.restore();
    }
    
    /**
     * Draw shield icon for protected players
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} size - Icon size
     */
    drawShieldIcon(x, y, size = 14) {
        this.ctx.save();
        
        this.ctx.strokeStyle = this.colors.accent;
        this.ctx.fillStyle = UIUtils.withAlpha(this.colors.accent, 0.3);
        this.ctx.lineWidth = 1.5;
        
        // Shield shape
        this.ctx.beginPath();
        this.ctx.moveTo(x + size / 2, y);
        this.ctx.lineTo(x + size * 0.8, y + size * 0.3);
        this.ctx.lineTo(x + size * 0.8, y + size * 0.6);
        this.ctx.lineTo(x + size / 2, y + size);
        this.ctx.lineTo(x + size * 0.2, y + size * 0.6);
        this.ctx.lineTo(x + size * 0.2, y + size * 0.3);
        this.ctx.closePath();
        
        this.ctx.fill();
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    // =============================================================================
    // COMPONENT INTERFACE
    // =============================================================================
    
    /**
     * Get component bounds
     * @returns {Object} Component bounds
     */
    getBounds() {
        return this.layout.panel;
    }
    
    /**
     * Set visibility
     * @param {boolean} visible - Whether component should be visible
     */
    setVisible(visible) {
        if (this.state.visible !== visible) {
            this.state.visible = visible;
            this.markDirty();
        }
    }
    
    /**
     * Set maximum number of players to display
     * @param {number} maxPlayers - Maximum player count
     */
    setMaxPlayers(maxPlayers) {
        if (this.state.maxPlayers !== maxPlayers) {
            this.state.maxPlayers = maxPlayers;
            this.layout = this.calculateLayout();
            this.markDirty();
        }
    }
    
    /**
     * Handle canvas resize
     */
    onResize() {
        this.layout = this.calculateLayout();
        this.markDirty();
    }
    
    /**
     * Get current leaderboard state
     * @returns {Object} Current state
     */
    getState() {
        return {
            playerCount: this.state.players.length,
            topPlayer: this.state.players[0] || null,
            currentPlayerRank: this.getCurrentPlayerRank(),
            visible: this.state.visible
        };
    }
    
    /**
     * Get current player's rank
     * @returns {number|null} Player rank (1-based) or null if not found
     */
    getCurrentPlayerRank() {
        if (!this.state.currentPlayerId) return null;
        
        const index = this.state.players.findIndex(p => p.id === this.state.currentPlayerId);
        return index >= 0 ? index + 1 : null;
    }
}