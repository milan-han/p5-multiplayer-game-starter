
====================================================================
1. Key inconsistencies between prototype & multiplayer code
--------------------------------------------------------------------
A. Physics / movement  
1. Server heading math is rotated 90 °  
   • `ServerTank.tryMove()` and `ServerBullet` use  
     `dx = sin(heading)` / `dy = -cos(heading)`  
     ⇒ pressing “forward” when facing North actually moves/shoots West.  
   • Prototype (and camera on client) use the correct Cartesian formula  
     `dx =  cos(heading)` / `dy =  sin(heading)`.

2. Position interpolation constant diverges  
   • `blueprint-battle.yaml` – `player.position_interp: 0.8` (changed per Task-List)  
   • `public/game.js` – hard-coded `position_interp: 0.2`  
     ⇒ tanks drift sluggishly on the client compared with the server.

3. Normal move-cool-down lives only in code  
   • Prototype steps once per key-press; Task-List requested 100 ms delay.  
   • `ServerTank` still hard-codes `100` ms; the value is **not** in the YAML, so tuning it will desync server & clients.

B. Config duplication & drift  
   • Server loads `blueprint-battle.yaml` on start-up.  
   • Client ships a *separate* literal `CONFIG{…}` block in `public/game.js`, `ClientTank.js`, etc.  
     Any future balancing tweak in YAML will not reach the browser → silent divergence.

C. Bullet & shield orientation  
   • Because heading math is off, bullet trajectories and shield arcs disagree with the prototype’s behaviour (front shield should block bullets coming from ±75°, but multiplayer build currently blocks the wrong sector).

D. Minor gaps  
   • Client-side prediction (Phase 2) not yet present – local tank still waits on server echo.  
   • Prototype’s smooth shield fade (`shield_alpha_rate`) works on client but server never tells “fade-out when Speed-Mode is held”, causing visual pops when latency spikes.  
   • Prototype’s camera shake is tied to shots; multiplayer sends shake on *fire*, not on *hit*.

====================================================================
2. High-impact fixes that keep multiplayer intact
--------------------------------------------------------------------
(ordered by payoff vs. risk)

1. Centralise gameplay constants – “single source of truth”  
   a. On server start, convert `blueprint-battle.yaml` → JSON and expose at  
      `GET /config` or inject into the first `gameState` packet.  
   b. Replace every hard-coded `CONFIG = { … }` in client files with a run-time
      fetch of that JSON.  
      _Result_: one knob tunes both sides; no more silent desync.

2. Correct the heading / coordinate calculus  
   • In `ServerTank.tryMove()`  
     ```js
     const dx =  Math.cos(headingRad);   // <- was sin
     const dy =  Math.sin(headingRad);   // <- was -cos
     ```  
   • In `ServerBullet` initial velocity  
     ```js
     this.vx = Math.cos(headingRad) * speed;
     this.vy = Math.sin(headingRad) * speed;
     ```  
   • Same substitutions for any place that mirrors the old formula  
     (e.g. collision helpers).  
   _Result_: tank moves & bullets fly in the intended direction; shield arc now faces forward.

3. Bring client interpolation in line with spec  
   • Delete the magic `0.2` and rely on `config.player.position_interp`.  
   • While you’re there, honour `player.heading_interp` the same way.  
   _Result_: snappier motion exactly matching server cadence.

4. Move-cool-down into YAML  
   • Add `move_cooldown_normal_ms: 100` under `player:` in YAML.  
   • Update `ServerTank` to read it; expose value to client for UI prediction.  
   _Result_: future balance tweaks (e.g. 80 ms) require editing one file.

5. Client-side prediction without breaking authority  
   (Phase 2 of Task-List)  
   • On key-press, the client immediately moves the *local* tank visually, storing a pending-input queue.  
   • When the authoritative `gameState` arrives, reconcile & correct drift, but *only* for my tank.  
   _No network protocol change needed – just local buffering._

6. Shield fade synchronisation  
   • Include `shield` flag & `speedMode` in tank state packets (already sent) plus **optional** `shieldAlpha` if you want the server to drive the exact value.  
   • Or keep fade purely client-side but compute from authoritative `speedMode`.  
   _Result_: smooth visual parity even under jitter.

7. Quality-of-life: serve YAML timestamp in `gameState`  
   Helps the client verify it’s using the same rule-set (handy during dev).

====================================================================
3. How blueprint-battle.yaml fits the plan
--------------------------------------------------------------------
• It remains the *canonical* rule-set; both processes only ever read from it or its JSON derivative.  
• Add any new tunables there (normal move delay, max reflections, camera shake decay, etc.).  
• Version or timestamp the file so clients can auto-reload if the server hot-swaps values.

====================================================================
4. Next steps checklist
--------------------------------------------------------------------
1. Export YAML to JSON on server boot (e.g. `const clientConfig = yaml.load(...); app.get('/config', …)`).  
2. Refactor client initialisation (`public/game.js:init`) to `await fetch('/config')`.  
3. Replace incorrect trig in `ServerTank` & `ServerBullet`; run quick smoke test.  
4. Remove duplicated constant block from client; pipe everything through fetched config.  
5. Add `move_cooldown_normal_ms` to YAML and wire in.  
6. Implement lightweight client-side prediction & reconciliation (Phase 2).  
7. Regression-test: verify forward key while facing all four cardinal directions, and confirm shields block correctly.

Applying the above will bring multiplayer behaviour back in line with the polished single-player prototype while preserving server authority and keeping the tuning workflow simple and safe.