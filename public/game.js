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
let uiManager;

// Phase 10: Animation System Components
let deltaTime;
let interpolationBuffer;
let networkManager;
let animationManager;
let entityEvents = new Map(); // Store events for animation state machines

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

// =================================================================================
// DPI UTILITY FUNCTIONS - Centralized DPI handling for consistency
// =================================================================================

const DPR = {
    // Get current device pixel ratio
    get: () => window.devicePixelRatio || 1,
    
    // Convert CSS pixels to canvas buffer pixels
    cssToCanvas: (cssPixels) => cssPixels * DPR.get(),
    
    // Convert canvas buffer pixels to CSS pixels
    canvasToCSS: (canvasPixels) => canvasPixels / DPR.get(),
    
    // Get logical canvas dimensions (CSS pixels)
    logicalWidth: () => canvas ? canvas.width / DPR.get() : 0,
    logicalHeight: () => canvas ? canvas.height / DPR.get() : 0,
    
    // Get logical canvas center (CSS pixels)
    logicalCenter: () => ({
        x: DPR.logicalWidth() / 2,
        y: DPR.logicalHeight() / 2
    }),
    
    // Get logical canvas bounds (CSS pixels)
    logicalBounds: () => ({
        width: DPR.logicalWidth(),
        height: DPR.logicalHeight(),
        centerX: DPR.logicalWidth() / 2,
        centerY: DPR.logicalHeight() / 2
    })
};

// Background pattern creation
function createBackgroundPattern() {
    const patternCanvas = document.createElement('canvas');
    const patternCtx = patternCanvas.getContext('2d');
    const size = CONFIG.background_pattern.cell_size;
    const dotRadius = CONFIG.background_pattern.dot_radius;
    
    console.log('game.js: Creating background pattern with cell_size:', size, 'dot_radius:', dotRadius);
    
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
        // @ts-ignore: DeltaTime class is loaded via script tag in index.html
        deltaTime = new DeltaTime();
        interpolationBuffer = new InterpolationBuffer(deltaTime);
        
        // Initialize game objects
        camera = new Camera(deltaTime);
        clientArena = new ClientArena();
        backgroundPattern = createBackgroundPattern();
        
        // Create socket connection (but don't join game yet)
        socket = io(`http://localhost:${CONFIG.server.port}`);
        setupSocketEvents();
        
        // Initialize network manager with enhanced prediction
        networkManager = new NetworkManager(socket, deltaTime);
        
        // Initialize animation manager for centralized rendering
        animationManager = new AnimationManager(canvas, ctx, deltaTime);
        
        // Create centralized UI manager
        uiManager = new UIManager(canvas, ctx, CONFIG, socket);
        
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
    const dpr = DPR.get();
    // Set canvas CSS size
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    // Set actual pixel buffer to match DPR
    canvas.width = Math.floor(DPR.cssToCanvas(window.innerWidth));
    canvas.height = Math.floor(DPR.cssToCanvas(window.innerHeight));
    // Reset any prior transforms then apply DPR scaling so 1 unit == 1 CSS pixel
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    backgroundPattern = createBackgroundPattern();
    
    // Phase 10: Update animation manager on resize
    if (animationManager) {
        animationManager.onResize();
    }
    
    // Update UI manager on resize
    if (uiManager) {
        uiManager.onResize();
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
            // Player successfully joined, transition to game UI
            uiManager.showGame();
        }
    });
    
    socket.on('gameState', (state) => {
        gameState = state;
        
        // Phase 10: Add state to interpolation buffer
        interpolationBuffer.addSnapshot(state);
    });
    
    socket.on('playerKilled', (data) => {
        if (data.victim === myPlayerId) {
            // Handle death effects
            camera.addShake(CONFIG.visual.combat_effects.death_shake_magnitude);
            
            // Show death screen with UI manager including death statistics
            uiManager.showDeath({
                deathTime: Date.now(),
                respawnTime: Date.now() + CONFIG.combat.respawn_delay_ms,
                stats: data.victimStats || { killStreak: 0, timeAlive: 0 }
            });
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
            
            // Hide death screen and show game UI
            uiManager.showGame();
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
    
    socket.on('revengeKill', (data) => {
        if (data.avenger === myPlayerId) {
            // Show revenge notification popup
            uiManager.showRevengeNotification();
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
                // Send movement input regardless of speed mode - let server handle timing
                networkManager.sendInput('playerMove', { 
                    direction: 'forward',
                    speedMode: keys.shift // Include current speed mode state
                });
                break;
            case 's':
                // Send movement input regardless of speed mode - let server handle timing
                networkManager.sendInput('playerMove', { 
                    direction: 'backward',
                    speedMode: keys.shift // Include current speed mode state
                });
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
                // Enhanced speed mode toggle with immediate state update
                keys.shift = true; // Update local state immediately
                networkManager.sendInput('speedModeToggle', { 
                    enabled: true, 
                    immediate: true // Flag for immediate activation
                });
                // Reset speed mode timing to prevent initial delay
                lastSpeedModeMove = 0;
                break;
        }
    });

    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (key in keys) {
            keys[key] = false;
        }

        if (key === 'shift') {
            // Enhanced speed mode toggle with immediate state update
            keys.shift = false; // Update local state immediately
            networkManager.sendInput('speedModeToggle', { 
                enabled: false, 
                immediate: true // Flag for immediate deactivation
            });
            // Reset speed mode input buffer
            speedModeInputBuffer = { w: false, s: false };
        }
    });
    
    window.addEventListener('resize', resizeCanvas);
}

// Enhanced speed mode handling - continuous movement while keys are held
let lastSpeedModeMove = 0;
let speedModeInputBuffer = { w: false, s: false };

function handleSpeedMode() {
    if (!keys.shift) {
        // Reset buffer when not in speed mode
        speedModeInputBuffer = { w: false, s: false };
        return;
    }
    
    const now = Date.now();
    const speedModeDelay = CONFIG.player.move_cooldown_speed_mode * CONFIG.ui.frame_to_ms; // Convert frames to ms
    
    if (now - lastSpeedModeMove >= speedModeDelay) {
        let moveDirection = null;
        
        // Prioritize forward movement, then backward
        if (keys.w && !speedModeInputBuffer.w) {
            moveDirection = 'forward';
            speedModeInputBuffer.w = true;
        } else if (keys.s && !speedModeInputBuffer.s) {
            moveDirection = 'backward';
            speedModeInputBuffer.s = true;
        } else if (keys.w) {
            moveDirection = 'forward';
        } else if (keys.s) {
            moveDirection = 'backward';
        }
        
        if (moveDirection) {
            networkManager.sendInput('playerMove', { 
                direction: moveDirection,
                speedMode: true,
                continuous: true // Flag for continuous movement
            });
            lastSpeedModeMove = now;
        }
    }
    
    // Reset buffer flags when keys are released
    if (!keys.w) speedModeInputBuffer.w = false;
    if (!keys.s) speedModeInputBuffer.s = false;
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

// Legacy UI functions removed - now handled by UIManager

// Main game loop - Phase 10: Complete rewrite with animation system
function gameLoop() {
    // Phase 10: Update delta time for frame-rate independence
    deltaTime.update();
    
    // Check if UI manager is handling login/UI state
    if (uiManager && uiManager.isLoginVisible()) {
        // Clear canvas for login overlay
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw background pattern
        ctx.fillStyle = backgroundPattern;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // UIManager handles all UI rendering
        uiManager.render(gameState, myPlayerId);
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
        
        // UIManager handles all UI rendering (leaderboard, kill streak, death screen)
        uiManager.render(renderState, myPlayerId);
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
    console.log('CONFIG loaded: background_pattern.cell_size =', CONFIG.background_pattern.cell_size);
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