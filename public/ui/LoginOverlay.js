class LoginOverlay {
    constructor(canvas, ctx, config, socket) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.config = config;
        this.socket = socket;
        this.palette = {
            base: this.config.colors.base,
            primaryStroke: this.config.colors.primary_stroke,
            dimStroke: this.config.colors.dim_stroke,
            glowAccent: this.config.colors.glow_accent,
            errorAccent: this.config.colors.error_accent,
            white: this.config.colors.white
        };
        
        this.isVisible = true;
        this.playerName = '';
        this.inputFocused = false;
        this.playButtonHovered = false;
        this.errorMessage = '';
        this.glowPulse = 0;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        const getLogicalCenter = () => {
            return DPR.logicalCenter();
        };
        this.handleKeyDown = (e) => {
            if (!this.isVisible) return;
            
            if (e.key === 'Enter') {
                this.handlePlayButton();
                return;
            }
            
            if (e.key === 'Backspace') {
                this.playerName = this.playerName.slice(0, -1);
                this.errorMessage = '';
                return;
            }
            
            if (e.key.length === 1 && this.playerName.length < 20) {
                this.playerName += e.key;
                this.errorMessage = '';
            }
        };
        
        this.handleMouseMove = (e) => {
            if (!this.isVisible) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const { x: centerX, y: centerY } = getLogicalCenter();
            // Position button below input field with proper spacing
            const buttonY = centerY + this.config.ui.login_overlay.input_height / 2 + this.config.ui.login_overlay.element_spacing;
            
            const buttonLeft = centerX - this.config.ui.login_overlay.button_width / 2;
            const buttonRight = centerX + this.config.ui.login_overlay.button_width / 2;
            const buttonTop = buttonY - this.config.ui.login_overlay.button_height / 2;
            const buttonBottom = buttonY + this.config.ui.login_overlay.button_height / 2;
            
            this.playButtonHovered = (x >= buttonLeft && x <= buttonRight && y >= buttonTop && y <= buttonBottom);
            this.canvas.style.cursor = this.playButtonHovered ? 'pointer' : 'default';
        };
        
        this.handleClick = (e) => {
            if (!this.isVisible) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const { x: centerX, y: centerY } = getLogicalCenter();
            
            // Check if clicking on input field
            const inputLeft = centerX - this.config.ui.login_overlay.input_width / 2;
            const inputRight = centerX + this.config.ui.login_overlay.input_width / 2;
            const inputTop = centerY - this.config.ui.login_overlay.input_height / 2;
            const inputBottom = centerY + this.config.ui.login_overlay.input_height / 2;
            
            this.inputFocused = (x >= inputLeft && x <= inputRight && y >= inputTop && y <= inputBottom);
            
            // Check if clicking on play button
            if (this.playButtonHovered) {
                this.handlePlayButton();
            }
        };
        
        document.addEventListener('keydown', this.handleKeyDown);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('click', this.handleClick);
    }
    
    handlePlayButton() {
        if (!this.playerName.trim()) {
            this.errorMessage = 'Please enter your name';
            return;
        }
        
        if (this.playerName.trim().length < 2) {
            this.errorMessage = 'Name must be at least 2 characters';
            return;
        }
        
        // Emit join game event with player name
        this.socket.emit('playerJoin', { name: this.playerName.trim() });
        this.hide();
    }
    
    hide() {
        this.isVisible = false;
        document.removeEventListener('keydown', this.handleKeyDown);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('click', this.handleClick);
        this.canvas.style.cursor = 'default';
    }
    
    show() {
        this.isVisible = true;
        this.setupEventListeners();
    }
    
    update() {
        if (!this.isVisible) return;
        
        // Update glow pulse effect
        this.glowPulse += 0.05;
        if (this.glowPulse > Math.PI * 2) {
            this.glowPulse = 0;
        }
    }
    
    render() {
        if (!this.isVisible) return;
        
        const ctx = this.ctx;
        const center = DPR.logicalCenter();
        const bounds = DPR.logicalBounds();
        const centerX = center.x;
        const centerY = center.y;
        
        ctx.save();
        
        // Draw background overlay - slightly more opaque
        ctx.fillStyle = this.palette.base;
        ctx.globalAlpha = this.config.ui.login_overlay.background_alpha;
        ctx.fillRect(0, 0, bounds.width, bounds.height);
        ctx.globalAlpha = 1;
        
        // Unified cyan color for consistency
        const unifiedCyan = this.config.ui.login_overlay.unified_cyan;
        
        // Draw title with tamed glow - crisp letters, angular font
        ctx.font = `bold ${this.config.ui.login_overlay.title_font_size}px ${this.config.typography.title_font}`;
        ctx.fillStyle = unifiedCyan;
        ctx.shadowColor = unifiedCyan;
        ctx.shadowBlur = this.config.ui.login_overlay.title_glow_intensity; // Much reduced glow
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.letterSpacing = '0.08em'; // Slightly wider tracking
        ctx.fillText('BLUEPRINT BATTLE', centerX, centerY - 85);
        ctx.shadowBlur = 0;
        ctx.letterSpacing = 'normal';
        
        // Draw subtitle with reduced intensity
        ctx.font = `${this.config.ui.login_overlay.font_size - 2}px ${this.config.typography.primary_font}`;
        ctx.fillStyle = unifiedCyan;
        ctx.globalAlpha = 0.7; // Control hierarchy with opacity
        ctx.fillText('Enter your callsign to join the battle', centerX, centerY - 55);
        ctx.globalAlpha = 1;
        
        // Input field with frosted glass background
        const inputX = centerX - this.config.ui.login_overlay.input_width / 2;
        const inputY = centerY - this.config.ui.login_overlay.input_height / 2;
        
        // Create frosted glass effect with multiple layers
        // Base frosted glass layer
        ctx.fillStyle = unifiedCyan;
        ctx.globalAlpha = this.config.ui.login_overlay.frosted_glass_alpha;
        ctx.fillRect(inputX, inputY, this.config.ui.login_overlay.input_width, this.config.ui.login_overlay.input_height);
        
        // Add a subtle darker layer for depth
        ctx.fillStyle = this.palette.base;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(inputX, inputY, this.config.ui.login_overlay.input_width, this.config.ui.login_overlay.input_height);
        
        // Add a lighter cyan highlight layer
        ctx.fillStyle = unifiedCyan;
        ctx.globalAlpha = 0.08;
        ctx.fillRect(inputX, inputY, this.config.ui.login_overlay.input_width, this.config.ui.login_overlay.input_height);
        ctx.globalAlpha = 1;
        
        // Hair-line 1px outline
        ctx.strokeStyle = unifiedCyan;
        ctx.lineWidth = this.config.ui.login_overlay.border_width;
        ctx.globalAlpha = this.inputFocused ? 1 : 0.6;
        
        if (this.inputFocused) {
            ctx.shadowColor = unifiedCyan;
            ctx.shadowBlur = this.config.ui.login_overlay.glow_intensity;
        }
        
        ctx.strokeRect(inputX, inputY, this.config.ui.login_overlay.input_width, this.config.ui.login_overlay.input_height);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        
        // Draw input text - monospace uppercase for consistency
        ctx.font = `${this.config.ui.login_overlay.font_size}px ${this.config.typography.monospace_font}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        
        const displayText = this.playerName ? this.playerName.toUpperCase() : 'CALLSIGN';
        const textColor = this.playerName ? this.palette.white : unifiedCyan;
        const textAlpha = this.playerName ? 1 : 0.5;
        
        ctx.fillStyle = textColor;
        ctx.globalAlpha = textAlpha;
        ctx.fillText(displayText, inputX + 20, centerY); // More generous padding
        ctx.globalAlpha = 1;
        
        // Draw cursor if input is focused
        if (this.inputFocused && Math.sin(this.glowPulse * 3) > 0) {
            const textWidth = this.playerName ? ctx.measureText(this.playerName.toUpperCase()).width : 0;
            ctx.fillStyle = unifiedCyan;
            ctx.fillRect(inputX + 20 + textWidth + 3, centerY - 8, 1, 16); // Hair-line cursor
        }
        
        // Play button - treated as a panel with frosted glass and inner glow
        const buttonX = centerX - this.config.ui.login_overlay.button_width / 2;
        const buttonCenterY = centerY + this.config.ui.login_overlay.input_height / 2 + this.config.ui.login_overlay.element_spacing;
        const buttonY = buttonCenterY - this.config.ui.login_overlay.button_height / 2;
        
        // Create frosted glass effect for button with multiple layers
        // Base frosted glass layer
        ctx.fillStyle = unifiedCyan;
        ctx.globalAlpha = this.config.ui.login_overlay.frosted_glass_alpha;
        ctx.fillRect(buttonX, buttonY, this.config.ui.login_overlay.button_width, this.config.ui.login_overlay.button_height);
        
        // Add a subtle darker layer for depth
        ctx.fillStyle = this.palette.base;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(buttonX, buttonY, this.config.ui.login_overlay.button_width, this.config.ui.login_overlay.button_height);
        
        // Add a lighter cyan highlight layer
        ctx.fillStyle = unifiedCyan;
        ctx.globalAlpha = 0.08;
        ctx.fillRect(buttonX, buttonY, this.config.ui.login_overlay.button_width, this.config.ui.login_overlay.button_height);
        ctx.globalAlpha = 1;
        
        // Subtle inner glow for button panel (radial from center) when hovered
        if (this.playButtonHovered) {
            const gradient = ctx.createRadialGradient(
                centerX, buttonCenterY, 0,
                centerX, buttonCenterY, this.config.ui.login_overlay.button_width / 2
            );
            gradient.addColorStop(0, `${unifiedCyan}${Math.floor(this.config.ui.login_overlay.button_inner_glow_alpha * 255).toString(16).padStart(2, '0')}`);
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(buttonX, buttonY, this.config.ui.login_overlay.button_width, this.config.ui.login_overlay.button_height);
        }
        
        // Hair-line button outline
        ctx.strokeStyle = unifiedCyan;
        ctx.lineWidth = this.config.ui.login_overlay.border_width;
        ctx.globalAlpha = this.playButtonHovered ? 1 : 0.6;
        
        if (this.playButtonHovered) {
            ctx.shadowColor = unifiedCyan;
            ctx.shadowBlur = this.config.ui.login_overlay.glow_intensity;
        }
        
        ctx.strokeRect(buttonX, buttonY, this.config.ui.login_overlay.button_width, this.config.ui.login_overlay.button_height);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        
        // Button text - monospace uppercase
        ctx.font = `bold ${this.config.ui.login_overlay.font_size}px ${this.config.typography.monospace_font}`;
        ctx.fillStyle = unifiedCyan;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.letterSpacing = '0.1em';
        ctx.fillText('PLAY', centerX, buttonCenterY);
        ctx.letterSpacing = 'normal';
        
        // Draw error message if present - using unified cyan with reduced opacity
        if (this.errorMessage) {
            ctx.font = `${this.config.ui.login_overlay.font_size - 2}px ${this.config.typography.primary_font}`;
            ctx.fillStyle = this.palette.errorAccent;
            ctx.globalAlpha = 0.9;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.errorMessage, centerX, buttonCenterY + this.config.ui.login_overlay.button_height / 2 + 25);
            ctx.globalAlpha = 1;
        }
        
        // Instructions - using unified cyan with low opacity
        ctx.font = `${this.config.ui.login_overlay.font_size - 3}px ${this.config.typography.monospace_font}`;
        ctx.fillStyle = unifiedCyan;
        ctx.globalAlpha = 0.4;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.letterSpacing = '0.05em';
        ctx.fillText('PRESS ENTER TO PLAY', centerX, buttonCenterY + this.config.ui.login_overlay.button_height / 2 + 55);
        ctx.letterSpacing = 'normal';
        ctx.globalAlpha = 1;
        
        ctx.restore();
    }
}