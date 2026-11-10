# Tesla Semi Sim

Tesla Semi Sim is a landscape 3D phone game, played in the browser, where you couple a trailer, drive a short route, manage speed and battery, and reverse into a loading dock.

## Run

Open `index.html` directly, or run `python3 -m http.server` and browse to `http://localhost:8000`.

On a phone, hold it in landscape. Use Share → Add to Home Screen to launch it fullscreen with its own icon.

## Controls

| Input | Action |
| --- | --- |
| Touch | Steer with the left pad; press BRAKE and GO with the right thumb; tap D/R to change gear, CAM for camera, SND for sound. |
| Left/right arrows or A/D | Steer. |
| Up arrow or W | Accelerate. |
| Down arrow or S | Brake. |
| R | Toggle between drive and reverse. |
| C | Cycle the Chase, Cab and Top cameras. Reverse always uses the top-down docking view. |
| M | Toggle sound. |

## Verify

Run `make verify && make test`.

Read `GOAL.md`, `ARCHITECTURE.md`, `STATUS.md`, and `AGENTS.md` for project context and working rules.
