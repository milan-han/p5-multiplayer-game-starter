// =================================================================================
// INTERPOLATION BUFFER - Blueprint Battle
// =================================================================================

class InterpolationBuffer {
    constructor(deltaTime) {
        this.deltaTime = deltaTime;
        this.bufferSize = CONFIG.ui.anim.interpolation_buffer_size;
        this.interpolationDelayMs = CONFIG.ui.anim.interpolation_delay_ms;
        
        // Ring buffer for state snapshots
        this.buffer = [];
        this.bufferIndex = 0;
        
        // Current interpolated state
        this.currentState = null;
        this.lastUpdateTime = 0;
    }
    
    // Add a new state snapshot to the buffer
    addSnapshot(gameState) {
        const snapshot = {
            state: this.deepCopy(gameState),
            timestamp: this.deltaTime.getNetworkTime(),
            serverTime: gameState.timestamp || this.deltaTime.getNetworkTime()
        };
        
        // Add to ring buffer
        if (this.buffer.length < this.bufferSize) {
            this.buffer.push(snapshot);
        } else {
            this.buffer[this.bufferIndex] = snapshot;
            this.bufferIndex = (this.bufferIndex + 1) % this.bufferSize;
        }
        
        // Sort buffer by timestamp to ensure proper ordering
        this.buffer.sort((a, b) => a.timestamp - b.timestamp);
    }
    
    // Get interpolated state for current render time
    getInterpolatedState() {
        if (this.buffer.length === 0) return null;
        
        const renderTime = this.deltaTime.getRenderTime() * 1000; // Convert to ms
        const interpolationTime = renderTime - this.interpolationDelayMs;
        
        // Find the two snapshots to interpolate between
        const { before, after } = this.findInterpolationSnapshots(interpolationTime);
        
        if (!before) {
            // No suitable snapshots, return most recent
            return this.buffer[this.buffer.length - 1].state;
        }
        
        if (!after) {
            // Only one snapshot, return it
            return before.state;
        }
        
        // Calculate interpolation factor
        const timeDiff = after.timestamp - before.timestamp;
        const alpha = timeDiff > 0 ? (interpolationTime - before.timestamp) / timeDiff : 0;
        
        // Interpolate between the two states
        return this.interpolateStates(before.state, after.state, Math.max(0, Math.min(1, alpha)));
    }
    
    // Find the two snapshots to interpolate between
    findInterpolationSnapshots(targetTime) {
        let before = null;
        let after = null;
        
        for (let i = 0; i < this.buffer.length; i++) {
            const snapshot = this.buffer[i];
            
            if (snapshot.timestamp <= targetTime) {
                before = snapshot;
            } else if (snapshot.timestamp > targetTime && !after) {
                after = snapshot;
                break;
            }
        }
        
        return { before, after };
    }
    
    // Interpolate between two game states
    interpolateStates(stateA, stateB, alpha) {
        const interpolatedState = this.deepCopy(stateA);
        
        // Interpolate tanks
        if (stateA.tanks && stateB.tanks) {
            interpolatedState.tanks = this.interpolateTanks(stateA.tanks, stateB.tanks, alpha);
        }
        
        // Interpolate bullets
        if (stateA.bullets && stateB.bullets) {
            interpolatedState.bullets = this.interpolateBullets(stateA.bullets, stateB.bullets, alpha);
        }
        
        // Arena state doesn't need interpolation (static)
        if (stateA.arena) {
            interpolatedState.arena = stateA.arena;
        }
        
        return interpolatedState;
    }
    
    // Interpolate tank positions and rotations
    interpolateTanks(tanksA, tanksB, alpha) {
        const interpolatedTanks = [];
        
        // Create lookup for tanks in state B
        const tanksBMap = new Map();
        tanksB.forEach(tank => tanksBMap.set(tank.id, tank));
        
        tanksA.forEach(tankA => {
            const tankB = tanksBMap.get(tankA.id);
            
            if (tankB) {
                // Interpolate position
                const interpolatedTank = { ...tankA };
                interpolatedTank.x = this.lerp(tankA.x, tankB.x, alpha);
                interpolatedTank.y = this.lerp(tankA.y, tankB.y, alpha);
                
                // Interpolate rotation (handle angle wrapping)
                interpolatedTank.heading = this.lerpAngle(tankA.heading, tankB.heading, alpha);
                
                // Use most recent discrete state for non-interpolated properties
                interpolatedTank.ammo = tankB.ammo;
                interpolatedTank.shield = tankB.shield;
                interpolatedTank.speedMode = tankB.speedMode;
                interpolatedTank.alive = tankB.alive;
                interpolatedTank.killStreak = tankB.killStreak;
                interpolatedTank.name = tankB.name;
                interpolatedTank.rgb = tankB.rgb;
                
                interpolatedTanks.push(interpolatedTank);
            } else {
                // Tank doesn't exist in state B, use state A
                interpolatedTanks.push(tankA);
            }
        });
        
        // Add tanks that only exist in state B
        tanksB.forEach(tankB => {
            if (!tanksA.find(tankA => tankA.id === tankB.id)) {
                interpolatedTanks.push(tankB);
            }
        });
        
        return interpolatedTanks;
    }
    
    // Interpolate bullet positions
    interpolateBullets(bulletsA, bulletsB, alpha) {
        const interpolatedBullets = [];
        
        // Create lookup for bullets in state B
        const bulletsBMap = new Map();
        bulletsB.forEach(bullet => bulletsBMap.set(bullet.id, bullet));
        
        bulletsA.forEach(bulletA => {
            const bulletB = bulletsBMap.get(bulletA.id);
            
            if (bulletB) {
                // Interpolate position
                const interpolatedBullet = { ...bulletA };
                interpolatedBullet.x = this.lerp(bulletA.x, bulletB.x, alpha);
                interpolatedBullet.y = this.lerp(bulletA.y, bulletB.y, alpha);
                
                // Interpolate velocity
                interpolatedBullet.vx = this.lerp(bulletA.vx, bulletB.vx, alpha);
                interpolatedBullet.vy = this.lerp(bulletA.vy, bulletB.vy, alpha);
                
                // Use most recent discrete state for non-interpolated properties
                interpolatedBullet.life = bulletB.life;
                interpolatedBullet.active = bulletB.active;
                interpolatedBullet.ownerId = bulletB.ownerId;
                interpolatedBullet.radius = bulletB.radius;
                
                interpolatedBullets.push(interpolatedBullet);
            } else {
                // Bullet doesn't exist in state B, use state A
                interpolatedBullets.push(bulletA);
            }
        });
        
        // Add bullets that only exist in state B
        bulletsB.forEach(bulletB => {
            if (!bulletsA.find(bulletA => bulletA.id === bulletB.id)) {
                interpolatedBullets.push(bulletB);
            }
        });
        
        return interpolatedBullets;
    }
    
    // Linear interpolation
    lerp(a, b, t) {
        return a + (b - a) * t;
    }
    
    // Angle interpolation (shortest path)
    lerpAngle(a, b, t) {
        // Normalize angles to 0-360 range
        a = ((a % 360) + 360) % 360;
        b = ((b % 360) + 360) % 360;
        
        // Find shortest path
        let diff = b - a;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        
        return a + diff * t;
    }
    
    // Deep copy utility
    deepCopy(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        
        if (obj instanceof Array) {
            return obj.map(item => this.deepCopy(item));
        }
        
        if (typeof obj === 'object') {
            const copy = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    copy[key] = this.deepCopy(obj[key]);
                }
            }
            return copy;
        }
        
        return obj;
    }
    
    // Get buffer statistics
    getBufferStats() {
        if (this.buffer.length === 0) {
            return {
                size: 0,
                oldestTimestamp: 0,
                newestTimestamp: 0,
                bufferSpan: 0
            };
        }
        
        const timestamps = this.buffer.map(snapshot => snapshot.timestamp);
        const oldestTimestamp = Math.min(...timestamps);
        const newestTimestamp = Math.max(...timestamps);
        
        return {
            size: this.buffer.length,
            oldestTimestamp,
            newestTimestamp,
            bufferSpan: newestTimestamp - oldestTimestamp
        };
    }
    
    // Clear the buffer
    clear() {
        this.buffer = [];
        this.bufferIndex = 0;
        this.currentState = null;
    }
    
    // Check if buffer has enough data for interpolation
    hasData() {
        return this.buffer.length > 0;
    }
    
    // Get the most recent state without interpolation
    getLatestState() {
        if (this.buffer.length === 0) return null;
        
        // Find the most recent timestamp
        let latestSnapshot = this.buffer[0];
        for (let i = 1; i < this.buffer.length; i++) {
            if (this.buffer[i].timestamp > latestSnapshot.timestamp) {
                latestSnapshot = this.buffer[i];
            }
        }
        
        return latestSnapshot.state;
    }
    
    // Get buffer health (how well it's maintaining interpolation)
    getBufferHealth() {
        if (this.buffer.length === 0) return 0;
        
        const currentTime = this.deltaTime.getNetworkTime();
        const expectedDelay = this.interpolationDelayMs;
        
        // Check if we have recent enough data
        const latestSnapshot = this.buffer[this.buffer.length - 1];
        const dataAge = currentTime - latestSnapshot.timestamp;
        
        if (dataAge > expectedDelay * 2) {
            return 0; // Data is too old
        }
        
        // Calculate health based on buffer fullness and data freshness
        const fullnessScore = this.buffer.length / this.bufferSize;
        const freshnessScore = Math.max(0, 1 - dataAge / expectedDelay);
        
        return (fullnessScore + freshnessScore) / 2;
    }
}