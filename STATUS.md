# Status

## Current goal

Make the vertical slice feel like a landscape phone game.

## Current capability

Works in 3D with chase, cab and top-down docking cameras, a landscape-only layout, home-screen install, star rating and saved best scores. Target: smooth on a baseline phone.

## Current bottleneck

Real-device testing. The 3D view has only run on a software renderer in headless Chrome, so frame rate, fullscreen and audio on a real phone are unproven.

## Next smallest step

Play it on a physical phone in landscape. Check frame rate first, then tune steering and brake feel.

## Evidence

| Acceptance criterion | Evidence | Result |
| --- | --- | --- |
| Repository contract | `scripts/verify-repo.sh` | Pass |
| Simulation behavior | `node tests/sim.test.js` | Pass: 0–60 mph 21.1 s, 1.70 kWh/mi, route drivable with 0 collisions |
| Game script parses | `make check` | Pass |
| 3D view, cameras, result screen and saved best | Headless Chrome at 844×390, driven to a docked finish | Pass: about 13,000 triangles and 44 draw calls per frame |
| Portrait shows the rotate screen | Headless Chrome at 390×844 | Pass |
