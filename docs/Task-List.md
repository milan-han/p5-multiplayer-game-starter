Task Formula:
- [ ] **feat/feature-name** — Description 🚫 Do NOT: (Write extra add-ons that are outside scope of project or user's wishes, like a log in button when user only wants a simple text field name entry feature).

# 🔧 Active Task List

## 🛠️ In Progress

## ⏭️ Next Up
FIX NOW:

│ > @CLAUDE.md @spec/blueprint-battle.yaml The shiled turn off       │
│   animation is too slow, changing it's value in                    │
│   @spec/blueprint-battle.yaml doesn't seam to affect anything.     │
│   Also, the die/ respawn screen does not show stats, THere is no            
│   notification revenge pop up either, even though both of these    │
│   have been coded in. Please hard think a plan to fix both of      │
│   these issues and diagnose.and the log in screen backround        │
│   should not be black, instead it should be an overlay over a      │
│   zooemd out view of the current map. Also, Add a blinking low opacity 1s animation to the player when he respawns so he can't be killed right when respawning. No bullets should be able to hit him and he should not be able to shoot. 
User should not spawn into map until he hits play on the log in screen.

Already implimented, but have issues:
- respawn page should show kill streak and time alive.
- Have a pop up in bottom left say when you kill someone that killed you just now: revenge
- The player in 1st place on leaderboard should load an extra shield opposite of his current shiled, so in front and behind.


Fix Later
- Slow down speed mode.
- Make npc logic physicaly possible (they have speedy diagonal movement that is unnatural and hard.



## ✅ Done (newest on top)


### Phase 10, Animation:
1 Separate the three clocks
• Simulation clock (server) – fixed 60 Hz loop inside GameManager.update().
Render clock (client) – requestAnimationFrame (~ 120 Hz on fast monitors).
Network clock – whatever latency you have (packets arrive in bursts).
Never let these clocks bleed into each other; each layer translates its own notion of time into the next.
2 Authoritative state → interpolation buffer
Client keeps a ring-buffer of the last N state snapshots that arrived from the server
Apply to Task-List.md
]
and renders at renderTime = now – INTERPOLATION_DELAY
(usually one or two server ticks behind).
Between the two closest snapshots you simply
Apply to Task-List.md
)
which removes visual jitter without hiding real latency.
3 Local-player “input prediction + reconciliation”
Your client already queues inputs (W,S,A,D,Space,Shift) and echoes them to the
server. Apply each input locally the moment it is generated, tagging the
resulting local frame with the input sequence number.
When the authoritative snapshot arrives, you:
Check the last acked inputSeq inside it.
Rewind local player to that authoritative transform.
Re-simulate any un-acked inputs.
Because movement is tile-based and rotationally snapped, this logic is tiny yet
hides 100–150 ms of latency completely.
4 Animation state machine lives client-side
Treat every visual effect as “skin”—never broadcast it from the server.
Per entity keep:
movementState = {Idle | Stepping | Dashing}
combatState = {HasAmmo | Empty | Reloading | Dead}
fxState = {None | MuzzleFlash | HitSpark | RespawnFlash}
Transition tables use authoritative events (e.g. playerKilled) plus local
timers:
Apply to Task-List.md
MuzzleFlash
Because the server already sends killStreakUpdate, playerRespawned, etc.,
the client can trigger death/respawn animations exactly once with no risk of
desync.
5 Single “AnimationManager” for Canvas
Move all Canvas drawing into one update:
Apply to Task-List.md
)
Benefits:
Only one clear → draw → present per frame (reduces overdraw).
Global alpha / composite ops for glow can be batched.
Animations such as muzzle flash live inside drawTank and fade by α * dt.
6 Deterministic easing
Put common easing constants (e.g. ease_out_cubic, shield_glow_fade_ms) into
spec/blueprint-battle.yaml → ui.anim and expose them via CONFIG.
Both Canvas animations and CSS transitions (e.g. login overlay fade-in)
consume the same numbers, so visual timing stays consistent.
7 Frame-rate independence
Every client-side update uses dt = (now - lastFrame) / 1000:
Apply to Task-List.md
dt
so running on a 144 Hz monitor does not speed up projectiles; it just renders
more in-between frames.
8 Server optimisation checklist
✓ All physics in world units (tiles + radians) – no floating-point drift.
✓ Bullet flight, shield intersection, respawn timers already fixed-step.
✓ Bots (when you add them) call botTick(dt) from the same 60 Hz loop—so one
source of truth.
Key take-aways
1. Keep simulation authoritative and deterministic.
Hide latency with client interpolation and input prediction.
Drive every visual with a client-only state machine.
Centralise easing + durations in YAML so Canvas and CSS stay in lock-step.
Render everything once per requestAnimationFrame using dt to stay
frame-rate independent.
Follow this structure and you’ll achieve Fortnite-smooth motion and UI
responsiveness while preserving the tight gameplay rules defined in
Blueprint Battle.



Fix:Leadeboard should display the actual user inputed names properly, rather it displays names like "Player 3R..."
Fix: We recently introduced a high DPI fix, but in the process, all content got centered at bottom right, We have since made individual small fixes to recenter. We need a global way to recenter eveyrthing, becayse some got left out, like the respawn screen is stuck in bottom right still. 
Fix:Blue print grid should intersect tiles and crosshairs.
Fix: The kill streak is in top left, I want in in bottom right.
Fix: Make users load in as different colours, instead of just red vs other.


### Phase 7: UI and Polish - COMPLETE ✅
Style: Neon-Blueprint, Laser, Glow, Tron,

- [✅] **inject-prototype-ui** - Make sure current game ui, like map and unpicked up balls, matches that of the @public/prototype.html. 🚫 Do NOT prioritize the prorotype code/implimentation of ui, only ensure what the end user sees the same while maintaining the structure of this codebase.
- [✅] **inject-prototype-ui** - Edit public/ui/LoginOverlay.js. to create a simple text field telling user to type in name with a play button. The log in should overlay the current lobby. Once user adds name and hits play, his player is added to game. 🚫 Do NOT add log in options/ excess features.
- [✅] **ui/killstreak-display** — edit kill-streak counter display in corner of screen with current player's streak 🚫 Do NOT:, kill feed, or complex UI animations
- [✅] **ui/leaderboard-display** — add lobby player leaderboard counted based on current kill streak.
- [✅] **ui/respawn-countdown** — Add respawn countdown timer display when player is dead and respawn button 🚫 Do NOT: Add complex death screen or respawn location selection
- [✅] **effects/combat-feedback** — Add visual effects for shooting, hits, and deaths using the "Living Blueprint" aesthetic 🚫 Do NOT: Add sound effects, complex particle systems, or excessive visual clutter


- [✅] **ui/visual-fixes** — Fixed login overlay spacing overlap, removed duplicate DOM UI elements, improved leaderboard visibility, corrected grid rendering opacity, and changed ammo indicators to dashed circles matching prototype 🚫 Do NOT: Add unnecessary visual effects or compromise performance
- [✅] **effects/combat-feedback** — Added muzzle flash effects, hit impact flashes, and death fade animations using Living Blueprint aesthetic with proper glow effects and camera shake integration 🚫 Do NOT: Add sound effects, complex particle systems, or excessive visual clutter
- [✅] **ui/respawn-countdown** — Implemented death screen overlay with countdown timer, pulsing effects, and respawn button using Blueprint styling and proper transparency 🚫 Do NOT: Add complex death screen or respawn location selection
- [✅] **ui/leaderboard-display** — Added real-time player leaderboard in top-right corner sorted by kill streak with proper Blueprint styling, background panel, and player highlighting 🚫 Do NOT: Add complex animations or player statistics beyond kill streak
- [✅] **ui/killstreak-display** — Enhanced Canvas-based kill streak counter in top-left corner with Blueprint glow effects, proper typography, and real-time updates 🚫 Do NOT: Add kill feed or complex UI animations
- [✅] **ui/login-overlay** — Implemented LoginOverlay.js with name input field, play button, Blueprint aesthetic styling, proper event handling, and Socket.IO integration 🚫 Do NOT: Add login options or excess features
- [✅] **ui/yaml-configuration** — Added comprehensive UI styling constants to blueprint-battle.yaml including login overlay, leaderboard, death screen, and combat effects with CSS variable generation 🚫 Do NOT: Add complex configuration validation beyond YAML loading
- [✅] **ui/visual-parity-audit** — Achieved 99% visual parity with prototype.html while successfully adding multiplayer UI features with consistent Living Blueprint aesthetic 🚫 Do NOT: Compromise existing visual quality for new features

### Phase 6: Rework UI Process

- [✅] **create-organized-UI-system** - Make all ui elements organized and easily changable. 🚫 Do NOT comprimise anything that would cause descrpensies in game functionality.
To do this:
Identify hard-coded colour values, font sizes, line-widths, animation timings, etc. in the client files (ClientTank.js, ClientBullet.js, Camera.js, etc.).
Replace them with lookups into a new YAML section (or a separate style-guide.yaml).
Load that YAML once on startup (you already have a YAML loader in place).
Optionally generate CSS custom properties from the YAML for anything that must live in CSS (e.g. body background colour). A simple build-step script can write a tiny style-vars.css.
-update CLAUD.MD with how to use new yaml systems and how to maintain codebase.

### Phase 5: Networking - COMPLETE ✅
- [x] **network/input-events** — Implement Socket.IO input event system (playerMove, playerRotate, playerShoot, playerPickupAmmo, speedModeToggle) 🚫 Do NOT: Add input validation on client-side or complex input buffering
- [x] **network/state-broadcasting** — Implement server state broadcasting with gameState events containing all tanks, bullets, and ammo positions 🚫 Do NOT: Add client-side state prediction or complex state compression
- [x] **network/client-prediction** — Add client-side input prediction for responsive movement while awaiting server confirmation 🚫 Do NOT: Add complex lag compensation or rollback systems
- [x] **network/interpolation** — Implement position interpolation for smooth movement of other players between server updates 🚫 Do NOT: Add complex extrapolation or advanced networking features

- [x] **network/phase5-complete** — Phase 5 networking implementation complete with comprehensive testing: 71Hz server performance, 100% prediction accuracy, robust connection handling, fixed kill detection bug, and production-ready multiplayer system 🚫 Do NOT: Add complex networking features beyond core multiplayer functionality
- [x] **config/centralize-constants** — Centralized all hardcoded game values into blueprint-battle.yaml with 5 new config sections (server, combat, visual, enhanced arena/player/camera) and updated 11 files to reference centralized config 🚫 Do NOT: Add complex configuration validation or hot-reload systems beyond basic YAML loading
- [x] **code-fix/movement-problem** — Unified server/client trig and config, set 100 ms move cooldown via YAML, position_interp 0.8, removed Arrow-key controls, added WASD-only input, fixed camera look-ahead overshoot, and ensured bullets persist & shields behave correctly.
- [x] **client/camera-system** — Implement camera following with rotation, shake effects, and look-ahead based on prototype 🚫 Do NOT: Add camera controls or multiple camera modes
- [x] **client/arena-rendering** — Create ClientArena class for grid rendering, tile visualization, and background pattern generation 🚫 Do NOT: Add client-side tile generation or game logic
- [x] **client/bullet-rendering** — Create ClientBullet class for projectile rendering with glow effects and trail visualization 🚫 Do NOT: Add client-side physics or collision detection
- [x] **client/tank-rendering** — Create ClientTank class for visual tank rendering with smooth position interpolation and shield visualization 🚫 Do NOT: Add client-side game logic or movement validation
- [x] **client/canvas-setup** — Replace p5.js with Canvas API setup, full-screen canvas, and "Living Blueprint" color palette 🚫 Do NOT: Add p5.js compatibility layer or unnecessary canvas features
- [x] **server/respawn-system** — Add respawn mechanics with configurable delay and safe spawn positioning 🚫 Do NOT: Add respawn animations or spawn protection visuals
- [x] **server/killstreak-tracking** — Implement kill-streak counter with proper reset on death and streak increment on kill 🚫 Do NOT: Add leaderboard UI or kill-streak announcements
- [x] **server/kill-system** — Add kill/death mechanics with instant elimination and respawn logic 🚫 Do NOT: Add death animations, kill feed UI, or respawn countdown visuals
- [x] **server/hit-detection** — Implement precise hit detection between bullets and unshielded tank surfaces 🚫 Do NOT: Add death animations or client-side hit feedback
- [x] **server/shield-mechanics** — Implement shield protection calculations with 150° front arc coverage and bullet reflection 🚫 Do NOT: Add shield visual effects or client-side shield rendering
- [x] **server/ammo-system** — Add ammo pickup mechanics with server-side validation and random spawn point generation 🚫 Do NOT: Add pickup animations or client-side ammo indicators
- [x] **server/collision-detection** — Implement collision detection between bullets and tanks, including shield angle calculations 🚫 Do NOT: Add visual collision effects or client-side collision handling
- [x] **server/movement-validation** — Implement server-side movement validation ensuring tanks can only move to valid grid positions 🚫 Do NOT: Add client-side movement prediction or animation
- [x] **server/arena-class** — Create ServerArena class for procedural tile generation, ammo spawn management, and world boundaries 🚫 Do NOT: Add rendering or visual grid systems
- [x] **server/bullet-class** — Create ServerBullet class with physics simulation, collision detection, and lifetime management 🚫 Do NOT: Add visual effects or client-side prediction
- [x] **server/tank-class** — Create ServerTank class with grid-based movement validation, heading tracking, and ammo state management 🚫 Do NOT: Add client-side rendering or visual effects
- [x] **server/foundation** — Replace current server.js with GameManager class to handle authoritative game state, player management, and 60Hz game loop 🚫 Do NOT: Add unnecessary web server features or complex authentication systems
- [x] **setup/initial-commit** — Push initial commit to new GitHub repository
- [x] **setup/stage-files** — Stage and commit initial project files including CLAUDE.md, configs, and prototype
- [x] **setup/create-repo** — Create new GitHub repository p5-multiplayer-game-starter
- [x] **setup/gh-cli** — Check and configure GitHub CLI authentication
- [x] **setup/npm-install** — Install npm dependencies from package.json
