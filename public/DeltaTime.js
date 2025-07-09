// =================================================================================
// DELTA TIME SYSTEM - Blueprint Battle
// =================================================================================

class DeltaTime {
    constructor() {
        // Clock separation - track different timing systems
        this.renderTime = 0;
        this.lastRenderTime = 0;
        this.smoothedDeltaTime = 0;
        
        // Frame rate independence
        this.targetFPS = CONFIG.ui.anim.target_fps;
        this.maxDeltaTime = CONFIG.ui.anim.max_delta_time;
        this.minDeltaTime = CONFIG.ui.anim.min_delta_time;
        this.deltaTimeSmoothing = CONFIG.ui.anim.delta_time_smoothing;
        
        // Performance tracking
        this.frameCount = 0;
        this.lastFPSUpdate = 0;
        this.currentFPS = 0;
        
        // Initialize with current time
        this.lastRenderTime = performance.now() / 1000;
    }
    
    // Update delta time for current frame
    update() {
        const currentTime = performance.now() / 1000;
        this.renderTime = currentTime;
        
        // Calculate raw delta time
        let rawDeltaTime = this.renderTime - this.lastRenderTime;
        
        // Clamp delta time to prevent large jumps
        rawDeltaTime = Math.max(this.minDeltaTime, Math.min(this.maxDeltaTime, rawDeltaTime));
        
        // Smooth delta time to reduce jitter
        this.smoothedDeltaTime = this.lerp(this.smoothedDeltaTime, rawDeltaTime, this.deltaTimeSmoothing);
        
        // Update last render time
        this.lastRenderTime = currentTime;
        
        // Update FPS tracking
        this.updateFPSTracking();
        
        return this.smoothedDeltaTime;
    }
    
    // Get current delta time
    getDeltaTime() {
        return this.smoothedDeltaTime;
    }
    
    // Get raw delta time (unsmoothed)
    getRawDeltaTime() {
        return this.renderTime - this.lastRenderTime;
    }
    
    // Get render time (client render clock)
    getRenderTime() {
        return this.renderTime;
    }
    
    // Get simulation time (server time with interpolation delay)
    getSimulationTime() {
        return this.renderTime - (CONFIG.ui.anim.interpolation_delay_ms / 1000);
    }
    
    // Get network time (current time for network events)
    getNetworkTime() {
        return performance.now();
    }
    
    // Convert frames to seconds at target FPS
    framesToSeconds(frames) {
        return frames / this.targetFPS;
    }
    
    // Convert seconds to frames at target FPS
    secondsToFrames(seconds) {
        return seconds * this.targetFPS;
    }
    
    // Convert milliseconds to seconds
    msToSeconds(milliseconds) {
        return milliseconds / 1000;
    }
    
    // Convert seconds to milliseconds
    secondsToMs(seconds) {
        return seconds * 1000;
    }
    
    // Frame-rate independent lerp
    frameRateIndependentLerp(current, target, rate) {
        // Convert rate from "per frame at 60Hz" to "per second"
        const ratePerSecond = 1 - Math.pow(1 - rate, this.targetFPS * this.smoothedDeltaTime);
        return this.lerp(current, target, ratePerSecond);
    }
    
    // Frame-rate independent exponential decay
    frameRateIndependentDecay(current, decayRate) {
        // Convert decay rate from "per frame at 60Hz" to "per second"
        return current * Math.pow(decayRate, this.targetFPS * this.smoothedDeltaTime);
    }
    
    // Standard lerp function
    lerp(a, b, t) {
        return a + (b - a) * Math.max(0, Math.min(1, t));
    }
    
    // Update FPS tracking
    updateFPSTracking() {
        this.frameCount++;
        
        if (this.renderTime - this.lastFPSUpdate >= 1.0) {
            this.currentFPS = this.frameCount;
            this.frameCount = 0;
            this.lastFPSUpdate = this.renderTime;
        }
    }
    
    // Get current FPS
    getFPS() {
        return this.currentFPS;
    }
    
    // Check if running at target frame rate
    isRunningAtTargetFPS() {
        return Math.abs(this.currentFPS - this.targetFPS) < 5; // Allow 5 FPS tolerance
    }
    
    // Get performance info
    getPerformanceInfo() {
        return {
            fps: this.currentFPS,
            deltaTime: this.smoothedDeltaTime,
            renderTime: this.renderTime,
            simulationTime: this.getSimulationTime(),
            isStable: this.isRunningAtTargetFPS()
        };
    }
    
    // Reset timing (useful for pause/resume)
    reset() {
        this.lastRenderTime = performance.now() / 1000;
        this.smoothedDeltaTime = 1 / this.targetFPS; // Start with target frame time
        this.frameCount = 0;
        this.lastFPSUpdate = 0;
    }
    
    // Check if enough time has passed for a frame-rate independent action
    hasTimeElapsed(lastTime, intervalMs) {
        return (this.getNetworkTime() - lastTime) >= intervalMs;
    }
    
    // Get alpha value for smooth transitions based on delta time
    getTransitionAlpha(durationMs) {
        return Math.min(1, this.smoothedDeltaTime * 1000 / durationMs);
    }
    
    // Animate a value towards a target with frame-rate independence
    animateTowards(current, target, rate, threshold = 0.001) {
        const newValue = this.frameRateIndependentLerp(current, target, rate);
        
        // Snap to target if close enough
        if (Math.abs(newValue - target) < threshold) {
            return target;
        }
        
        return newValue;
    }
    
    // Pulse animation (sine wave) with frame-rate independence
    getPulseValue(frequency = 1, amplitude = 1, offset = 0) {
        return offset + amplitude * Math.sin(this.renderTime * frequency * Math.PI * 2);
    }
    
    // Saw wave animation with frame-rate independence
    getSawValue(frequency = 1, amplitude = 1, offset = 0) {
        const phase = (this.renderTime * frequency) % 1;
        return offset + amplitude * phase;
    }
    
    // Triangle wave animation with frame-rate independence
    getTriangleValue(frequency = 1, amplitude = 1, offset = 0) {
        const phase = (this.renderTime * frequency) % 1;
        const trianglePhase = phase < 0.5 ? phase * 2 : 2 - phase * 2;
        return offset + amplitude * trianglePhase;
    }
}