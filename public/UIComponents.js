// =================================================================================
// UI COMPONENTS - Blueprint Battle
// =================================================================================
// Reusable UI components for consistent "Living Blueprint" aesthetic
// All components follow the centralized configuration system

class UIComponents {
    constructor(canvas, ctx, config) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.config = config;
        
        // Centralized color palette
        this.colors = {
            base: config.colors.base,
            primary: config.colors.primary_stroke,
            dim: config.colors.dim_stroke,
            glow: config.colors.glow_accent,
            error: config.colors.error_accent,
            white: config.colors.white,
            // Unified cyan for all UI elements
            uiCyan: config.colors.primary_stroke,
            // Leaderboard specific colors
            leaderboardCyan: config.colors.leaderboard_cyan || config.colors.primary_stroke
        };
        
        // Typography system
        this.typography = {
            title: {
                family: config.typography.title_font,
                weight: 'bold',
                letterSpacing: '0.08em'
            },
            primary: {
                family: config.typography.primary_font,
                weight: config.typography.ui_font_weight || 600,
                letterSpacing: 'normal'
            },
            monospace: {
                family: config.typography.monospace_font,
                weight: 'normal',
                letterSpacing: '0.05em'
            }
        };
        
        // Canvas state stack for proper isolation
        this.stateStack = [];
    }
    
    // =============================================================================
    // CANVAS STATE MANAGEMENT
    // =============================================================================
    
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
            lineWidth: this.ctx.lineWidth,
            letterSpacing: this.ctx.letterSpacing
        });
    }
    
    restoreState() {
        this.ctx.restore();
        if (this.stateStack.length > 0) {
            this.stateStack.pop();
        }
    }
    
    // =============================================================================
    // FROSTED GLASS PANELS
    // =============================================================================
    
    /**
     * Draws a consistent frosted glass panel used across all UI elements
     * @param {number} x - X position
     * @param {number} y - Y position  
     * @param {number} width - Panel width
     * @param {number} height - Panel height
     * @param {Object} options - Optional styling overrides
     */
    drawFrostedGlassPanel(x, y, width, height, options = {}) {
        this.saveState();
        
        const opts = {
            color: options.color || this.colors.leaderboardCyan,
            frostedAlpha: options.frostedAlpha || this.config.ui.leaderboard.frosted_glass_alpha,
            borderWidth: options.borderWidth || this.config.ui.leaderboard.border_width,
            borderAlpha: options.borderAlpha || 0.8,
            ...options
        };
        
        // Base frosted glass layer - more opaque cyan
        this.ctx.fillStyle = opts.color;
        this.ctx.globalAlpha = opts.frostedAlpha;
        this.ctx.fillRect(x, y, width, height);
        
        // Add darker layer for depth and frosted effect
        this.ctx.fillStyle = this.colors.base;
        this.ctx.globalAlpha = 0.4;
        this.ctx.fillRect(x, y, width, height);
        
        // Add subtle cyan tint layer
        this.ctx.fillStyle = opts.color;
        this.ctx.globalAlpha = 0.1;
        this.ctx.fillRect(x, y, width, height);
        
        // Add subtle noise/texture simulation
        this.ctx.fillStyle = this.colors.white;
        this.ctx.globalAlpha = 0.02;
        this.ctx.fillRect(x, y, width, height);
        
        // Hair-line border
        this.ctx.strokeStyle = opts.color;
        this.ctx.lineWidth = opts.borderWidth;
        this.ctx.globalAlpha = opts.borderAlpha;
        this.ctx.strokeRect(x, y, width, height);
        
        this.restoreState();
    }
    
    // =============================================================================
    // TEXT RENDERING
    // =============================================================================
    
    /**
     * Renders text with consistent typography styling
     * @param {string} text - Text to render
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {Object} style - Typography style configuration
     */
    drawText(text, x, y, style = {}) {
        this.saveState();
        
        const typography = this.typography[style.type] || this.typography.primary;
        
        // Set font properties
        const fontSize = style.size || this.config.ui.font_size || 16;
        const fontWeight = style.weight || typography.weight;
        const fontFamily = style.family || typography.family;
        this.ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        
        // Set text properties
        this.ctx.fillStyle = style.color || this.colors.primary;
        this.ctx.textAlign = style.align || 'left';
        this.ctx.textBaseline = style.baseline || 'alphabetic';
        this.ctx.letterSpacing = style.letterSpacing || typography.letterSpacing;
        this.ctx.globalAlpha = style.alpha || 1;
        
        // Set glow effect if specified
        if (style.glow) {
            this.ctx.shadowColor = style.glowColor || style.color || this.colors.primary;
            this.ctx.shadowBlur = style.glowIntensity || 10;
        }
        
        // Apply uppercase transformation if specified
        const displayText = style.uppercase ? text.toUpperCase() : text;
        
        // Render text
        this.ctx.fillText(displayText, x, y);
        
        this.restoreState();
    }
    
    /**
     * Measures text width with given style
     * @param {string} text - Text to measure
     * @param {Object} style - Typography style configuration
     * @returns {number} Text width in pixels
     */
    measureText(text, style = {}) {
        this.saveState();
        
        const typography = this.typography[style.type] || this.typography.primary;
        const fontSize = style.size || this.config.ui.font_size || 16;
        const fontWeight = style.weight || typography.weight;
        const fontFamily = style.family || typography.family;
        
        this.ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        this.ctx.letterSpacing = style.letterSpacing || typography.letterSpacing;
        
        const displayText = style.uppercase ? text.toUpperCase() : text;
        const width = this.ctx.measureText(displayText).width;
        
        this.restoreState();
        return width;
    }
    
    // =============================================================================
    // INTERACTIVE ELEMENTS
    // =============================================================================
    
    /**
     * Draws an interactive input field with frosted glass styling
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Input width
     * @param {number} height - Input height
     * @param {Object} state - Input state (focused, value, etc.)
     */
    drawInputField(x, y, width, height, state = {}) {
        this.saveState();
        
        // Draw frosted glass background
        this.drawFrostedGlassPanel(x, y, width, height, {
            color: this.colors.leaderboardCyan,
            frostedAlpha: this.config.ui.login_overlay.frosted_glass_alpha,
            borderAlpha: state.focused ? 1 : 0.6
        });
        
        // Add focus glow effect
        if (state.focused) {
            this.ctx.shadowColor = this.colors.leaderboardCyan;
            this.ctx.shadowBlur = this.config.ui.login_overlay.glow_intensity;
            this.ctx.strokeStyle = this.colors.leaderboardCyan;
            this.ctx.lineWidth = this.config.ui.login_overlay.border_width;
            this.ctx.strokeRect(x, y, width, height);
        }
        
        // Draw input text
        const textY = y + height / 2;
        const textX = x + 20; // Padding
        
        if (state.value) {
            this.drawText(state.value, textX, textY, {
                type: 'monospace',
                size: this.config.ui.login_overlay.font_size,
                color: this.colors.white,
                baseline: 'middle',
                uppercase: true
            });
        } else if (state.placeholder) {
            this.drawText(state.placeholder, textX, textY, {
                type: 'monospace',
                size: this.config.ui.login_overlay.font_size,
                color: this.colors.leaderboardCyan,
                alpha: 0.5,
                baseline: 'middle',
                uppercase: true
            });
        }
        
        // Draw cursor if focused
        if (state.focused && state.showCursor) {
            const textWidth = state.value ? this.measureText(state.value, {
                type: 'monospace',
                size: this.config.ui.login_overlay.font_size,
                uppercase: true
            }) : 0;
            
            this.ctx.fillStyle = this.colors.leaderboardCyan;
            this.ctx.fillRect(textX + textWidth + 3, textY - 8, 1, 16);
        }
        
        this.restoreState();
    }
    
    /**
     * Draws an interactive button with frosted glass styling
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Button width
     * @param {number} height - Button height
     * @param {string} text - Button text
     * @param {Object} state - Button state (hovered, pressed, etc.)
     */
    drawButton(x, y, width, height, text, state = {}) {
        this.saveState();
        
        // Draw frosted glass background
        this.drawFrostedGlassPanel(x, y, width, height, {
            color: this.colors.leaderboardCyan,
            frostedAlpha: this.config.ui.login_overlay.frosted_glass_alpha,
            borderAlpha: state.hovered ? 1 : 0.6
        });
        
        // Add hover glow effect
        if (state.hovered) {
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            
            // Create radial gradient for inner glow
            const gradient = this.ctx.createRadialGradient(
                centerX, centerY, 0,
                centerX, centerY, width / 2
            );
            const innerGlowAlpha = Math.floor(this.config.ui.login_overlay.button_inner_glow_alpha * 255).toString(16).padStart(2, '0');
            gradient.addColorStop(0, `${this.colors.leaderboardCyan}${innerGlowAlpha}`);
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(x, y, width, height);
            
            // Add outer glow
            this.ctx.shadowColor = this.colors.leaderboardCyan;
            this.ctx.shadowBlur = this.config.ui.login_overlay.glow_intensity;
            this.ctx.strokeStyle = this.colors.leaderboardCyan;
            this.ctx.lineWidth = this.config.ui.login_overlay.border_width;
            this.ctx.strokeRect(x, y, width, height);
        }
        
        // Draw button text
        this.drawText(text, x + width / 2, y + height / 2, {
            type: 'monospace',
            size: this.config.ui.login_overlay.font_size,
            color: this.colors.leaderboardCyan,
            align: 'center',
            baseline: 'middle',
            weight: 'bold',
            letterSpacing: '0.1em',
            uppercase: true
        });
        
        this.restoreState();
    }
    
    // =============================================================================
    // SPECIALIZED COMPONENTS
    // =============================================================================
    
    /**
     * Draws a player entry for the leaderboard
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Entry width
     * @param {Object} player - Player data
     * @param {boolean} isTopPlayer - Whether this is the top player
     * @param {boolean} isCurrentPlayer - Whether this is the current player
     */
    drawLeaderboardEntry(x, y, width, player, isTopPlayer, isCurrentPlayer) {
        this.saveState();
        
        const playerColor = `rgb(${player.rgb.r}, ${player.rgb.g}, ${player.rgb.b})`;
        const nameMaxWidth = width - 60; // Leave space for score
        const innerPadding = this.config.ui.leaderboard.inner_padding;
        
        // Set base alpha for non-top players
        let baseAlpha = isTopPlayer || isCurrentPlayer ? 1 : this.config.ui.leaderboard.regular_player_alpha;
        
        // Add glow effect for top player
        if (isTopPlayer) {
            const pulseIntensity = Math.sin(Date.now() * this.config.ui.leaderboard.pulse_speed) * 0.3 + 1;
            this.ctx.shadowColor = playerColor;
            this.ctx.shadowBlur = this.config.ui.leaderboard.top_player_glow_intensity * pulseIntensity;
        }
        
        // Extra glow for current player
        if (isCurrentPlayer) {
            this.ctx.shadowColor = playerColor;
            this.ctx.shadowBlur = 8;
        }
        
        // Draw player name (truncated if too long)
        let displayName = player.displayName || player.name || `Player ${player.id.substring(0, 6)}`;
        displayName = displayName.toUpperCase();
        
        // Truncate name if too long
        const nameStyle = {
            type: 'primary',
            size: this.config.ui.leaderboard.font_size,
            color: playerColor,
            alpha: baseAlpha,
            uppercase: true
        };
        
        while (this.measureText(displayName, nameStyle) > nameMaxWidth && displayName.length > 0) {
            displayName = displayName.slice(0, -1);
        }
        
        this.drawText(displayName, x + innerPadding, y, nameStyle);
        
        // Draw kill streak with monospace font
        this.drawText(player.killStreak.toString(), x + width - innerPadding, y, {
            type: 'monospace',
            size: this.config.ui.leaderboard.font_size,
            color: playerColor,
            alpha: baseAlpha,
            align: 'right'
        });
        
        this.restoreState();
    }
    
    /**
     * Draws a divider line
     * @param {number} x1 - Start X position
     * @param {number} y1 - Start Y position
     * @param {number} x2 - End X position
     * @param {number} y2 - End Y position
     * @param {Object} options - Styling options
     */
    drawDivider(x1, y1, x2, y2, options = {}) {
        this.saveState();
        
        this.ctx.strokeStyle = options.color || this.colors.leaderboardCyan;
        this.ctx.lineWidth = options.width || 1;
        this.ctx.globalAlpha = options.alpha || this.config.ui.leaderboard.divider_alpha;
        
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
        
        this.restoreState();
    }
    
    /**
     * Draws a pulsing kill streak indicator
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} killStreak - Kill streak count
     */
    drawKillStreakIndicator(x, y, killStreak) {
        this.saveState();
        
        const displayText = `KILL STREAK: ${killStreak}`;
        const color = killStreak >= 5 ? this.colors.glow : this.colors.leaderboardCyan;
        
        const textStyle = {
            type: 'title',
            size: this.config.ui.killstreak_display.label_font_size,
            color: color,
            align: 'center',
            baseline: 'middle',
            letterSpacing: '0.08em',
            uppercase: true
        };
        
        // Add pulsing glow for active kill streaks
        if (killStreak > 0) {
            const pulseIntensity = Math.sin(Date.now() * 0.005) * 0.3 + 1;
            textStyle.glow = true;
            textStyle.glowColor = color;
            textStyle.glowIntensity = this.config.ui.killstreak_display.glow_intensity * pulseIntensity;
        }
        
        this.drawText(displayText, x, y, textStyle);
        
        this.restoreState();
    }
    
    // =============================================================================
    // UTILITY METHODS
    // =============================================================================
    
    /**
     * Get logical canvas bounds (DPI-aware)
     * @returns {Object} Bounds object with width, height, centerX, centerY
     */
    getBounds() {
        return DPR.logicalBounds();
    }
    
    /**
     * Get logical canvas center (DPI-aware)
     * @returns {Object} Center object with x, y
     */
    getCenter() {
        return DPR.logicalCenter();
    }
    
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
     * Create bounds object for hit testing
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width
     * @param {number} height - Height
     * @returns {Object} Bounds object
     */
    createBounds(x, y, width, height) {
        return { x, y, width, height };
    }
}