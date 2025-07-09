// =================================================================================
// ANIMATION STATE MACHINE - Blueprint Battle
// =================================================================================

class AnimationStateMachine {
    constructor(entityId, deltaTime) {
        this.entityId = entityId;
        this.deltaTime = deltaTime;
        
        // State machines for different aspects
        this.movementState = 'Idle';
        this.combatState = 'Empty';
        this.fxState = 'None';
        
        // State timers and data
        this.stateTimers = {
            movement: 0,
            combat: 0,
            fx: 0
        };
        
        this.stateData = {
            movement: {},
            combat: {},
            fx: {}
        };
        
        // Animation values
        this.animationValues = {
            shieldAlpha: 0,
            muzzleFlashAlpha: 0,
            hitFlashAlpha: 0,
            deathFadeAlpha: 0,
            positionOffset: { x: 0, y: 0 },
            rotationOffset: 0,
            scaleMultiplier: 1,
            glowIntensity: 1
        };
        
        // Transition configuration
        this.transitionSpeeds = {
            movement: CONFIG.ui.anim.movement_state_transition_ms,
            combat: CONFIG.ui.anim.combat_state_transition_ms,
            fx: CONFIG.ui.anim.effect_state_transition_ms
        };
    }
    
    // Update all state machines
    update(entityData, events = []) {
        const dt = this.deltaTime.getDeltaTime();
        
        // Process events first
        events.forEach(event => this.processEvent(event));
        
        // Update state machines
        this.updateMovementState(entityData, dt);
        this.updateCombatState(entityData, dt);
        this.updateFxState(entityData, dt);
        
        // Update animation values
        this.updateAnimationValues(entityData, dt);
        
        // Update timers
        this.updateTimers(dt);
    }
    
    // Process authoritative events from server
    processEvent(event) {
        switch (event.type) {
            case 'playerShot':
                if (event.playerId === this.entityId) {
                    this.triggerFx('MuzzleFlash');
                }
                break;
                
            case 'bulletHit':
                if (event.targetId === this.entityId) {
                    this.triggerFx('HitSpark');
                }
                break;
                
            case 'playerKilled':
                if (event.victim === this.entityId) {
                    this.triggerFx('DeathFade');
                    this.setCombatState('Dead');
                }
                break;
                
            case 'playerRespawned':
                if (event.playerId === this.entityId) {
                    this.triggerFx('RespawnFlash');
                    this.setCombatState('Empty');
                }
                break;
                
            case 'ammoPickup':
                if (event.playerId === this.entityId) {
                    this.setCombatState('HasAmmo');
                }
                break;
        }
    }
    
    // Update movement state machine
    updateMovementState(entityData, dt) {
        if (!entityData || !entityData.alive) {
            this.setMovementState('Idle');
            return;
        }
        
        const isMoving = entityData.speedMode || 
                        (entityData.lastMoveTime && (Date.now() - entityData.lastMoveTime) < 200);
        
        switch (this.movementState) {
            case 'Idle':
                if (isMoving) {
                    if (entityData.speedMode) {
                        this.setMovementState('Dashing');
                    } else {
                        this.setMovementState('Stepping');
                    }
                }
                break;
                
            case 'Stepping':
                if (entityData.speedMode) {
                    this.setMovementState('Dashing');
                } else if (!isMoving) {
                    this.setMovementState('Idle');
                }
                break;
                
            case 'Dashing':
                if (!entityData.speedMode) {
                    if (isMoving) {
                        this.setMovementState('Stepping');
                    } else {
                        this.setMovementState('Idle');
                    }
                }
                break;
        }
    }
    
    // Update combat state machine
    updateCombatState(entityData, dt) {
        if (!entityData || !entityData.alive) {
            if (this.combatState !== 'Dead') {
                this.setCombatState('Dead');
            }
            return;
        }
        
        switch (this.combatState) {
            case 'Empty':
                if (entityData.ammo > 0) {
                    this.setCombatState('HasAmmo');
                }
                break;
                
            case 'HasAmmo':
                if (entityData.ammo <= 0) {
                    this.setCombatState('Empty');
                }
                break;
                
            case 'Dead':
                // Only transition out of dead state via respawn event
                break;
        }
    }
    
    // Update fx state machine
    updateFxState(entityData, dt) {
        switch (this.fxState) {
            case 'None':
                // Effects are triggered by events
                break;
                
            case 'MuzzleFlash':
                if (this.stateTimers.fx >= CONFIG.ui.anim.muzzle_flash_duration_ms / 1000) {
                    this.setFxState('None');
                }
                break;
                
            case 'HitSpark':
                if (this.stateTimers.fx >= CONFIG.ui.anim.hit_flash_duration_ms / 1000) {
                    this.setFxState('None');
                }
                break;
                
            case 'DeathFade':
                if (this.stateTimers.fx >= CONFIG.ui.anim.death_fade_duration_ms / 1000) {
                    this.setFxState('None');
                }
                break;
                
            case 'RespawnFlash':
                if (this.stateTimers.fx >= CONFIG.ui.anim.respawn_flash_duration_ms / 1000) {
                    this.setFxState('None');
                }
                break;
        }
    }
    
    // Update animation values based on current states
    updateAnimationValues(entityData, dt) {
        // Shield alpha animation
        this.updateShieldAlpha(entityData, dt);
        
        // Muzzle flash animation
        this.updateMuzzleFlash(dt);
        
        // Hit flash animation
        this.updateHitFlash(dt);
        
        // Death fade animation
        this.updateDeathFade(dt);
        
        // Position and rotation effects
        this.updatePositionEffects(entityData, dt);
        
        // Glow intensity
        this.updateGlowIntensity(entityData, dt);
    }
    
    // Update shield alpha based on combat state
    updateShieldAlpha(entityData, dt) {
        const targetAlpha = (entityData && entityData.alive && entityData.shield && !entityData.speedMode) ? 1 : 0;
        const fadeRate = CONFIG.ui.anim.alpha_fade_rate;
        
        this.animationValues.shieldAlpha = this.deltaTime.frameRateIndependentLerp(
            this.animationValues.shieldAlpha,
            targetAlpha,
            fadeRate
        );
    }
    
    // Update muzzle flash effect
    updateMuzzleFlash(dt) {
        if (this.fxState === 'MuzzleFlash') {
            const progress = this.stateTimers.fx / (CONFIG.ui.anim.muzzle_flash_duration_ms / 1000);
            this.animationValues.muzzleFlashAlpha = Math.max(0, 1 - progress);
        } else {
            this.animationValues.muzzleFlashAlpha = 0;
        }
    }
    
    // Update hit flash effect
    updateHitFlash(dt) {
        if (this.fxState === 'HitSpark') {
            const progress = this.stateTimers.fx / (CONFIG.ui.anim.hit_flash_duration_ms / 1000);
            this.animationValues.hitFlashAlpha = Math.max(0, 1 - progress);
        } else {
            this.animationValues.hitFlashAlpha = 0;
        }
    }
    
    // Update death fade effect
    updateDeathFade(dt) {
        if (this.fxState === 'DeathFade') {
            const progress = this.stateTimers.fx / (CONFIG.ui.anim.death_fade_duration_ms / 1000);
            this.animationValues.deathFadeAlpha = Math.max(0, 1 - progress);
        } else {
            this.animationValues.deathFadeAlpha = 0;
        }
    }
    
    // Update position effects (screen shake, recoil, etc.)
    updatePositionEffects(entityData, dt) {
        // Reset position offset
        this.animationValues.positionOffset.x = 0;
        this.animationValues.positionOffset.y = 0;
        
        // Add recoil effect for muzzle flash
        if (this.fxState === 'MuzzleFlash' && entityData) {
            const recoilStrength = 5 * this.animationValues.muzzleFlashAlpha;
            const headingRad = (entityData.heading || 0) * Math.PI / 180;
            this.animationValues.positionOffset.x = -Math.cos(headingRad) * recoilStrength;
            this.animationValues.positionOffset.y = -Math.sin(headingRad) * recoilStrength;
        }
        
        // Add impact effect for hit spark
        if (this.fxState === 'HitSpark') {
            const impactStrength = 3 * this.animationValues.hitFlashAlpha;
            this.animationValues.positionOffset.x = (Math.random() - 0.5) * impactStrength;
            this.animationValues.positionOffset.y = (Math.random() - 0.5) * impactStrength;
        }
    }
    
    // Update glow intensity
    updateGlowIntensity(entityData, dt) {
        let baseIntensity = 1;
        
        // Increase intensity for speed mode
        if (entityData && entityData.speedMode) {
            baseIntensity = 1.5;
        }
        
        // Pulse effect for certain states
        if (this.fxState === 'RespawnFlash') {
            const pulseValue = this.deltaTime.getPulseValue(5, 0.5, 0.5);
            baseIntensity += pulseValue;
        }
        
        this.animationValues.glowIntensity = this.deltaTime.frameRateIndependentLerp(
            this.animationValues.glowIntensity,
            baseIntensity,
            CONFIG.ui.anim.glow_pulse_speed
        );
    }
    
    // Set movement state
    setMovementState(newState) {
        if (this.movementState !== newState) {
            this.movementState = newState;
            this.stateTimers.movement = 0;
            this.stateData.movement = {};
        }
    }
    
    // Set combat state
    setCombatState(newState) {
        if (this.combatState !== newState) {
            this.combatState = newState;
            this.stateTimers.combat = 0;
            this.stateData.combat = {};
        }
    }
    
    // Set fx state
    setFxState(newState) {
        if (this.fxState !== newState) {
            this.fxState = newState;
            this.stateTimers.fx = 0;
            this.stateData.fx = {};
        }
    }
    
    // Trigger an fx effect
    triggerFx(fxType) {
        this.setFxState(fxType);
    }
    
    // Update state timers
    updateTimers(dt) {
        this.stateTimers.movement += dt;
        this.stateTimers.combat += dt;
        this.stateTimers.fx += dt;
    }
    
    // Get current animation values
    getAnimationValues() {
        return { ...this.animationValues };
    }
    
    // Get current states
    getStates() {
        return {
            movement: this.movementState,
            combat: this.combatState,
            fx: this.fxState
        };
    }
    
    // Reset state machine
    reset() {
        this.movementState = 'Idle';
        this.combatState = 'Empty';
        this.fxState = 'None';
        
        this.stateTimers = {
            movement: 0,
            combat: 0,
            fx: 0
        };
        
        this.stateData = {
            movement: {},
            combat: {},
            fx: {}
        };
        
        // Reset animation values
        this.animationValues = {
            shieldAlpha: 0,
            muzzleFlashAlpha: 0,
            hitFlashAlpha: 0,
            deathFadeAlpha: 0,
            positionOffset: { x: 0, y: 0 },
            rotationOffset: 0,
            scaleMultiplier: 1,
            glowIntensity: 1
        };
    }
    
    // Check if entity is in a specific state
    isInState(category, state) {
        switch (category) {
            case 'movement':
                return this.movementState === state;
            case 'combat':
                return this.combatState === state;
            case 'fx':
                return this.fxState === state;
            default:
                return false;
        }
    }
    
    // Check if any effects are active
    hasActiveEffects() {
        return this.fxState !== 'None' || 
               this.animationValues.shieldAlpha > 0 ||
               this.animationValues.muzzleFlashAlpha > 0 ||
               this.animationValues.hitFlashAlpha > 0 ||
               this.animationValues.deathFadeAlpha > 0;
    }
    
    // Get debug info
    getDebugInfo() {
        return {
            entityId: this.entityId,
            states: this.getStates(),
            timers: { ...this.stateTimers },
            animationValues: this.getAnimationValues(),
            hasActiveEffects: this.hasActiveEffects()
        };
    }
}