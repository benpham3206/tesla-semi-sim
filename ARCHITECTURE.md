# Architecture

## System flow

```text
Touch or keyboard input → command {steer, throttle, brake, gear} → sim.js step
→ state → index.html Three.js scene and HUD, interpolated between fixed steps
```

Each `sim.js` step applies the longitudinal force model `m a = F_drive − F_brake − F_roll − F_air − m g sinθ`, battery use and regeneration, a kinematic tractor–trailer model with an off-axle hitch, collision handling, and mission logic.

## Components

- `sim.js` is pure and has no DOM access. It runs in Node and in the browser as a classic script, and exports through `module.exports` when available.
- `index.html` handles input, the Three.js scene and cameras, the HUD, audio, and the saved best scores. It builds the scene once from `Sim.WORLD`, so the world has one definition.
- `vendor/three.min.js` is Three.js 0.160.1, which still ships a classic-script build. It keeps the game free of a build step and a CDN.
- `manifest.webmanifest` and `icon.png` make the game installable to a phone home screen.
- `tests/sim.test.js` uses Node assert for calibration and behavior contracts.

## Invariant

Physics never reads the DOM or frame time.

## Upgrade path

Moving past Three.js 0.160 needs ES modules, which do not load from `file://`. Drop open-from-disk or add a bundler at that point.
