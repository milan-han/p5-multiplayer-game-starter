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

// Phase 10: Animation System Components
let deltaTime;
let interpolationBuffer;
let networkManager;
let animationManager;
let entityEvents = new Map(); // Store events for animation state machines
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
        
        // Initialize Phase 10 animation system
        deltaTime = new DeltaTime();
        interpolationBuffer = new InterpolationBuffer(deltaTime);
        
        // Initialize game objects
        camera = new Camera(deltaTime);
        clientArena = new ClientArena();
        backgroundPattern = createBackgroundPattern();
        
        // Create socket connection (but don't join game yet)
        socket = io();
        setupSocketEvents();
        
        // Initialize network manager with enhanced prediction
        networkManager = new NetworkManager(socket, deltaTime);
        
        // Initialize animation manager for centralized rendering
        animationManager = new AnimationManager(canvas, ctx, deltaTime);
        
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
    
    // Phase 10: Update animation manager on resize
    if (animationManager) {
        animationManager.onResize();
    }
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
        
        // Phase 10: Add state to interpolation buffer
        interpolationBuffer.addSnapshot(state);
        
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
        
        // Phase 10: Add event for animation state machine
        addEntityEvent(data.victim, {
            type: 'playerKilled',
            victim: data.victim,
            killer: data.killer,
            timestamp: Date.now()
        });
    });
    
    socket.on('playerRespawned', (data) => {
        if (data.playerId === myPlayerId) {
            // Handle respawn effects
            camera.addShake(CONFIG.camera.shake_magnitude);
            playerDeathState.isDead = false;
            playerDeathState.respawnTime = 0;
            playerDeathState.deathTime = 0;
        }
        
        // Phase 10: Add event for animation state machine
        addEntityEvent(data.playerId, {
            type: 'playerRespawned',
            playerId: data.playerId,
            timestamp: Date.now()
        });
    });
    
    socket.on('killStreakUpdate', (data) => {
        if (data.playerId === myPlayerId) {
            // Handle kill streak update
            camera.addShake(CONFIG.camera.shake_magnitude);
        }
    });
    
    socket.on('playerShot', (data) => {
        // Add camera shake for player's own shots
        if (data.playerId === myPlayerId) {
            camera.addShake(CONFIG.camera.shake_magnitude * CONFIG.camera.shake_multiplier);
        }
        
        // Phase 10: Add event for animation state machine
        addEntityEvent(data.playerId, {
            type: 'playerShot',
            playerId: data.playerId,
            timestamp: Date.now()
        });
    });
    
    socket.on('bulletHit', (data) => {
        // Add camera shake for hits
        camera.addShake(CONFIG.visual.combat_effects.impact_shake_magnitude);
        
        // Phase 10: Add event for animation state machine
        if (data.targetId) {
            addEntityEvent(data.targetId, {
                type: 'bulletHit',
                targetId: data.targetId,
                x: data.x,
                y: data.y,
                timestamp: Date.now()
            });
        }
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
                    // Phase 10: Use network manager for enhanced prediction
                    networkManager.sendInput('playerMove', { direction: 'forward' });
                }
                break;
            case 's':
                if (!keys.shift) {
                    // Phase 10: Use network manager for enhanced prediction
                    networkManager.sendInput('playerMove', { direction: 'backward' });
                }
                break;
            case 'a':
                // Phase 10: Use network manager for enhanced prediction
                networkManager.sendInput('playerRotate', { direction: 'left' });
                break;
            case 'd':
                // Phase 10: Use network manager for enhanced prediction
                networkManager.sendInput('playerRotate', { direction: 'right' });
                break;
            case ' ':
                e.preventDefault();
                // Phase 10: Use network manager for enhanced prediction
                networkManager.sendInput('playerShoot', {});
                networkManager.sendInput('playerPickupAmmo', {});
                camera.addShake(CONFIG.camera.shake_magnitude * CONFIG.camera.shake_multiplier);
                break;
            case 'shift':
                // Phase 10: Use network manager for enhanced prediction
                networkManager.sendInput('speedModeToggle', { enabled: true });
                break;
        }
    });

    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (key in keys) {
            keys[key] = false;
        }

        if (key === 'shift') {
            // Phase 10: Use network manager for enhanced prediction
            networkManager.sendInput('speedModeToggle', { enabled: false });
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
                // Phase 10: Use network manager for enhanced prediction
                networkManager.sendInput('playerMove', { direction: 'forward' });
                moved = true;
            } else if (keys.s) {
                // Phase 10: Use network manager for enhanced prediction
                networkManager.sendInput('playerMove', { direction: 'backward' });
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

// Phase 10: Animation system helper functions
function addEntityEvent(entityId, event) {
    if (!entityEvents.has(entityId)) {
        entityEvents.set(entityId, []);
    }
    entityEvents.get(entityId).push(event);
}

function getEntityEvents(entityId) {
    return entityEvents.get(entityId) || [];
}

function clearEntityEvents() {
    entityEvents.clear();
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
    const logicalCanvasWidth = canvas.width / dpr;
    const logicalCanvasHeight = canvas.height / dpr;
    
    // Position from bottom-right
    const logicalRight = CONFIG.ui.killstreak_display.position.right;
    const logicalBottom = CONFIG.ui.killstreak_display.position.bottom;
    const width = CONFIG.ui.killstreak_display.width;
    const height = CONFIG.ui.killstreak_display.height;
    
    const x = logicalCanvasWidth - logicalRight - width;
    const y = logicalCanvasHeight - logicalBottom - height;
    
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
        
        // Use player's tank color for their name
        const playerColor = `rgb(${player.rgb.r}, ${player.rgb.g}, ${player.rgb.b})`;
        ctx.fillStyle = playerColor;
        ctx.shadowColor = playerColor;
        
        // Special styling for top player with additive pulse
        if (isTopPlayer) {
            const pulseIntensity = Math.sin(Date.now() * CONFIG.ui.leaderboard.pulse_speed) * 0.3 + 1;
            ctx.shadowBlur = CONFIG.ui.leaderboard.top_player_glow_intensity * pulseIntensity;
        } else {
            // Regular players with reduced alpha
            ctx.globalAlpha = CONFIG.ui.leaderboard.regular_player_alpha;
            ctx.shadowBlur = 0;
        }
        
        // Highlight current player with extra glow
        if (player.id === myPlayerId) {
            ctx.shadowBlur = 8;
            ctx.globalAlpha = 1; // Full opacity for current player
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
    
    // Use logical dimensions (accounting for DPR)
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;
    
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);
    ctx.globalAlpha = 1;
    
    const centerX = logicalWidth / 2;
    const centerY = logicalHeight / 2;
    
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

// Main game loop - Phase 10: Complete rewrite with animation system
function gameLoop() {
    // Phase 10: Update delta time for frame-rate independence
    const dt = deltaTime.update();
    
    // Check if login overlay is visible
    if (loginOverlay && loginOverlay.isVisible) {
        // Clear canvas for login overlay
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw background pattern
        ctx.fillStyle = backgroundPattern;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Update and render login overlay
        loginOverlay.update();
        loginOverlay.render();
    } else {
        // Phase 10: Handle continuous input
        handleSpeedMode();
        
        // Phase 10: Get interpolated game state for smooth rendering
        const renderState = interpolationBuffer.getInterpolatedState() || gameState;
        
        // Phase 10: Update camera with interpolated state
        camera.update(renderState, myPlayerId);
        
        // Phase 10: Apply frame-rate independent camera shake decay
        if (camera.shake > CONFIG.camera.shake_threshold) {
            camera.shake = deltaTime.frameRateIndependentDecay(camera.shake, CONFIG.camera.shake_decay);
        }
        
        // Phase 10: Provide entity events to animation manager
        animationManager.getEntityEvents = getEntityEvents;
        
        // Phase 10: Single render call - centralized animation system
        animationManager.render(renderState, camera, myPlayerId);
        
        // Phase 10: Clear entity events after rendering
        clearEntityEvents();
    }
    
    // Phase 10: Draw death screen (on top of everything)
    if (playerDeathState.isDead) {
        drawDeathScreen();
    }
    
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