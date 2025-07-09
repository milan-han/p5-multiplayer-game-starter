# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js multiplayer game starter built with p5.js, Socket.IO, and Express. The project is a cloned template from P5-MULTIPLAYER-GAME-STARTER designed to quickly develop real-time multiplayer games.

**Current Goal**: Transform the sophisticated single-player "Blueprint Battle" prototype (`public/prototype.html`) into a competitive multiplayer tank combat game. Replace the current simple circle-based template with a full-featured multiplayer implementation featuring:

- **Grid-based tank combat** with directional shields and ammo collection
- **Kill-streak system** where players compete for the longest elimination streak
- **Real-time combat** with projectile physics and collision detection
- **"Living Blueprint" aesthetic** with neon graphics and rotating camera
- **Server-authoritative gameplay** for fair multiplayer combat
- **Respawn system** with instant death and timed respawning

## Development Commands

- `npm install` - Install dependencies
- `npm start` - Start the development server with nodemon on port 80
- `npm test` - Currently shows "no test specified" error

## SPEC 
@spec/blueprint-battle.yaml

## Architecture Overview

### Server-Side (`server/`)
- **server.js**: Main Express server with Socket.IO integration
  - Serves static files from `public/`
  - Manages player connections and disconnections
  - Runs game loop at 16ms intervals (`updateGame()`)
  - Broadcasts game state via `heartbeat` events
- **Player.js**: Server-side player class with random positioning and RGB colors
- **config.js**: Currently empty configuration file

### Client-Side (`public/`)
- **index.html**: Main multiplayer game entry point using p5.js
- **sketch.js**: p5.js game loop connecting to Socket.IO server
  - Handles player rendering and game state updates
  - Processes `heartbeat` events from server
- **Player.js**: Client-side player rendering class
- **prototype.html**: Single-player prototype showcasing "Blueprint Battle" game mechanics
  - Complete game with tank movement, shooting, grid-based arena
  - Features camera following, collision detection, ammo system
  - Uses vanilla JavaScript Canvas API with "Living Blueprint" aesthetic

### Game Architecture Patterns
- **Server-Authoritative Combat**: Server handles all game logic, collision detection, and kill validation
- **Input-Based Networking**: Clients send input events, server broadcasts authoritative state
- **Grid-Based Movement**: Discrete positioning system (250px tiles) with smooth animation
- **Real-time Combat**: Bullet physics, shield mechanics, and collision detection at 60Hz
- **State Synchronization**: Server broadcasts game state, clients render and interpolate

## Key Technical Details

### Socket.IO Integration
- Server listens on port 80 with `socket.io(server)`
- Client connects to `http://localhost` 
- **Input Events**: `playerMove`, `playerRotate`, `playerShoot`, `playerPickupAmmo`, `speedModeToggle`
- **State Events**: `gameState`, `playerKilled`, `playerRespawned`, `killStreakUpdate`
- Automatic cleanup on player disconnect

### Canvas API Setup (replacing p5.js)
- Uses vanilla JavaScript Canvas API for better performance
- Full-screen canvas with responsive sizing
- **"Living Blueprint" aesthetic**: Neon colors, grid patterns, glowing effects
- **Color Palette**: `#000000` (base), `#9EE7FF` (primary), `#00FFF7` (glow), `#FF5C5C` (player)

### Blueprint Battle Game Features
- **Tank Class**: Grid-based movement (250px tiles) with smooth interpolation
- **Combat System**: Directional shields (150° front arc), projectile physics, hit detection
- **Bullet System**: Glowing projectiles with drag, lifetime limits, and shield reflection
- **Arena System**: Procedural grid generation with random ammo spawn points
- **Camera System**: Player-following camera with rotation, shake effects, and look-ahead
- **Speed Mode**: Trade shield protection for continuous movement (hold Shift)
- **Kill-Streak System**: Track eliminations, instant respawn, competitive scoring
- **Input Handling**: Arrow keys (movement/rotation), Space (pickup/shoot), Shift (speed mode)

## File Structure Notes

- `ui/LoginOverlay.js` exists but is empty - likely planned for name entry UI
- `config.js` files are empty on both server and client sides
- `test/` directory exists but contains no test files
- `docs/` contains project documentation and task planning files

## Development Workflow

### Implementation Strategy
1. **Replace p5.js template** with Canvas API-based multiplayer Blueprint Battle
2. **Server-side conversion**: Transform prototype classes into authoritative server logic
3. **Client-side adaptation**: Convert prototype rendering for multiplayer state synchronization
4. **Network layer**: Implement input events and state broadcasting
5. **Combat system**: Add kill detection, respawn mechanics, and streak tracking

### Class Structure Transformation
**Server Classes** (authoritative):
- `ServerTank`: Movement validation, collision detection, kill/respawn logic
- `ServerBullet`: Physics simulation, hit detection, shield interaction
- `ServerArena`: Shared world state, ammo spawn management
- `GameManager`: Kill-streak tracking, respawn timers, game state coordination

**Client Classes** (rendering):
- `ClientTank`: Visual representation, input prediction, interpolation
- `ClientBullet`: Projectile effects, trail rendering, impact animations
- `ClientArena`: Multi-player rendering, UI overlay, camera management
- `NetworkManager`: Input transmission, state synchronization, lag compensation

### Technical Priorities
1. **Performance**: 60Hz server tick rate for smooth combat
2. **Fairness**: Server-authoritative hit detection and movement validation
3. **Responsiveness**: Client-side prediction with server reconciliation
4. **Visual Quality**: Maintain prototype's polished "Living Blueprint" aesthetic