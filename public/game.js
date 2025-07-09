// =================================================================================
// BLUEPRINT BATTLE - MULTIPLAYER CLIENT
// =================================================================================

// "Living Blueprint" color palette - loaded from CONFIG
let PALETTE = {
    base: '#000000',
    primaryStroke: '#9EE7FF',
    dimStroke: '#3A5F7F',
    glowAccent: '#00FFF7',
    errorAccent: '#FF5C5C',
    white: '#FFFFFF'
};

// Global game state
let canvas, ctx;
let socket;
let gameState = {
    tanks: [],
    bullets: [],
    arena: null,
    timestamp: 0
};
let myPlayerId = null;
let camera;
let clientArena;
let backgroundPattern;
let loginOverlay;
let playerDeathState = {
    isDead: false,
    respawnTime: 0,
    deathTime: 0
};

let combatEffects = {
    muzzleFlashes: [],
    hitFlashes: [],
    deathFades: []
};

// Input state
const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false,
    space: false
};

// Utility functions
const lerp = (a, b, t) => a + (b - a) * t;

const normalizeAngle = (angle) => {
    while (angle < -Math.PI) angle += Math.PI * 2;
    while (angle > Math.PI) angle -= Math.PI * 2;
    return angle;
};

// Background pattern creation
function createBackgroundPattern() {
    const patternCanvas = document.createElement('canvas');
    const patternCtx = patternCanvas.getContext('2d');
    const size = CONFIG.background_pattern.cell_size;
    const dotRadius = CONFIG.background_pattern.dot_radius;
    
    patternCanvas.width = size;
    patternCanvas.height = size;
    
    patternCtx.fillStyle = PALETTE.base;
    patternCtx.fillRect(0, 0, size, size);
    
    patternCtx.fillStyle = PALETTE.dimStroke;
    patternCtx.globalAlpha = CONFIG.background_pattern.dot_alpha;
    patternCtx.beginPath();
    patternCtx.arc(size / 2, size / 2, dotRadius, 0, Math.PI * 2);
    patternCtx.fill();
    
    return ctx.createPattern(patternCanvas, 'repeat');
}

// Initialize game
function init() {
    try {
        canvas = document.getElementById('gameCanvas');
        if (!canvas) {
            console.error('Could not find game canvas element');
            return;
        }
        
        ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Could not get 2D context from canvas');
            return;
        }
        
        // Disable smoothing so 1-px blueprint lines stay crisp and avoid anti-aliased shimmer
        ctx.imageSmoothingEnabled = false;
        
        // Initialize PALETTE from CONFIG
        PALETTE = {
            base: CONFIG.colors.base,
            primaryStroke: CONFIG.colors.primary_stroke,
            dimStroke: CONFIG.colors.dim_stroke,
            glowAccent: CONFIG.colors.glow_accent,
            errorAccent: CONFIG.colors.error_accent,
            white: CONFIG.colors.white
        };
        
        // Set canvas size
        resizeCanvas();
        
        // Initialize game objects
        camera = new Camera();
        clientArena = new ClientArena();
        backgroundPattern = createBackgroundPattern();
        
        // Create socket connection (but don't join game yet)
        socket = io();
        setupSocketEvents();
        
        // Create login overlay
        loginOverlay = new LoginOverlay(canvas, ctx, CONFIG, socket);
        
        // Setup input handling
        setupInputHandlers();
        
        // Start game loop (will show login overlay first)
        gameLoop();
        
        console.log('Blueprint Battle initialized successfully');
    } catch (error) {
        console.error('Failed to initialize game:', error);
        // Try to display an error message to the user
        document.body.innerHTML = `<div style="${CONFIG.typography.error_message_style}">Failed to initialize Blueprint Battle. Please refresh the page.</div>`;
    }
}

// Canvas resizing
function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    // Set canvas CSS size
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    // Set actual pixel buffer to match DPR
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    // Reset any prior transforms then apply DPR scaling so 1 unit == 1 CSS pixel
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    backgroundPattern = createBackgroundPattern();
}

// Socket.IO event handlers
function setupSocketEvents() {
    socket.on('connect', () => {
        console.log('Connected to server');
        myPlayerId = socket.id;
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
    
    socket.on('playerJoined', (data) => {
        if (data.playerId === myPlayerId) {
            console.log('Successfully joined game with name:', data.name);
            // Player successfully joined, login overlay will be hidden by LoginOverlay class
        }
    });
    
    socket.on('gameState', (state) => {
        gameState = state;
        // updateUI(); // Disabled - using Canvas UI instead of DOM UI
    });
    
    socket.on('playerKilled', (data) => {
        if (data.victim === myPlayerId) {
            // Handle death effects
            camera.addShake(CONFIG.visual.combat_effects.death_shake_magnitude);
            playerDeathState.isDead = true;
            playerDeathState.deathTime = Date.now();
            playerDeathState.respawnTime = Date.now() + CONFIG.combat.respawn_delay_ms;
        }
        
        // Add death fade effect at victim's position
        const victimTank = gameState.tanks.find(tank => tank.id === data.victim);
        if (victimTank) {
            addDeathFade(victimTank.x, victimTank.y);
        }
    });
    
    socket.on('playerRespawned', (data) => {
        if (data.playerId === myPlayerId) {
            // Handle respawn effects
            camera.addShake(CONFIG.camera.shake_magnitude);
            playerDeathState.isDead = false;
            playerDeathState.respawnTime = 0;
            playerDeathState.deathTime = 0;
        }
    });
    
    socket.on('killStreakUpdate', (data) => {
        if (data.playerId === myPlayerId) {
            // Handle kill streak update
            camera.addShake(CONFIG.camera.shake_magnitude);
        }
    });
    
    socket.on('playerShot', (data) => {
        // Add muzzle flash effect at shooter's position
        const shooterTank = gameState.tanks.find(tank => tank.id === data.playerId);
        if (shooterTank) {
            addMuzzleFlash(shooterTank.x, shooterTank.y);
            
            // Add camera shake for player's own shots
            if (data.playerId === myPlayerId) {
                camera.addShake(CONFIG.camera.shake_magnitude * CONFIG.camera.shake_multiplier);
            }
        }
    });
    
    socket.on('bulletHit', (data) => {
        // Add hit flash effect at bullet impact position
        addHitFlash(data.x, data.y);
        
        // Add camera shake for hits
        camera.addShake(CONFIG.visual.combat_effects.impact_shake_magnitude);
    });
}

// Input handling
function setupInputHandlers() {
    window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (key in keys) {
            keys[key] = true;
        }

        if (e.repeat) return;

        switch (key) {
            case 'w':
                if (!keys.shift) {
                    socket.emit('playerMove', { direction: 'forward' });
                }
                break;
            case 's':
                if (!keys.shift) {
                    socket.emit('playerMove', { direction: 'backward' });
                }
                break;
            case 'a':
                socket.emit('playerRotate', { direction: 'left' });
                break;
            case 'd':
                socket.emit('playerRotate', { direction: 'right' });
                break;
            case ' ':
                e.preventDefault();
                socket.emit('playerShoot');
                socket.emit('playerPickupAmmo');
                camera.addShake(CONFIG.camera.shake_magnitude * CONFIG.camera.shake_multiplier);
                break;
            case 'shift':
                socket.emit('speedModeToggle', { enabled: true });
                break;
        }
    });

    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (key in keys) {
            keys[key] = false;
        }

        if (key === 'shift') {
            socket.emit('speedModeToggle', { enabled: false });
        }
    });
    
    window.addEventListener('resize', resizeCanvas);
}

// Handle continuous movement in speed mode
let lastSpeedModeMove = 0;
function handleSpeedMode() {
    if (keys.shift) {
        const now = Date.now();
        const speedModeDelay = CONFIG.player.move_cooldown_speed_mode * CONFIG.ui.frame_to_ms; // Convert frames to ms
        
        if (now - lastSpeedModeMove >= speedModeDelay) {
            let moved = false;
            if (keys.w) {
                socket.emit('playerMove', { direction: 'forward' });
                moved = true;
            } else if (keys.s) {
                socket.emit('playerMove', { direction: 'backward' });
                moved = true;
            }
            
            if (moved) {
                lastSpeedModeMove = now;
            }
        }
    }
}

// Update UI elements
function updateUI() {
    const myTank = gameState.tanks.find(tank => tank.id === myPlayerId);
    if (myTank) {
        document.getElementById('killstreak').textContent = `Kill Streak: ${myTank.killStreak}`;
        document.getElementById('ammo').textContent = `Ammo: ${myTank.ammo}`;
    }
}

// Combat effects management
function addMuzzleFlash(x, y) {
    combatEffects.muzzleFlashes.push({
        x: x,
        y: y,
        duration: CONFIG.visual.combat_effects.muzzle_flash_duration,
        maxDuration: CONFIG.visual.combat_effects.muzzle_flash_duration
    });
}

function addHitFlash(x, y) {
    combatEffects.hitFlashes.push({
        x: x,
        y: y,
        duration: CONFIG.visual.combat_effects.hit_flash_duration,
        maxDuration: CONFIG.visual.combat_effects.hit_flash_duration
    });
}

function addDeathFade(x, y) {
    combatEffects.deathFades.push({
        x: x,
        y: y,
        duration: CONFIG.visual.combat_effects.death_fade_duration,
        maxDuration: CONFIG.visual.combat_effects.death_fade_duration,
        alpha: 1.0
    });
}

function updateCombatEffects() {
    // Update muzzle flashes
    combatEffects.muzzleFlashes = combatEffects.muzzleFlashes.filter(flash => {
        flash.duration--;
        return flash.duration > 0;
    });
    
    // Update hit flashes
    combatEffects.hitFlashes = combatEffects.hitFlashes.filter(flash => {
        flash.duration--;
        return flash.duration > 0;
    });
    
    // Update death fades
    combatEffects.deathFades = combatEffects.deathFades.filter(fade => {
        fade.duration--;
        fade.alpha = fade.duration / fade.maxDuration;
        return fade.duration > 0;
    });
}

function drawCombatEffects() {
    ctx.save();
    
    // Draw muzzle flashes
    combatEffects.muzzleFlashes.forEach(flash => {
        const alpha = flash.duration / flash.maxDuration;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = PALETTE.glowAccent;
        ctx.shadowColor = PALETTE.glowAccent;
        ctx.shadowBlur = CONFIG.visual.combat_effects.muzzle_flash_intensity;
        ctx.beginPath();
        ctx.arc(flash.x, flash.y, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    });
    
    // Draw hit flashes
    combatEffects.hitFlashes.forEach(flash => {
        const alpha = flash.duration / flash.maxDuration;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = PALETTE.errorAccent;
        ctx.shadowColor = PALETTE.errorAccent;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(flash.x, flash.y, CONFIG.visual.combat_effects.hit_flash_radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    });
    
    // Draw death fades
    combatEffects.deathFades.forEach(fade => {
        ctx.globalAlpha = fade.alpha;
        ctx.strokeStyle = PALETTE.errorAccent;
        ctx.shadowColor = PALETTE.errorAccent;
        ctx.shadowBlur = 10;
        ctx.lineWidth = 3;
        const size = 60 * (1 - fade.alpha / fade.maxDuration);
        ctx.strokeRect(fade.x - size/2, fade.y - size/2, size, size);
        ctx.shadowBlur = 0;
    });
    
    ctx.globalAlpha = 1;
    ctx.restore();
}

// Draw Canvas-based UI elements
function drawUI() {
    const myTank = gameState.tanks.find(tank => tank.id === myPlayerId);
    if (!myTank) return;
    
    ctx.save();
    
    // Draw kill streak display
    drawKillStreakDisplay(myTank.killStreak);
    
    // Draw leaderboard
    drawLeaderboard();
    
    ctx.restore();
}

// Draw kill streak display with Blueprint aesthetic
function drawKillStreakDisplay(killStreak) {
    const dpr = window.devicePixelRatio || 1;
    const logicalLeft = CONFIG.ui.killstreak_display.position.left;
    const logicalTop  = CONFIG.ui.killstreak_display.position.top;
    const x = logicalLeft;
    const y = logicalTop;
    const width = CONFIG.ui.killstreak_display.width;
    const height = CONFIG.ui.killstreak_display.height;
    
    ctx.save();
    
    // Create improved frosted glass effect with multiple layers
    const unifiedCyan = CONFIG.colors.leaderboard_cyan; // Use same cyan as leaderboard
    
    // Base frosted glass layer - more opaque
    ctx.fillStyle = unifiedCyan;
    ctx.globalAlpha = CONFIG.ui.killstreak_display.frosted_glass_alpha;
    ctx.fillRect(x, y, width, height);
    
    // Add a darker layer for depth and frosted effect
    ctx.fillStyle = PALETTE.base;
    ctx.globalAlpha = 0.4; // Increased opacity for more frosted look
    ctx.fillRect(x, y, width, height);
    
    // Add a subtle cyan tint layer
    ctx.fillStyle = unifiedCyan;
    ctx.globalAlpha = 0.1;
    ctx.fillRect(x, y, width, height);
    
    // Add noise/texture simulation with very subtle pattern
    ctx.fillStyle = PALETTE.white;
    ctx.globalAlpha = 0.02;
    ctx.fillRect(x, y, width, height);
    ctx.globalAlpha = 1;
    
    // Draw hair-line cyan outline
    ctx.strokeStyle = unifiedCyan;
    ctx.lineWidth = CONFIG.ui.killstreak_display.border_width;
    ctx.globalAlpha = 0.8;
    ctx.strokeRect(x, y, width, height);
    ctx.globalAlpha = 1;
    
    // Center content vertically and horizontally within the panel
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    
    // Draw "KILL STREAK: 5" all on one line
    const displayText = `KILL STREAK: ${killStreak}`;
    
    // Use angular font for consistency
    ctx.font = `${CONFIG.ui.killstreak_display.label_font_size}px ${CONFIG.typography.title_font}`;
    ctx.fillStyle = unifiedCyan;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '0.08em';
    
    // Add reduced glow effect for active kill streaks
    if (killStreak > 0) {
        const pulseIntensity = Math.sin(Date.now() * 0.005) * 0.3 + 1;
        ctx.shadowBlur = CONFIG.ui.killstreak_display.glow_intensity * pulseIntensity;
        ctx.shadowColor = unifiedCyan;
        
        // Add extra glow for high kill streaks
        if (killStreak >= 5) {
            ctx.shadowColor = PALETTE.glowAccent;
            ctx.fillStyle = PALETTE.glowAccent;
        }
    }
    
    ctx.fillText(displayText, centerX, centerY);
    
    // Reset shadow and letter spacing
    ctx.shadowBlur = 0;
    ctx.letterSpacing = 'normal';
    ctx.restore();
}

// Draw leaderboard with Blueprint aesthetic
function drawLeaderboard() {
    if (!gameState.tanks || gameState.tanks.length === 0) return;
    
    const dpr = window.devicePixelRatio || 1;
    const logicalCanvasWidth = canvas.width / dpr;
    
    const x = logicalCanvasWidth - CONFIG.ui.leaderboard.position.right - CONFIG.ui.leaderboard.width;
    const y = CONFIG.ui.leaderboard.position.top;
    
    // Sort players by kill streak (highest first)
    // Show all players, use ID as fallback if no name
    const sortedPlayers = gameState.tanks
        .map(tank => ({
            ...tank,
            displayName: tank.name || `Player ${tank.id.substring(0, 6)}`
        }))
        .sort((a, b) => b.killStreak - a.killStreak)
        .slice(0, CONFIG.ui.leaderboard.max_players);
    
    if (sortedPlayers.length === 0) return;
    
    const panelHeight = CONFIG.ui.leaderboard.padding * 2 + 
                       CONFIG.ui.leaderboard.row_height * (sortedPlayers.length + 1.5);
    
    ctx.save();
    
    // Create frosted glass effect with multiple layers
    const unifiedCyan = CONFIG.colors.leaderboard_cyan;
    
    // Base frosted glass layer - more opaque
    ctx.fillStyle = unifiedCyan;
    ctx.globalAlpha = CONFIG.ui.leaderboard.frosted_glass_alpha;
    ctx.fillRect(x, y, CONFIG.ui.leaderboard.width, panelHeight);
    
    // Add a darker layer for depth and frosted effect
    ctx.fillStyle = PALETTE.base;
    ctx.globalAlpha = 0.4; // Increased opacity for more frosted look
    ctx.fillRect(x, y, CONFIG.ui.leaderboard.width, panelHeight);
    
    // Add a subtle cyan tint layer
    ctx.fillStyle = unifiedCyan;
    ctx.globalAlpha = 0.1;
    ctx.fillRect(x, y, CONFIG.ui.leaderboard.width, panelHeight);
    
    // Add noise/texture simulation with very subtle pattern
    ctx.fillStyle = PALETTE.white;
    ctx.globalAlpha = 0.02;
    ctx.fillRect(x, y, CONFIG.ui.leaderboard.width, panelHeight);
    ctx.globalAlpha = 1;
    
    // Draw hair-line cyan outline
    ctx.strokeStyle = unifiedCyan;
    ctx.lineWidth = CONFIG.ui.leaderboard.border_width;
    ctx.globalAlpha = 0.8;
    ctx.strokeRect(x, y, CONFIG.ui.leaderboard.width, panelHeight);
    ctx.globalAlpha = 1;
    
    // Draw header with angular monospaced type
    ctx.font = `${CONFIG.ui.leaderboard.title_font_weight} ${CONFIG.ui.leaderboard.header_font_size}px ${CONFIG.typography.title_font}`;
    ctx.fillStyle = unifiedCyan;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = CONFIG.ui.leaderboard.title_letter_spacing;
    
    const headerY = y + CONFIG.ui.leaderboard.padding + CONFIG.ui.leaderboard.row_height / 2;
    ctx.fillText('LEADERBOARD', x + CONFIG.ui.leaderboard.width / 2, headerY);
    
    // Reset letter spacing for player entries
    ctx.letterSpacing = 'normal';
    
    // Draw faint divider line below header
    const dividerY = headerY + CONFIG.ui.leaderboard.row_height / 2;
    ctx.strokeStyle = unifiedCyan;
    ctx.globalAlpha = CONFIG.ui.leaderboard.divider_alpha;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + CONFIG.ui.leaderboard.inner_padding, dividerY);
    ctx.lineTo(x + CONFIG.ui.leaderboard.width - CONFIG.ui.leaderboard.inner_padding, dividerY);
    ctx.stroke();
    ctx.globalAlpha = 1;
    
    // Draw players with improved typography
    ctx.font = `${CONFIG.ui.leaderboard.font_size}px ${CONFIG.typography.primary_font}`;
    ctx.textAlign = 'left';
    
    sortedPlayers.forEach((player, index) => {
        const rowY = y + CONFIG.ui.leaderboard.padding + CONFIG.ui.leaderboard.row_height * (index + 2);
        const isTopPlayer = index === 0;
        
        // Special styling for top player with additive pulse
        if (isTopPlayer) {
            const pulseIntensity = Math.sin(Date.now() * CONFIG.ui.leaderboard.pulse_speed) * 0.3 + 1;
            ctx.fillStyle = unifiedCyan;
            ctx.shadowColor = unifiedCyan;
            ctx.shadowBlur = CONFIG.ui.leaderboard.top_player_glow_intensity * pulseIntensity;
        } else {
            // Cooler, dimmer cyan for other players
            ctx.fillStyle = unifiedCyan;
            ctx.globalAlpha = CONFIG.ui.leaderboard.regular_player_alpha;
            ctx.shadowBlur = 0;
        }
        
        // Highlight current player with different glow
        if (player.id === myPlayerId) {
            ctx.fillStyle = PALETTE.glowAccent;
            ctx.shadowColor = PALETTE.glowAccent;
            ctx.shadowBlur = 8;
        }
        
        // Draw player name (truncated if too long)
        const maxNameWidth = CONFIG.ui.leaderboard.width - 60; // Leave space for score
        let displayName = player.displayName.toUpperCase(); // Convert to uppercase for consistency
        while (ctx.measureText(displayName).width > maxNameWidth && displayName.length > 0) {
            displayName = displayName.slice(0, -1);
        }
        ctx.fillText(displayName, x + CONFIG.ui.leaderboard.inner_padding, rowY);
        
        // Draw kill streak with monospace font for numbers
        ctx.font = `${CONFIG.ui.leaderboard.font_size}px ${CONFIG.typography.monospace_font}`;
        ctx.textAlign = 'right';
        ctx.fillText(player.killStreak.toString(), 
                     x + CONFIG.ui.leaderboard.width - CONFIG.ui.leaderboard.inner_padding, 
                     rowY);
        
        // Reset font for next iteration
        ctx.font = `${CONFIG.ui.leaderboard.font_size}px ${CONFIG.typography.primary_font}`;
        ctx.textAlign = 'left';
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    });
    
    ctx.restore();
}

// Draw death screen with respawn countdown
function drawDeathScreen() {
    if (!playerDeathState.isDead) return;
    
    const now = Date.now();
    const remainingTime = Math.max(0, playerDeathState.respawnTime - now);
    const secondsLeft = Math.ceil(remainingTime / 1000);
    
    // Draw background overlay
    ctx.fillStyle = PALETTE.base;
    ctx.globalAlpha = CONFIG.ui.death_screen.background_alpha;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Draw death message
    ctx.font = `${CONFIG.ui.death_screen.message_font_size}px ${CONFIG.typography.primary_font}`;
    ctx.fillStyle = PALETTE.errorAccent;
    ctx.shadowColor = PALETTE.errorAccent;
    ctx.shadowBlur = 15;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('YOU DIED', centerX, centerY - 80);
    ctx.shadowBlur = 0;
    
    // Draw countdown timer
    if (secondsLeft > 0) {
        ctx.font = `${CONFIG.ui.death_screen.countdown_font_size}px ${CONFIG.typography.primary_font}`;
        ctx.fillStyle = PALETTE.primaryStroke;
        ctx.shadowColor = PALETTE.primaryStroke;
        ctx.shadowBlur = CONFIG.ui.death_screen.glow_intensity;
        
        // Add pulsing effect
        const pulse = Math.sin(now * CONFIG.ui.death_screen.pulse_speed) * 0.2 + 1;
        ctx.shadowBlur = CONFIG.ui.death_screen.glow_intensity * pulse;
        
        ctx.fillText(secondsLeft.toString(), centerX, centerY);
        ctx.shadowBlur = 0;
        
        // Draw "Respawning in" text
        ctx.font = `${CONFIG.ui.death_screen.message_font_size - 4}px ${CONFIG.typography.primary_font}`;
        ctx.fillStyle = PALETTE.dimStroke;
        ctx.fillText('Respawning in', centerX, centerY - 40);
    } else {
        // Draw "Respawning..." text
        ctx.font = `${CONFIG.ui.death_screen.message_font_size}px ${CONFIG.typography.primary_font}`;
        ctx.fillStyle = PALETTE.glowAccent;
        ctx.shadowColor = PALETTE.glowAccent;
        ctx.shadowBlur = 10;
        ctx.fillText('Respawning...', centerX, centerY);
        ctx.shadowBlur = 0;
    }
    
    // Draw respawn button (optional - for instant respawn if implemented)
    if (secondsLeft <= 0) {
        const buttonX = centerX - CONFIG.ui.death_screen.button_width / 2;
        const buttonY = centerY + CONFIG.ui.death_screen.element_spacing - CONFIG.ui.death_screen.button_height / 2;
        
        ctx.strokeStyle = PALETTE.primaryStroke;
        ctx.lineWidth = 2;
        ctx.strokeRect(buttonX, buttonY, CONFIG.ui.death_screen.button_width, CONFIG.ui.death_screen.button_height);
        
        ctx.font = `${CONFIG.ui.death_screen.message_font_size - 4}px ${CONFIG.typography.primary_font}`;
        ctx.fillStyle = PALETTE.primaryStroke;
        ctx.fillText('RESPAWN', centerX, centerY + CONFIG.ui.death_screen.element_spacing);
    }
}

// Main game loop
function gameLoop() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background pattern
    ctx.fillStyle = backgroundPattern;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Check if login overlay is visible
    if (loginOverlay && loginOverlay.isVisible) {
        // Update and render login overlay
        loginOverlay.update();
        loginOverlay.render();
    } else {
        // Normal game rendering
        // Handle continuous input
        handleSpeedMode();
        
        // Update combat effects
        updateCombatEffects();
        
        // Update camera
        camera.update(gameState, myPlayerId);
        
        // Apply camera transformation
        ctx.save();
        // Translate to screen center (CSS pixels)
        const dpr = window.devicePixelRatio || 1;
        ctx.translate(canvas.width / (2 * dpr), canvas.height / (2 * dpr));
        
        // Apply camera shake
        if (camera.shake > CONFIG.camera.shake_threshold) {
            ctx.translate(
                (Math.random() - 0.5) * camera.shake,
                (Math.random() - 0.5) * camera.shake
            );
            camera.shake *= CONFIG.camera.shake_decay;
        }
        
        // Apply camera rotation and position
        ctx.rotate(camera.rotation);
        // Apply zoom (FOV scaling)
        ctx.scale(camera.zoom, camera.zoom);
        // Pixel-snap translation so scaled world units land on whole device pixels (includes DPR)
        const factor = camera.zoom * dpr;
        const roundedCamX = Math.round(camera.x * factor) / factor;
        const roundedCamY = Math.round(camera.y * factor) / factor;
        ctx.translate(-roundedCamX, -roundedCamY);
        
        // Draw arena
        clientArena.draw(ctx, gameState.arena);
        
        // Draw tanks
        gameState.tanks.forEach(tankData => {
            const tank = new ClientTank(tankData);
            tank.draw(ctx, tankData.id === myPlayerId);
        });
        
        // Draw bullets
        gameState.bullets.forEach(bulletData => {
            const bullet = new ClientBullet(bulletData);
            bullet.draw(ctx);
        });
        
        // Draw combat effects
        drawCombatEffects();
        
        ctx.restore();
        
        // Draw Canvas-based UI elements
        drawUI();
    }
    
    // Draw death screen (on top of everything)
    drawDeathScreen();
    
    // Continue game loop
    requestAnimationFrame(gameLoop);
}

// Error handler to suppress browser extension errors
window.addEventListener('error', (event) => {
    // Suppress errors from browser extensions (content scripts)
    if (event.filename && event.filename.includes('content_script.js')) {
        event.preventDefault();
        return false;
    }
    // Suppress specific extension-related errors
    if (event.message && (
        event.message.includes('ControlLooksLikePasswordCredentialField') ||
        event.message.includes('Cannot read properties of null') ||
        event.message.includes('extension') ||
        event.message.includes('chrome-extension') ||
        event.message.includes('moz-extension')
    )) {
        event.preventDefault();
        return false;
    }
});

// Fetch gameplay configuration from server so client and server share a single source of truth
async function loadConfig() {
    const response = await fetch('/config');
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    CONFIG = await response.json();
}

// Wait for configuration before bootstrapping the client
window.addEventListener('load', async () => {
    try {
        await loadConfig();
        init();
    } catch (err) {
        console.error('Failed to load configuration', err);
        // Fallback styling since CONFIG may not be available
        document.body.innerHTML = '<div style="color: #FF5C5C; font-family: Inter; padding: 20px; text-align: center;">Failed to load Blueprint Battle configuration. Please refresh the page.</div>';
    }
});