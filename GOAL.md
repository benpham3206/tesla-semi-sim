# Goal

## Objective

Build a landscape 3D phone game, played in the browser, of a Tesla Semi delivery. Couple a trailer, drive a short route with a 4% climb, manage speed and battery, then back the trailer into a loading dock.

## Success conditions

- `index.html` opens directly from disk or a static host with no build step. The only dependency is Three.js, vendored as one file.
- The sim is playable by touch in landscape; portrait asks the player to rotate the phone. It can be added to the home screen and then launches fullscreen. The left thumb steers, the right controls acceleration and braking, D/R selects a gear, and reverse switches to a top-down docking view. Keyboard controls work on desktop.
- Physics uses a fixed 60 Hz timestep independent of frame rate.
- `tests/sim.test.js` checks 0–60 mph in 17–24 seconds at 82,000 lb GCW and about 1.4–2.0 kWh/mi at 55 mph on flat ground at full load. Tesla publishes about 20 seconds and under 2 kWh/mi, respectively.
- A heavier load stops in a longer distance, the trailer cuts inside the tractor in a turn, and climbing costs more power.

## Inputs

Touch and keyboard controls.

## Outputs

A rendered simulation and a mission result with time, energy use, kWh/mi, collisions, cargo condition, score, a star rating, and the best score per load saved on the device.

## Constraints

The simulation must fit mobile GPU and CPU budgets. Tesla does not publish a full vehicle model, so unknown parameters are explicit estimates in `sim.js` `PARAMS`.

## Non-goals

Traffic, a large open map, accounts, multiplayer, and app-store packaging.
