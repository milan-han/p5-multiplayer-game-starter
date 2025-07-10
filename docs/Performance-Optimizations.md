# 🚀 Performance Optimizations Guide

## Overview

This document outlines the performance optimizations implemented to reduce server compute and power usage while maintaining gameplay quality.

## 📊 Performance Impact Summary

**Expected Resource Reduction:**
- **Server CPU**: 40-60% reduction
- **Network bandwidth**: 50-65% reduction  
- **Client CPU**: 30-40% reduction
- **Memory usage**: 20-30% reduction

## ⚙️ Server Optimizations

### 1. Reduced Server FPS
- **Before**: 60 FPS
- **After**: 30 FPS (Railway), 60 FPS (local dev)
- **Impact**: 50% reduction in server compute cycles

### 2. Network Broadcast Frequency
- **Before**: 60 broadcasts/second
- **After**: 20 broadcasts/second (Railway)
- **Impact**: 65% reduction in network traffic

### 3. Bot AI Optimization
- **Before**: Bot AI updates at 60 Hz
- **After**: Bot AI updates at 15 Hz (Railway)
- **Max Bots**: Reduced from 6 to 2-3 bots
- **Impact**: 75% reduction in AI computation

### 4. Simplified Bot Behavior
- Reduced pathfinding complexity (200 nodes max, was 500)
- Longer reaction times (200-400ms vs 150-300ms)
- Less accurate aiming (70% vs 80% accuracy)
- Simplified movement patterns
- Reduced vision range (6 tiles vs 8 tiles)

## 🎨 Client Optimizations

### 1. Reduced Client FPS Target
- **Before**: 60 FPS target
- **After**: 30 FPS target
- **Impact**: 50% reduction in client rendering

### 2. Animation Optimizations
- Larger interpolation buffer delays (50ms vs 33ms)
- Fewer animation states (8 snapshots vs 12)
- Faster animation transitions
- Reduced visual effects complexity

### 3. Rendering Optimizations
- Faster alpha fading (fewer animation frames)
- Simplified easing calculations
- Reduced glow and pulse effects
- Faster camera movement

## 🌐 Railway Configuration

The Railway deployment is configured with optimized environment variables:

```json
{
  "SERVER_TARGET_FPS": "30",
  "SERVER_PERFORMANCE_WARNING_THRESHOLD": "25", 
  "NETWORK_BROADCAST_HZ": "20",
  "BOT_AI_UPDATE_HZ": "15",
  "MAX_PLAYERS": "6",
  "MAX_BOTS": "2"
}
```

## 📈 Performance Monitoring

The server logs performance optimizations on startup:
```
⚡ Performance optimizations enabled:
   - Game loop: 30Hz
   - Network broadcasts: 20Hz  
   - Bot AI updates: 15Hz
   - Max bots: 2
```

Monitor for performance warnings:
```
⚠️  Server FPS: 18/30 (performance warning)
```

## 🔧 Configuration Files

### 1. `railway.json`
- Server FPS: 30Hz
- Network broadcasts: 20Hz  
- Bot AI updates: 15Hz
- Max players: 6
- Max bots: 2

### 2. `spec/blueprint-battle.yaml`
- Reduced bot complexity
- Optimized animation settings
- Performance-focused timing
- Simplified AI behavior

## 🎯 Recommended Settings by Environment

### Production (Railway)
```
SERVER_TARGET_FPS=30
NETWORK_BROADCAST_HZ=20
BOT_AI_UPDATE_HZ=15
MAX_BOTS=2
```

### Development (Local)
```
SERVER_TARGET_FPS=60
NETWORK_BROADCAST_HZ=40
BOT_AI_UPDATE_HZ=30  
MAX_BOTS=4
```

### High-Performance (Dedicated Server)
```
SERVER_TARGET_FPS=60
NETWORK_BROADCAST_HZ=60
BOT_AI_UPDATE_HZ=60
MAX_BOTS=6
```

## 🚦 Performance Troubleshooting

### If Server FPS Drops Below Target:
1. Reduce `BOT_AI_UPDATE_HZ` further (to 10Hz)
2. Reduce `MAX_BOTS` (to 1)
3. Reduce `NETWORK_BROADCAST_HZ` (to 15Hz)
4. Consider reducing `SERVER_TARGET_FPS` (to 20Hz)

### If Client Performance Issues:
1. Reduce `target_client_fps` in YAML (to 20)
2. Set `animation_quality: 'low'` in YAML
3. Increase animation transition speeds
4. Reduce interpolation buffer size further

### If Network Issues:
1. Reduce `NETWORK_BROADCAST_HZ` (to 15Hz)
2. Implement delta compression (TODO)
3. Reduce `MAX_PLAYERS` (to 4)

## 🔮 Future Optimizations (TODO)

1. **Delta Compression**: Only send changed game state data
2. **Object Pooling**: Reuse bullet/tank objects to reduce GC
3. **Spatial Optimization**: Only update/broadcast visible entities
4. **Client Prediction**: Reduce server load with client-side prediction
5. **WebSocket Compression**: Enable WebSocket compression
6. **Batch Processing**: Process multiple updates in batches

## 📏 Measuring Success

### Key Metrics to Monitor:
- Server FPS consistency
- Network bandwidth usage  
- Client rendering performance
- User-reported lag/stuttering
- Railway CPU/memory usage

### Target Performance:
- **Server**: Consistent 30 FPS on Railway
- **Network**: <100 KB/s per player
- **Client**: Smooth 30 FPS on average devices
- **Latency**: <150ms server response time

---

**Note**: These optimizations prioritize performance over visual fidelity. Adjust settings based on your specific hardware constraints and player experience requirements. 