# Responsiveness verification

Verified on 2026-10-14 against `fix/responsive-layout`, continuing PR #1 from `d9a26af`.

## Changes after the first repair commit

- Separate the clock and hero-selection heading on short screens. Character cards support Enter/Space, and name entry submits with Enter.
- Fit the compact landscape D-pad and actions side by side, preserve 44 px movement/action targets, separate stat labels, and keep desktop control labels visible.
- Adapt inventory grids and relic rows to narrow panels; wrap shop options and bound the completion dialog.
- Prevent focus/scrollIntoView from panning the map frame. Keep location notifications inside the map frame and below open panels.
- Track each captured D-pad pointer independently from keyboard keys. Release input on pointer cancellation/lost capture, blur, hidden document, resizing, pause and world-map opening. Ignore repeated menu shortcuts and gameplay shortcuts behind pause/map dialogs.
- Restore the existing camera clamp and current location immediately on load/restart, and dismiss dialogs for the previous location. Save/load Escape closes its dialog before the pause menu.

The original 400 × 300 logical viewport, 2048 × 1639 map, art assets, collision algorithms, camera limits and team credits are preserved. Earlier context-setter and final-wave gold fixes remain in place.

## Actual browser verification

The test launches local Chromium 140.0.7339.186 against Vite's production preview in the same process. It uses the actual application bundle and original art, spawn, collision and location images. It does not inspect the original Vercel deployment as evidence for this branch.

| Browser viewport | Painted gameplay viewport | Result | Evidence |
| --- | --- | --- | --- |
| 320 × 568 | 304.0 × 228.0 | Pass | [Screenshot](screenshots/320x568-game.png) |
| 390 × 844 | 374.0 × 280.5 | Pass | [Screenshot](screenshots/390x844-game.png) |
| 768 × 1024 | 752.0 × 564.0 | Pass | [Screenshot](screenshots/768x1024-game.png) |
| 844 × 390 | 408.0 × 306.0 | Pass | [Screenshot](screenshots/844x390-game.png) |
| 1366 × 768 | 912.0 × 684.0 | Pass | [Screenshot](screenshots/1366x768-game.png) |
| 768 × 390 | 418.7 × 314.0 | Pass | [Screenshot](screenshots/768x390-game.png) |
| 568 × 320 | 282.0 × 211.5 | Pass | [Screenshot](screenshots/568x320-game.png) |

Every size passed character selection/confirmation/details, viewport fitting, hidden-panel paint checks, HUD bounds and hit targets, independent inventory/stats toggles and scrolling, world-map bounds/marker alignment, and pause/save-load dialog bounds and reachable controls. Location, shop, lodge, conversation and quest panels also fit and scroll at all seven sizes.

Additional browser checks:

- All four characters, keyboard selection, phone guide/relic dialogs and name entry in a shortened viewport.
- Live resizing/orientation preserves logical player coordinates, camera and map-marker alignment.
- Native Chromium touch capture, dragging outside the button, release, cancellation and matching keyboard release; interrupted input stops on orientation change and pause/resume.
- Movement stops at actual black collision pixels. All four camera clamps survive orientation changes.
- Five Lakers City quest waves across orientation changes preserve the final wave's gold and award the Majapahit relic.
- Save/load retains earned character stats, relics, player position and a purchased Leather Cap. Loading at another location and restarting dismiss stale location dialogs and restore the camera.
- Zero uncaught page errors in the final run.

[Machine-readable browser report](browser-report.json)

Selected additional screenshots: [hero selection](screenshots/320x568-selection.png), [character details](screenshots/320x568-details.png), [name entry with a shorter viewport](screenshots/390x360-name-entry.png), [world map](screenshots/568x320-map.png), [save/load](screenshots/568x320-save-load.png), [quest](screenshots/320x568-quest.png).

## Automated component checks

`npm run test:components` passed selection/start, seven mocked container fixtures, concurrent panels, pointer cancellation/focus loss, independent pointer release/lost capture/resize cleanup, shortcut auto-repeat, five quest waves/rewards/gold, and map/pause/save/load. These are JSDOM checks with mocked dimensions and collision/location fixtures; they do not prove painted layouts or physical touch behavior.

`npm run build`, targeted ESLint `no-undef` checks for the changed JSX components, and `git diff --check` passed. The repository's general lint command has no ESLint configuration, so this is not a claim that full-repository lint passed.

## Reproduce

Use Node 18+ and install dependencies with `npm ci`.

```sh
npx playwright install --with-deps chromium
npm run test:components
npm run test:browser
```

`test:browser` builds the production bundle, starts its own local preview, launches Chromium, and writes screenshots plus `report.json` under ignored `test-results/responsive/`. No hosted deployment is required.

## Remaining limits

- Physical phones, Safari/iOS and Android browsers have not been tested. Chromium sends native browser touch events through emulation; that is not hardware touch verification.
- Name-entry scrolling was checked after shortening the viewport; a real software keyboard, browser chrome and device safe-area behavior remain device checks.
- Focus-loss cleanup was checked by delivering a blur event to Chromium, plus JSDOM focus-loss tests; physical app switching was not exercised.
- Boundary/quest tests load reproducible saved positions sampled from the real pixel maps through the game's load UI. They do not represent exhaustive traversal of every map route or every quest location.

This work updates the repair branch and draft PR only. No merge or hosted deployment was performed.
