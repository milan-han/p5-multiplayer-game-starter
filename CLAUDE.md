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
- `npm run build:css` - Generate CSS custom properties from YAML configuration

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
- **index.html**: Main multiplayer game entry point using Canvas API
- **game.js**: Main game loop with Socket.IO integration
  - Handles player rendering and game state updates
  - Processes `heartbeat` events from server
  - Integrates with centralized UI system
- **Centralized UI System**:
  - **UIManager.js**: Main UI controller handling all UI states and rendering
  - **UIState.js**: State machine for login → game → death → respawn flow
  - **UIComponents.js**: Reusable UI components with consistent styling
- **Animation & Rendering**:
  - **AnimationManager.js**: Entity animations and effects (game objects only)
  - **Camera.js**: Player-following camera with rotation and shake effects
  - **ClientTank.js**, **ClientBullet.js**, **ClientArena.js**: Game entity rendering
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
- **DPI-aware rendering**: Consistent scaling across all devices using DPR utility

### Centralized UI System Architecture
The UI system is built on three core components that work together:

#### 1. UIManager (Main Controller)
- **Purpose**: Central coordinator for all UI rendering and state management
- **Responsibilities**:
  - Handles all UI rendering in a single render loop
  - Manages UI state transitions (login → game → death → respawn)
  - Coordinates with UIComponents for visual rendering
  - Manages event handling and user interactions
- **Usage**: `uiManager.render(gameState, myPlayerId)` in main game loop

#### 2. UIState (State Machine)
- **Purpose**: Manages UI state transitions and user interactions
- **State Flow**: `login` → `connecting` → `game` → `death` → `game`
- **Key Methods**:
  - `transitionTo(newState, data)` - Change UI state
  - `validateLoginInput()` - Validate user input
  - `updateInteractiveElements(x, y)` - Handle mouse interactions
  - `registerInteractiveElement(id, bounds, type, callback)` - Add clickable elements

#### 3. UIComponents (Visual Components)
- **Purpose**: Reusable UI components with consistent styling
- **Key Components**:
  - `drawFrostedGlassPanel()` - Consistent panel backgrounds
  - `drawText()` - Typography with design system compliance
  - `drawInputField()` - Interactive input fields
  - `drawButton()` - Interactive buttons
  - `drawLeaderboardEntry()` - Player leaderboard entries

### YAML Configuration System
- **Configuration File**: `spec/blueprint-battle.yaml` (single source of truth)
- **Build Process**: `npm run build:css` generates CSS variables from YAML
- **Access Pattern**: `CONFIG.section.property` in JavaScript code

#### Enhanced Configuration Sections:
- **`colors`**: Unified color system with 22 color variables
  - Base colors: `base`, `white`, `primary`, `primary_dim`
  - Accent colors: `accent_cyan`, `accent_error`
  - UI colors: `ui_cyan`, `ui_background`, `ui_border`, `ui_text_dim`
- **`typography`**: Complete typography system
  - Font families: `primary_font`, `title_font`, `monospace_font`
  - Size scale: `display_large` → `display_medium` → `heading_large` → `body_large` → `caption`
  - Weights: `light` → `regular` → `medium` → `semibold` → `bold` → `extrabold`
  - Predefined styles: `display_title`, `panel_header`, `ui_primary`, `button_text`, etc.
- **`ui`**: UI layout and spacing values
- **`patterns`**: Line dash patterns and visual effects
- **`css_overrides`**: Values that need CSS custom properties generation

### UI Development Workflow

#### Adding New UI Elements:
1. **Design in UIComponents**: Create reusable component methods
2. **Manage State**: Add state handling to UIState if needed
3. **Coordinate in UIManager**: Add rendering logic to appropriate render method
4. **Configure in YAML**: Add any new constants to `spec/blueprint-battle.yaml`
5. **Build CSS**: Run `npm run build:css` to generate CSS variables
6. **Test**: Verify visual consistency across all UI states

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

### Current UI System Files
- **`public/UIManager.js`**: Main UI controller (800+ lines)
- **`public/UIState.js`**: State machine implementation (400+ lines)  
- **`public/UIComponents.js`**: Reusable UI components (600+ lines)
- **`public/ui/LoginOverlay.js`**: Legacy file - functionality moved to UIManager
- **`public/style-vars.css`**: Auto-generated CSS variables (22 colors, 11 typography styles)

### Other Notable Files
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

## UI System Maintenance Guidelines

### Working with the New UI System

#### Initialization (in game.js)
```javascript
// Initialize UI system
uiManager = new UIManager(canvas, ctx, CONFIG, socket);

// In game loop
uiManager.render(gameState, myPlayerId);
```

#### Adding New UI Elements
1. **Create Component Method** in `UIComponents.js`:
```javascript
drawCustomPanel(x, y, width, height, data) {
    this.drawFrostedGlassPanel(x, y, width, height);
    this.drawText(data.text, x + width/2, y + height/2, {
        type: 'ui_primary',
        align: 'center',
        baseline: 'middle'
    });
}
```

2. **Add State Management** in `UIState.js` (if needed):
```javascript
// Register interactive elements
this.registerInteractiveElement('customButton', bounds, 'button', callback);
```

3. **Integrate in UIManager** render methods:
```javascript
// In renderGameUI() or appropriate render method
this.uiComponents.drawCustomPanel(x, y, width, height, data);
```

#### Modifying UI Styling
1. **Edit YAML Configuration**: All styling in `spec/blueprint-battle.yaml`
2. **Use Design System**: Reference predefined typography styles and colors
3. **Build CSS**: Run `npm run build:css` to generate CSS variables
4. **Test Consistency**: Verify visual consistency across all UI states

### UI State Management
- **State Flow**: `login` → `connecting` → `game` → `death` → `game`
- **Transition Method**: `uiManager.uiState.transitionTo(newState, data)`
- **Current State**: `uiManager.getCurrentState()`
- **Interactive Elements**: Automatically managed by UIState

### Typography System Usage
```javascript
// Use predefined typography styles
this.drawText('Header Text', x, y, {
    type: 'panel_header',  // Uses title_font, bold, widest letter-spacing
    color: CONFIG.colors.ui_cyan
});

this.drawText('Body Text', x, y, {
    type: 'ui_primary',    // Uses primary_font, semibold, normal spacing
    color: CONFIG.colors.primary
});
```

### Color System Usage
- **Unified Colors**: Use `CONFIG.colors.ui_cyan` for all UI elements
- **Legacy Support**: Old color names still work (`CONFIG.colors.leaderboard_cyan`)
- **Semantic Colors**: `primary`, `accent_cyan`, `accent_error`, `ui_*`
- **Consistent Access**: Always use `CONFIG.colors.property` pattern

### Event Handling
- **Mouse Events**: Automatically handled by UIManager
- **Keyboard Events**: Managed by UIState for login/death screens
- **Interactive Elements**: Register with `registerInteractiveElement()`
- **Cleanup**: Automatic cleanup on state transitions

### Critical Rules
- **No Direct DOM**: All UI is Canvas-based through UIManager
- **State Machine**: Always use UIState for UI transitions
- **YAML Configuration**: All styling values come from YAML
- **Component Reuse**: Use UIComponents methods for consistency
- **Build Process**: Always run `npm run build:css` after YAML changes
- **Visual Parity**: Changes must maintain "Living Blueprint" aesthetic