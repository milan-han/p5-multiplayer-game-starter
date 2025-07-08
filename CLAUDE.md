# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a p5.js multiplayer game starter template using Node.js, Express, and Socket.io. It creates a simple multiplayer environment where players appear as colored circles that can join and leave in real-time.

## Development Commands
- `npm start` - Start the development server with nodemon (watches for changes)
- `npm install` - Install dependencies
- `npm test` - Currently returns error "no test specified"

## Architecture
- **Server (`server/`)**: Node.js/Express server with Socket.io for real-time communication
  - `server.js`: Main server file, handles socket connections and game loop (16ms intervals)
  - `Player.js`: Server-side player model with random position and color generation
  - `config.js`: Server configuration
- **Client (`public/`)**: p5.js frontend with Socket.io client
  - `sketch.js`: Main p5.js game loop and socket event handling
  - `Player.js`: Client-side player rendering class
  - `index.html`: Main game page
  - `prototype.html`: Single-player demo showcasing game physics, UI, and world
  - `ui/LoginOverlay.js`: UI component for login functionality

## Key Technical Details
- Game state synced every 16ms via Socket.io "heartbeat" events
- Single global room - no lobbies or matchmaking
- Players auto-spawn at random positions with random colors
- Real-time join/leave functionality with automatic cleanup
- Uses plain Node `ws` under the hood (via Socket.io)

## Constraints
- **One global room only**. No lobbies or matchmaking.
- Keep to plain Node `ws`; do not add socket.io or databases.
- All commits must pass `npm test` and lint before they land.
- Bundle must remain <25 MB; Render free tier has 100 MB limit including node_modules.