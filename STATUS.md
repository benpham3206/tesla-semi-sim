# Status

## Current goal

Add production-inspired cab details and electric driving sounds without changing the calibrated simulation.

## Current capability

Shifts start in the cab with a centered three-spoke wheel and two live screens. Motor and road sounds follow battery power, speed, and surface. Lifting off the accelerator changes the sound and shows **REGEN**. Reverse still uses the top-down view. The route, physics, scoring, and saved scores are unchanged.

## Current bottleneck

Chrome passed the touch and sound checks. Audio on phone speakers, frame rate, and fullscreen behavior still need a real-device test.

## Next smallest step

Play in landscape on an iPhone or iPad, then on a Galaxy S24. Listen under load and on lift-off. Switch apps and return to check audio recovery.

## Current work

- Sound update branch: `feat/cab-sound`.
- The earlier session is linked from merged PR #1. Current `main` already includes the 3D phone-game improvements.
- Ben approved an inside-POV-first pass. Exterior and environment changes are deferred.
- Ben wants touch play to feel good on his iPhone and iPad, then on his brother's Samsung S24. Real-device checks remain required; viewport checks are not hardware evidence.
- Implemented in `index.html`: DOM/SVG cockpit over the existing Three.js camera. Camera-derived visibility avoids a second view state. No new runtime dependency or network resource.
- Pstack's worker owned `index.html`; the lead owned tests and reviewed the diff and real screenshots. A second visual pass replaced the vignette, enlarged the screens and wheel, and fixed navigation text clipping.
- One reset path releases controls on blur, backgrounding, rotation, and restart.
- Independent review found blocked driving keys after button focus and second-finger control takeover. Both received small fixes and browser regression checks.
- `tests/cockpit.test.js` uses Node 22 WebSocket and installed Chrome. It checks offline loading, camera modes, driving, multi-touch ownership, screen/control separation, and portrait pause/input release.
- Public build: https://tesla-semi-sim.vercel.app. It serves the original cockpit without a login.
- [PR #3](https://github.com/benpham3206/tesla-semi-sim/pull/3) merged the original cockpit. The sound update is on a separate branch.
- Vercel project `benpham3206s-projects/tesla-semi-sim` is connected to this GitHub repository. CLI 65.12.1 reported production deployment `dpl_2FQcshTtmAg3nhhhVSs5qkaC7evh` as READY and assigned the public alias. GitHub's Vercel and CI checks passed.
- `vercel.json` uses the existing build-hook pattern to copy only game assets into `dist/`.
- Ponytail review combined duplicate Cab pedal sizing. Generated Graphify research output was moved to recoverable Trash, not included in the deliverable.

## References

- [Cab walkthrough](https://www.youtube.com/shorts/eD2yZEHlzJ4): light trim, a ribbed dash, and a centered three-spoke wheel.
- Loaded drive: [drive-off at 4:56](https://www.youtube.com/watch?v=uVvUGgvKt7Q&t=296s), [hill at 9:50](https://www.youtube.com/watch?v=uVvUGgvKt7Q&t=590s), [acceleration at 14:34](https://www.youtube.com/watch?v=uVvUGgvKt7Q&t=874s), and [interior at 40:27](https://www.youtube.com/watch?v=uVvUGgvKt7Q&t=2427s). The driver reported immediate lift-off regen and no shift on the climb. The game synthesizes these cues; it does not distribute the footage or recordings.
- [2026 cab and exterior report](https://www.notateslaapp.com/news/3762/first-look-inside-the-new-tesla-semi-10-cameras-2-screens-and-more). The page and exterior photo returned HTTP 200.
- [Dual-screen interface](https://www.notateslaapp.com/news/4169/tesla-semis-dual-screen-user-interface-how-it-differs). The page and screen photo returned HTTP 200. The screen photo was viewed.
- [April 2026 Canadian unveiling gallery](https://www.evchargerreviews.net/tesla-semi-up-close-canadian-unveil-event/). The page and `tesla-semi-inside-1200x900.jpg` returned HTTP 200. The interior photo was viewed and informed the centered wheel and two-screen arrangement.
- Research files are in `/tmp/tesla-semi-refs-b6g7xvcj/`. They are reference material, not redistributed application assets.
- Modern Web Guidance was retrieved with pinned `modern-web-guidance@0.0.204`. Guides `form-factor-adaptation` and `css` are saved at `/var/folders/nh/b2jx7mgs5139ff0r11688h680000gn/T/mwg-guide-70882-1794803607685.md`.

## Evidence

| Acceptance criterion | Evidence | Result |
| --- | --- | --- |
| Repository contract | `scripts/verify-repo.sh` | Pass |
| Simulation behavior | `node tests/sim.test.js` | Pass: 0–60 mph 21.1 s, 1.70 kWh/mi, route drivable with 0 collisions |
| Game script parses | `make check` | Pass |
| Cab, wheel, driving, reverse and camera cycle | `node tests/cockpit.test.js` | Pass after final input fixes |
| Sound starts on tap, mutes, and recovers | `node tests/cockpit.test.js` | Pass: audio signal returns after simulated backgrounding and suspension in Chrome |
| Two-thumb input, screen/control separation and text fit | Same browser check at 667×375, 780×360, 844×390, 915×412, 1024×768, 1180×820, 1440×900 | Pass |
| Portrait pause and held-input release | Same browser check at 390×844 | Pass |
| Visual review | Actual 844×390 and 1180×820 screenshots after the second pass | Reviewed by lead; no real-device claim |
| Focused-button driving keys and same-pad finger ownership | Added browser regressions | Pass |
| Real iPhone, iPad and Samsung S24 | Owner test | Not yet checked |
| Hosted original cockpit and touch behavior | Browser smoke test from PR #3 | Passed before the sound update |
| Original public assets and publication boundary | Unauthenticated HTTPS reads, SHA-256 comparisons, and denied-path checks | All five game assets matched the original build; root returned 200; project files returned 404 |
| Deployment package | `make build` and Vercel CLI dry run | Five public assets; seven required upload files; no dependency install |

## Test handoff

- Local checks: `make verify check test build`, `node tests/cockpit.test.js`, and `git diff --check` passed.
- `tests/cab-regen-844.png` shows lift-off regen in the updated cab. `tests/cockpit-844.png` shows the original cab.
- Open the Vercel preview in [PR #4](https://github.com/benpham3206/tesla-semi-sim/pull/4). It requires Vercel sign-in. Turn the device to landscape and tap **Start shift**.
- The old loopback preview and temporary Wi-Fi server were stopped after the hosted build passed. Do not use the old local test links.
- Source changes, browser checks, screenshots, and reference images are retained. Temporary browser profiles were created and removed by the test. No pre-existing file was removed.
