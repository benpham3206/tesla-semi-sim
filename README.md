# Tesla Semi Sim

Tesla Semi Sim is a landscape 3D phone game, played in the browser, where you couple a trailer, drive a short route, manage speed and battery, and reverse into a loading dock.

## Run

Open `index.html` directly, or run `python3 -m http.server` and browse to `http://localhost:8000`.

On a phone, hold it in landscape. Use Share → Add to Home Screen to launch it fullscreen with its own icon.

New shifts start in the Cab view. The centered wheel follows steering. The left screen shows live instruments; the right shows the route. Reverse switches to the top-down docking view.

## Host on Vercel

The Vercel project is `tesla-semi-sim`. `vercel.json` runs `scripts/project/build` and serves `dist/`. The build copies only the game assets, so project instructions and tests are not public web files. No package install or framework is required. Run `make build` to check the package locally.

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

For the cockpit and touch checks, run `node tests/cockpit.test.js` with Node 22 or newer and Chrome installed. Set `CHROME_BIN` if Chrome is in a custom location. Pass a site URL as the first argument to check a hosted build instead. The check opens an isolated headless browser and saves screenshots in a temporary folder. It checks phone and tablet layouts, not real-device frame rate or touch feel.

Read `GOAL.md`, `ARCHITECTURE.md`, `STATUS.md`, and `AGENTS.md` for project context and working rules.
