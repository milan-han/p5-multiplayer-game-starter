// =================================================================================
// MAIN GAME ENTRY POINT - Blueprint Battle (ES6 Modules)
// =================================================================================

import { config } from './core/Config.js';
import { DeltaTime } from './core/DeltaTime.js';
import { dpr } from './core/DPR.js';
import { InterpolationBuffer } from './network/InterpolationBuffer.js';

// Game state and systems
let gameConfig = null;
let deltaTime = null;
let interpolationBuffer = null;
let canvas = null;
let ctx = null;
let socket = null;

// Game state
let gameState = null;
let myPlayerId = null;
let isGameRunning = false;

/**
 * Initialize the game systems
 */
async function initializeGame() {
    try {
        console.log('🚀 Initializing Blueprint Battle (ES6 Modules)...');
        
        // Load configuration first
        gameConfig = await config.load();
        console.log('✓ Configuration loaded');
        
        // Setup canvas and DPR
        canvas = document.getElementById('gameCanvas');
        ctx = canvas.getContext('2d');
        dpr.setupCanvas(canvas, ctx);
        console.log('✓ Canvas initialized');
        
        // Initialize timing system
        deltaTime = new DeltaTime(gameConfig);
        console.log('✓ Delta time system initialized');
        
        // Initialize interpolation buffer
        interpolationBuffer = new InterpolationBuffer(deltaTime, gameConfig);
        console.log('✓ Interpolation buffer initialized');
        
        // Setup networking
        await setupNetworking();
        console.log('✓ Networking initialized');
        
        // Setup event listeners
        setupEventListeners();
        console.log('✓ Event listeners setup');
        
        // Start render loop
        startRenderLoop();
        console.log('✓ Render loop started');
        
        console.log('🎮 Game initialization complete!');
        
    } catch (error) {
        console.error('❌ Failed to initialize game:', error);
        throw error;
    }
}

/**
 * Setup Socket.IO networking
 */
function setupNetworking() {
    return new Promise((resolve, reject) => {
        try {
            socket = io();
            
            socket.on('connect', () => {
                console.log('📡 Connected to server');
                myPlayerId = socket.id;
                isGameRunning = true;
                resolve();
            });
            
            socket.on('disconnect', () => {
                console.log('📡 Disconnected from server');
                isGameRunning = false;
            });
            
            socket.on('gameState', (newGameState) => {
                // Add to interpolation buffer for smooth rendering
                interpolationBuffer.addSnapshot(newGameState);
                gameState = newGameState;
            });
            
            socket.on('error', (error) => {
                console.error('Socket error:', error);
                reject(error);
            });
            
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Canvas resize
    window.addEventListener('resize', handleResize);
    
    // Input handling (simplified for module demo)
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    handleResize(); // Initial resize
}

/**
 * Handle window resize
 */
function handleResize() {
    dpr.setupCanvas(canvas, ctx);
}

/**
 * Handle key down events
 */
function handleKeyDown(event) {
    if (!isGameRunning || !socket) return;
    
    // Simplified input handling for demo
    switch(event.code) {
        case 'KeyW':
        case 'ArrowUp':
            socket.emit('playerMove', { direction: 'forward' });
            break;
        case 'KeyS':
        case 'ArrowDown':
            socket.emit('playerMove', { direction: 'backward' });
            break;
        case 'KeyA':
        case 'ArrowLeft':
            socket.emit('playerRotate', { direction: 'left' });
            break;
        case 'KeyD':
        case 'ArrowRight':
            socket.emit('playerRotate', { direction: 'right' });
            break;
        case 'Space':
            event.preventDefault();
            socket.emit('playerShoot');
            break;
    }
}

/**
 * Handle key up events
 */
function handleKeyUp(event) {
    // Handle key releases if needed
}

/**
 * Start the main render loop
 */
function startRenderLoop() {
    function renderFrame() {
        if (!isGameRunning) {
            requestAnimationFrame(renderFrame);
            return;
        }
        
        // Update timing
        deltaTime.update();
        
        // Clear canvas
        const bounds = dpr.logicalBounds();
        ctx.clearRect(0, 0, bounds.width, bounds.height);
        
        // Get interpolated game state
        const interpolatedState = interpolationBuffer.getInterpolatedState();
        
        if (interpolatedState) {
            // Render game (simplified for demo)
            renderGame(interpolatedState);
        }
        
        // Performance info (for debugging)
        renderPerformanceInfo();
        
        requestAnimationFrame(renderFrame);
    }
    
    requestAnimationFrame(renderFrame);
}

/**
 * Render the game state
 */
function renderGame(state) {
    if (!state) return;
    
    const bounds = dpr.logicalBounds();
    
    // Simple rendering demonstration
    ctx.fillStyle = gameConfig.colors.primary;
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Blueprint Battle (ES6 Modules)', bounds.centerX, 50);
    
    // Render tanks (simplified)
    if (state.tanks) {
        state.tanks.forEach(tank => {
            if (tank.alive) {
                ctx.fillStyle = tank.rgb || gameConfig.colors.accent_cyan;
                ctx.fillRect(tank.x - 10, tank.y - 10, 20, 20);
                
                // Tank name
                ctx.fillStyle = gameConfig.colors.primary;
                ctx.font = '12px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(tank.name || tank.id, tank.x, tank.y - 15);
            }
        });
    }
    
    // Render bullets (simplified)
    if (state.bullets) {
        state.bullets.forEach(bullet => {
            ctx.fillStyle = gameConfig.colors.accent_cyan;
            ctx.beginPath();
            ctx.arc(bullet.x, bullet.y, bullet.radius || 5, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

/**
 * Render performance information
 */
function renderPerformanceInfo() {
    if (!deltaTime) return;
    
    const perfInfo = deltaTime.getPerformanceInfo();
    const bounds = dpr.logicalBounds();
    
    ctx.fillStyle = gameConfig.colors.ui_text_dim;
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    
    let y = 20;
    ctx.fillText(`FPS: ${perfInfo.fps}`, 10, y);
    y += 15;
    ctx.fillText(`Delta: ${(perfInfo.deltaTime * 1000).toFixed(1)}ms`, 10, y);
    y += 15;
    
    if (interpolationBuffer) {
        const bufferStats = interpolationBuffer.getBufferStats();
        ctx.fillText(`Buffer: ${bufferStats.size}/${gameConfig.ui.anim.interpolation_buffer_size}`, 10, y);
    }
}

/**
 * Module exports for development/debugging
 */
window.BlueprintBattle = {
    config: gameConfig,
    deltaTime,
    interpolationBuffer,
    dpr,
    
    // Debug functions
    getPerformanceInfo: () => deltaTime ? deltaTime.getPerformanceInfo() : null,
    getBufferStats: () => interpolationBuffer ? interpolationBuffer.getBufferStats() : null
};

// Initialize the game when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGame);
} else {
    initializeGame();
}