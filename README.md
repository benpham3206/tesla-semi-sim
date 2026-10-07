# Tesla Semi Sim

Tesla Semi Sim is a phone-playable browser delivery simulation where you couple a trailer, drive a short route, manage speed and battery, and reverse into a loading dock.

## Run

Open `index.html` directly, or run `python3 -m http.server` and browse to `http://localhost:8000`.

## Controls

| Input | Action |
| --- | --- |
| Touch | Steer with the left thumb; accelerate and brake with the right thumb. |
| Left/right arrows or A/D | Steer. |
| Up arrow or W | Accelerate. |
| Down arrow or S | Brake. |
| R | Toggle between drive and reverse. |
| C | Cycle camera, including the rear docking view. |

## Verify

Run `make verify && make test`.

Read `GOAL.md`, `ARCHITECTURE.md`, `STATUS.md`, and `AGENTS.md` for project context and working rules.
