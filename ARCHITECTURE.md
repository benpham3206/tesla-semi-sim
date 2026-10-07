# Architecture

## System flow

```text
Touch or keyboard input → command {steer, throttle, brake, gear} → sim.js step
→ state → index.html canvas renderer and HUD, interpolated between fixed steps
```

Each `sim.js` step applies the longitudinal force model `m a = F_drive − F_brake − F_roll − F_air − m g sinθ`, battery use and regeneration, a kinematic tractor–trailer model with an off-axle hitch, collision handling, and mission logic.

## Components

- `sim.js` is pure and has no DOM access. It runs in Node and in the browser as a classic script, and exports through `module.exports` when available.
- `index.html` handles input, canvas rendering, the HUD, and audio.
- `tests/sim.test.js` uses Node assert for calibration and behavior contracts.

## Invariant

Physics never reads the DOM or frame time.

## Upgrade path

A Three.js renderer can replace the canvas renderer without changing `sim.js`.
