// =================================================================================
// BLUEPRINT BATTLE - MULTIPLAYER CLIENT
// =================================================================================

// "Living Blueprint" color palette
const PALETTE = {
    base: '#000000',
    primaryStroke: '#9EE7FF',
    dimStroke: '#3A5F7F',
    glowAccent: '#00FFF7',
    errorAccent: '#FF5C5C'
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
        
        // Set canvas size
        resizeCanvas();
        
        // Initialize game objects
        camera = new Camera();
        clientArena = new ClientArena();
        backgroundPattern = createBackgroundPattern();
        
        // Connect to server
        socket = io();
        setupSocketEvents();
        
        // Setup input handling
        setupInputHandlers();
        
        // Start game loop
        gameLoop();
        
        console.log('Blueprint Battle initialized successfully');
    } catch (error) {
        console.error('Failed to initialize game:', error);
        // Try to display an error message to the user
        document.body.innerHTML = '<div style="color: #FF5C5C; font-family: Inter; padding: 20px; text-align: center;">Failed to initialize Blueprint Battle. Please refresh the page.</div>';
    }
}

// Canvas resizing
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
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
    
    socket.on('gameState', (state) => {
        gameState = state;
        updateUI();
    });
    
    socket.on('playerKilled', (data) => {
        if (data.victim === myPlayerId) {
            // Handle death effects
            camera.addShake(CONFIG.camera.shake_magnitude * 2);
        }
    });
    
    socket.on('playerRespawned', (data) => {
        if (data.playerId === myPlayerId) {
            // Handle respawn effects
            camera.addShake(CONFIG.camera.shake_magnitude);
        }
    });
    
    socket.on('killStreakUpdate', (data) => {
        if (data.playerId === myPlayerId) {
            // Handle kill streak update
            camera.addShake(CONFIG.camera.shake_magnitude);
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
        const speedModeDelay = CONFIG.player.move_cooldown_speed_mode * 16; // Convert frames to ms
        
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

// Main game loop
function gameLoop() {
    // Handle continuous input
    handleSpeedMode();
    
    // Update camera
    camera.update(gameState, myPlayerId);
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background pattern
    ctx.fillStyle = backgroundPattern;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Apply camera transformation
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    
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
    ctx.translate(-camera.x, -camera.y);
    
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
    
    ctx.restore();
    
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
        document.body.innerHTML = '<div style="color: #FF5C5C; font-family: Inter; padding: 20px; text-align: center;">Failed to load Blueprint Battle configuration. Please refresh the page.</div>';
    }
});