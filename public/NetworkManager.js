// =================================================================================
// NETWORK MANAGER - Blueprint Battle
// =================================================================================

class NetworkManager {
    constructor(socket, deltaTime) {
        this.socket = socket;
        this.deltaTime = deltaTime;
        this.myPlayerId = null;
        
        // Input sequence tracking
        this.inputSequence = 0;
        this.lastAckedInputSequence = 0;
        this.pendingInputs = []; // Queue of unacknowledged inputs
        
        // Input prediction and reconciliation
        this.predictedState = null;
        this.lastServerState = null;
        this.reconciliationThreshold = {
            position: CONFIG.arena.tile_size * 0.1, // 10% of tile size
            heading: 5 // 5 degrees
        };
        
        // Network statistics
        this.networkStats = {
            ping: 0,
            packetLoss: 0,
            jitter: 0,
            lastPingTime: 0,
            pingHistory: []
        };
        
        // Input buffering
        this.inputBuffer = [];
        this.inputBufferSize = 10;
        this.lastInputTime = 0;
        
        // Server acknowledgment tracking
        this.serverAckCallbacks = new Map();
        
        this.setupEventHandlers();
    }
    
    // Setup socket event handlers
    setupEventHandlers() {
        this.socket.on('connect', () => {
            this.myPlayerId = this.socket.id;
            console.log('Network Manager connected:', this.myPlayerId);
        });
        
        this.socket.on('disconnect', () => {
            console.log('Network Manager disconnected');
            this.reset();
        });
        
        // Handle server state updates with acknowledgment
        this.socket.on('gameState', (state) => {
            this.handleServerState(state);
        });
        
        // Handle input acknowledgment
        this.socket.on('inputAck', (data) => {
            this.handleInputAck(data);
        });
        
        // Handle ping responses
        this.socket.on('pingResponse', (data) => {
            this.handlePingResponse(data);
        });
    }
    
    // Send input with sequence number and prediction
    sendInput(inputType, inputData) {
        const input = {
            type: inputType,
            data: inputData,
            sequence: ++this.inputSequence,
            timestamp: this.deltaTime.getNetworkTime(),
            clientTime: this.deltaTime.getRenderTime()
        };
        
        // Add to pending inputs queue
        this.pendingInputs.push(input);
        
        // Apply input prediction immediately
        this.applyInputPrediction(input);
        
        // Send to server
        this.socket.emit(inputType, {
            ...inputData,
            sequence: input.sequence,
            timestamp: input.timestamp
        });
        
        // Track in input buffer
        this.addToInputBuffer(input);
        
        // Clean up old pending inputs
        this.cleanupOldInputs();
    }
    
    // Handle server state update
    handleServerState(serverState) {
        this.lastServerState = serverState;
        
        // Check for input acknowledgment in server state
        if (serverState.inputSequences && this.myPlayerId) {
            const mySequence = serverState.inputSequences[this.myPlayerId];
            if (mySequence !== undefined) {
                this.handleInputAck({
                    playerId: this.myPlayerId,
                    sequence: mySequence,
                    timestamp: serverState.timestamp
                });
            }
        }
        
        // Perform reconciliation if this is my player
        if (this.myPlayerId && serverState.tanks) {
            const myTank = serverState.tanks.find(tank => tank.id === this.myPlayerId);
            if (myTank) {
                this.performReconciliation(myTank);
            }
        }
        
        // Update network statistics
        this.updateNetworkStats(serverState);
    }
    
    // Handle input acknowledgment from server
    handleInputAck(ackData) {
        if (ackData.playerId !== this.myPlayerId) return;
        
        this.lastAckedInputSequence = ackData.sequence;
        
        // Remove acknowledged inputs from pending queue
        this.pendingInputs = this.pendingInputs.filter(input => 
            input.sequence > ackData.sequence
        );
        
        // Execute any callbacks waiting for this acknowledgment
        if (this.serverAckCallbacks.has(ackData.sequence)) {
            this.serverAckCallbacks.get(ackData.sequence)(ackData);
            this.serverAckCallbacks.delete(ackData.sequence);
        }
        
        // Update network statistics
        this.updatePingFromAck(ackData);
    }
    
    // Perform client-side reconciliation
    performReconciliation(serverTank) {
        if (!this.predictedState) {
            // Initialize predicted state with server state
            const tileSize = CONFIG.arena.tile_size;
            const tilesPerSide = Math.floor(CONFIG.arena.world_size / tileSize);
            
            // Calculate grid coordinates if not provided
            let gridX = serverTank.gridX;
            let gridY = serverTank.gridY;
            
            if (gridX === undefined || gridY === undefined) {
                // Match server's world-to-grid conversion
                gridX = Math.floor(serverTank.x / tileSize) - tilesPerSide / 2;
                gridY = Math.floor(serverTank.y / tileSize) - tilesPerSide / 2;
            }
            
            this.predictedState = { 
                ...serverTank,
                gridX: gridX,
                gridY: gridY,
                targetHeading: serverTank.targetHeading !== undefined ? serverTank.targetHeading : serverTank.heading
            };
            return;
        }
        
        // Check prediction error with proper angle difference calculation
        const positionError = Math.abs(this.predictedState.x - serverTank.x) + 
                             Math.abs(this.predictedState.y - serverTank.y);
        
        // Calculate shortest angle difference for heading error
        let headingDiff = Math.abs(this.predictedState.heading - serverTank.heading);
        if (headingDiff > 180) headingDiff = 360 - headingDiff;
        const headingError = headingDiff;
        
        // Also check targetHeading error if available
        let targetHeadingError = 0;
        if (serverTank.targetHeading !== undefined && this.predictedState.targetHeading !== undefined) {
            let targetDiff = Math.abs(this.predictedState.targetHeading - serverTank.targetHeading);
            if (targetDiff > 180) targetDiff = 360 - targetDiff;
            targetHeadingError = targetDiff;
        }
        
        // If prediction error is too large, perform reconciliation
        if (positionError > this.reconciliationThreshold.position || 
            headingError > this.reconciliationThreshold.heading) {
            
            // Only log significant errors to avoid console spam
            if (positionError > this.reconciliationThreshold.position * 10 || 
                headingError > this.reconciliationThreshold.heading * 10) {
                console.log('Major reconciliation - Position error:', positionError, 'Heading error:', headingError, 'Target heading error:', targetHeadingError);
                console.log('Predicted:', { heading: this.predictedState.heading, targetHeading: this.predictedState.targetHeading });
                console.log('Server:', { heading: serverTank.heading, targetHeading: serverTank.targetHeading });
            }
            
            // Rewind to server state with proper grid coordinates
            const tileSize = CONFIG.arena.tile_size;
            const tilesPerSide = Math.floor(CONFIG.arena.world_size / tileSize);
            
            let gridX = serverTank.gridX;
            let gridY = serverTank.gridY;
            
            if (gridX === undefined || gridY === undefined) {
                gridX = Math.floor(serverTank.x / tileSize) - tilesPerSide / 2;
                gridY = Math.floor(serverTank.y / tileSize) - tilesPerSide / 2;
            }
            
            this.predictedState = { 
                ...serverTank,
                gridX: gridX,
                gridY: gridY,
                targetHeading: serverTank.targetHeading !== undefined ? serverTank.targetHeading : serverTank.heading
            };
            
            // Re-apply unacknowledged inputs
            this.reapplyUnacknowledgedInputs();
        } else {
            // Small error, gradually correct
            this.smoothCorrection(serverTank);
        }
    }
    
    // Re-apply unacknowledged inputs after reconciliation
    reapplyUnacknowledgedInputs() {
        const sortedInputs = this.pendingInputs.sort((a, b) => a.sequence - b.sequence);
        
        for (const input of sortedInputs) {
            this.applyInputPrediction(input);
        }
    }
    
    // Apply input prediction to predicted state
    applyInputPrediction(input) {
        if (!this.predictedState) return;
        
        switch (input.type) {
            case 'playerMove':
                this.predictMovement(input.data);
                break;
            case 'playerRotate':
                this.predictRotation(input.data);
                return; // Rotation already applies heading interpolation
            case 'playerShoot':
                this.predictShoot();
                break;
            case 'playerPickupAmmo':
                this.predictAmmoPickup();
                break;
            case 'speedModeToggle':
                this.predictSpeedMode(input.data);
                break;
        }
        
        // Apply heading interpolation for all input types except rotation (which handles it internally)
        this.applyHeadingInterpolation();
    }
    
    // Predict movement - Match server logic exactly
    predictMovement(data) {
        if (!this.predictedState) return;
        
        const tileSize = CONFIG.arena.tile_size;
        
        // Match server logic exactly: convert heading to radians, round direction components
        const headingRad = (this.predictedState.heading * Math.PI) / 180;
        const dx = Math.round(Math.cos(headingRad));
        const dy = Math.round(Math.sin(headingRad));
        
        // Calculate current grid position from world coordinates
        let currentGridX = this.predictedState.gridX;
        let currentGridY = this.predictedState.gridY;
        
        // If grid coordinates are missing, calculate from world position
        if (currentGridX === undefined || currentGridY === undefined) {
            // Match server's grid calculation: world to grid conversion
            currentGridX = Math.floor(this.predictedState.x / tileSize) - Math.floor(CONFIG.arena.world_size / tileSize) / 2;
            currentGridY = Math.floor(this.predictedState.y / tileSize) - Math.floor(CONFIG.arena.world_size / tileSize) / 2;
        }
        
        // Calculate new grid position
        let newGridX = currentGridX;
        let newGridY = currentGridY;
        
        switch (data.direction) {
            case 'forward':
            case 'up':
                newGridX += dx;
                newGridY += dy;
                break;
            case 'backward':
            case 'down':
                newGridX -= dx;
                newGridY -= dy;
                break;
        }
        
        // Convert back to world coordinates (match server's grid-to-world conversion)
        const tilesPerSide = Math.floor(CONFIG.arena.world_size / tileSize);
        const worldX = (newGridX + tilesPerSide / 2) * tileSize + tileSize / 2;
        const worldY = (newGridY + tilesPerSide / 2) * tileSize + tileSize / 2;
        
        this.predictedState.x = worldX;
        this.predictedState.y = worldY;
        this.predictedState.gridX = newGridX;
        this.predictedState.gridY = newGridY;
    }
    
    // Predict rotation - Match server logic exactly with interpolation
    predictRotation(data) {
        if (!this.predictedState) return;
        
        const rotationStep = CONFIG.player.rotation_step_deg;
        
        // Initialize targetHeading if not present
        if (this.predictedState.targetHeading === undefined) {
            this.predictedState.targetHeading = this.predictedState.heading;
        }
        
        // Match server logic exactly - modify targetHeading
        if (data.direction === 'left') {
            this.predictedState.targetHeading = (this.predictedState.targetHeading - rotationStep + 360) % 360;
        } else if (data.direction === 'right') {
            this.predictedState.targetHeading = (this.predictedState.targetHeading + rotationStep) % 360;
        }
        
        // Apply heading interpolation like the server
        this.applyHeadingInterpolation();
    }
    
    // Predict shooting
    predictShoot() {
        if (!this.predictedState || this.predictedState.ammo <= 0) return;
        
        this.predictedState.ammo = Math.max(0, this.predictedState.ammo - 1);
    }
    
    // Predict ammo pickup
    predictAmmoPickup() {
        if (!this.predictedState) return;
        
        // Optimistic prediction - assume pickup succeeds
        this.predictedState.ammo = Math.min(this.predictedState.ammo + 1, CONFIG.player.max_ammo);
    }
    
    // Predict speed mode toggle
    predictSpeedMode(data) {
        if (!this.predictedState) return;
        
        this.predictedState.speedMode = data.enabled;
        this.predictedState.shield = !data.enabled;
    }
    
    // Apply heading interpolation like the server
    applyHeadingInterpolation() {
        if (!this.predictedState) return;
        
        // Initialize targetHeading if not present
        if (this.predictedState.targetHeading === undefined) {
            this.predictedState.targetHeading = this.predictedState.heading;
        }
        
        // Match server's heading interpolation logic exactly
        const headingInterp = CONFIG.player.heading_interp;
        let headingDiff = this.predictedState.targetHeading - this.predictedState.heading;
        
        // Handle wrap-around (match server logic)
        if (headingDiff > 180) headingDiff -= 360;
        if (headingDiff < -180) headingDiff += 360;
        
        this.predictedState.heading += headingDiff * headingInterp;
        
        // Normalize heading (match server logic)
        this.predictedState.heading = (this.predictedState.heading + 360) % 360;
    }
    
    // Smooth correction for small prediction errors
    smoothCorrection(serverTank) {
        const correctionRate = 0.1; // Adjust based on preference
        
        this.predictedState.x = this.deltaTime.frameRateIndependentLerp(
            this.predictedState.x, serverTank.x, correctionRate
        );
        this.predictedState.y = this.deltaTime.frameRateIndependentLerp(
            this.predictedState.y, serverTank.y, correctionRate
        );
        
        // Smoothly correct both heading and targetHeading
        this.predictedState.heading = this.lerpAngle(
            this.predictedState.heading, serverTank.heading, correctionRate
        );
        
        // Update targetHeading if provided by server
        if (serverTank.targetHeading !== undefined) {
            this.predictedState.targetHeading = this.lerpAngle(
                this.predictedState.targetHeading, serverTank.targetHeading, correctionRate
            );
        } else {
            this.predictedState.targetHeading = this.predictedState.heading;
        }
        
        // Update grid coordinates with proper conversion
        const tileSize = CONFIG.arena.tile_size;
        const tilesPerSide = Math.floor(CONFIG.arena.world_size / tileSize);
        
        if (serverTank.gridX !== undefined && serverTank.gridY !== undefined) {
            this.predictedState.gridX = serverTank.gridX;
            this.predictedState.gridY = serverTank.gridY;
        } else {
            // Calculate grid coordinates from world position
            this.predictedState.gridX = Math.floor(this.predictedState.x / tileSize) - tilesPerSide / 2;
            this.predictedState.gridY = Math.floor(this.predictedState.y / tileSize) - tilesPerSide / 2;
        }
    }
    
    // Add input to buffer for analysis
    addToInputBuffer(input) {
        this.inputBuffer.push(input);
        
        if (this.inputBuffer.length > this.inputBufferSize) {
            this.inputBuffer.shift();
        }
    }
    
    // Clean up old pending inputs
    cleanupOldInputs() {
        const maxAge = 5000; // 5 seconds
        const currentTime = this.deltaTime.getNetworkTime();
        
        this.pendingInputs = this.pendingInputs.filter(input => 
            (currentTime - input.timestamp) < maxAge
        );
    }
    
    // Update network statistics
    updateNetworkStats(serverState) {
        if (serverState.timestamp) {
            const networkTime = this.deltaTime.getNetworkTime();
            const serverTime = serverState.timestamp;
            
            // Simple ping estimation (not accurate but gives an idea)
            const estimatedPing = networkTime - serverTime;
            this.networkStats.ping = estimatedPing;
            
            // Add to ping history
            this.networkStats.pingHistory.push(estimatedPing);
            if (this.networkStats.pingHistory.length > 10) {
                this.networkStats.pingHistory.shift();
            }
            
            // Calculate jitter
            if (this.networkStats.pingHistory.length > 1) {
                const avgPing = this.networkStats.pingHistory.reduce((a, b) => a + b, 0) / this.networkStats.pingHistory.length;
                const jitter = this.networkStats.pingHistory.reduce((acc, ping) => acc + Math.abs(ping - avgPing), 0) / this.networkStats.pingHistory.length;
                this.networkStats.jitter = jitter;
            }
        }
    }
    
    // Update ping from acknowledgment
    updatePingFromAck(ackData) {
        if (ackData.timestamp) {
            const roundTripTime = this.deltaTime.getNetworkTime() - ackData.timestamp;
            this.networkStats.ping = roundTripTime;
        }
    }
    
    // Send ping to server
    sendPing() {
        const pingData = {
            timestamp: this.deltaTime.getNetworkTime(),
            sequence: ++this.inputSequence
        };
        
        this.socket.emit('ping', pingData);
        this.networkStats.lastPingTime = pingData.timestamp;
    }
    
    // Handle ping response
    handlePingResponse(data) {
        if (data.timestamp === this.networkStats.lastPingTime) {
            this.networkStats.ping = this.deltaTime.getNetworkTime() - data.timestamp;
        }
    }
    
    // Get predicted state for rendering
    getPredictedState() {
        return this.predictedState;
    }
    
    // Get network statistics
    getNetworkStats() {
        return { ...this.networkStats };
    }
    
    // Check if input is acknowledged
    isInputAcknowledged(sequence) {
        return sequence <= this.lastAckedInputSequence;
    }
    
    // Get number of pending inputs
    getPendingInputCount() {
        return this.pendingInputs.length;
    }
    
    // Register callback for input acknowledgment
    onInputAck(sequence, callback) {
        this.serverAckCallbacks.set(sequence, callback);
    }
    
    // Angle lerp utility - Fixed for proper angle wrapping
    lerpAngle(a, b, t) {
        // Normalize angles to 0-360 range
        a = ((a % 360) + 360) % 360;
        b = ((b % 360) + 360) % 360;
        
        // Find shortest path
        let diff = b - a;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        
        const result = a + diff * t;
        
        // Ensure result is in 0-360 range
        return ((result % 360) + 360) % 360;
    }
    
    // Reset network manager
    reset() {
        this.inputSequence = 0;
        this.lastAckedInputSequence = 0;
        this.pendingInputs = [];
        this.predictedState = null;
        this.lastServerState = null;
        this.inputBuffer = [];
        this.serverAckCallbacks.clear();
        
        this.networkStats = {
            ping: 0,
            packetLoss: 0,
            jitter: 0,
            lastPingTime: 0,
            pingHistory: []
        };
    }
    
    // Check network health
    getNetworkHealth() {
        const maxPing = 200; // 200ms
        const maxPendingInputs = 10;
        
        let health = 1.0;
        
        // Reduce health based on ping
        if (this.networkStats.ping > maxPing) {
            health *= 0.5;
        } else if (this.networkStats.ping > maxPing * 0.5) {
            health *= 0.8;
        }
        
        // Reduce health based on pending inputs
        if (this.pendingInputs.length > maxPendingInputs) {
            health *= 0.3;
        } else if (this.pendingInputs.length > maxPendingInputs * 0.5) {
            health *= 0.7;
        }
        
        return Math.max(0, health);
    }
    
    // Get debug information
    getDebugInfo() {
        return {
            playerId: this.myPlayerId,
            inputSequence: this.inputSequence,
            lastAckedInputSequence: this.lastAckedInputSequence,
            pendingInputs: this.pendingInputs.length,
            networkStats: this.networkStats,
            networkHealth: this.getNetworkHealth(),
            hasPredictedState: !!this.predictedState
        };
    }
}