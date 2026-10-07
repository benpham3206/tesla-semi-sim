# Goal

## Objective

Build a phone-playable browser sim of a Tesla Semi delivery. Couple a trailer, drive a short route with a 4% climb, manage speed and battery, then back the trailer into a loading dock.

## Success conditions

- `index.html` opens directly from disk or a static host with no build step or dependencies.
- The sim is playable by touch in landscape and portrait. The left thumb steers, the right controls acceleration and braking, D/R selects a gear, and the camera toggle includes a rear docking view. Keyboard controls work on desktop.
- Physics uses a fixed 60 Hz timestep independent of frame rate.
- `tests/sim.test.js` checks 0–60 mph in 17–24 seconds at 82,000 lb GCW and about 1.4–2.0 kWh/mi at 55 mph on flat ground at full load. Tesla publishes about 20 seconds and under 2 kWh/mi, respectively.
- A heavier load stops in a longer distance, the trailer cuts inside the tractor in a turn, and climbing costs more power.

## Inputs

Touch and keyboard controls.

## Outputs

A rendered simulation and a mission result with time, energy use, kWh/mi, collisions, cargo condition, and score.

## Constraints

The simulation must fit mobile GPU and CPU budgets. Tesla does not publish a full vehicle model, so unknown parameters are explicit estimates in `sim.js` `PARAMS`.

## Non-goals

3D rendering, a large open map, accounts, saving, multiplayer, and app-store packaging.
