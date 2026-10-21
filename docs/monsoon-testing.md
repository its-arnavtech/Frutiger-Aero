# Monsoon validation

## Automated

`tests/monsoon.test.js` samples 6,001 positions around the entire camera route. It verifies constant speed, reverse travel, the closed loop, ground/water clearance, stable look direction, bounded camera bank and all eight destinations. A terrain regression checks that the high mountain is confined to the far shore, the side hills remain below 50 metres, and the wide lake stays open. The original, autumn, shared scrolling, startup failure, shader and phone allocation tests remain included.

## Browser cases

1. Open `/?world=monsoon`. Loading must reach `ready` and show a live lake. Check subtle rain, clear stones in the shallows, one reflected mountain ahead, low side hills and distinct clouds against blue sky. No people or human silhouettes may appear anywhere.
2. Visit all eight destinations in forward and reverse order. Confirm that the mountain, waterfalls and rocky shores remain the same spatial world and the view stays aimed toward the far-shore mountain. Check the waterfall view and elevated lake overview for terrain intersections.
3. Play, pause, reverse-scroll and scrub the timeline. Rain continues when travel pauses; reduced-motion mode freezes ambient animation and removes easing/parallax.
4. Open the picker by keyboard and pointer. Original, Autumn and Monsoon must be selectable; only Winter and Spring remain unavailable. Escape returns focus to the opener.
5. At 390 × 844 and 844 × 390, load `/?world=monsoon&quality=mobile`, seek The summit and resize. Loading must reach `ready`; the canvas and picker must fit. The phone budget must survive switching worlds.
6. Run the production fixture (`npm run test:mobile`; `PORT` can override its port). Load `/?world=monsoon&quality=mobile&fault=asset`. A failed rock texture must open recovery. Choose another world or remove the fault and retry; the next clean page must load.
7. Repeat `fault=no-webgl`, `fault=context-loading` and `fault=context-ready` as needed for graphics recovery. These faults exist only in the local fixture, never the production site.

## GPU preference

Every world requests WebGL's high-performance adapter. The operating system and browser choose the actual device. Monsoon exposes the reported driver in `#world[data-gpu]` for inspection; this is diagnostic only and is not sent anywhere.

On the development machine, Chrome was configured for the power-saving GPU. The Windows per-app preference for Chrome, Edge, Edge WebView and Codex was changed to high performance. Previous values were saved in the ignored `artifacts/gpu-preferences-before-monsoon.json`. The running Codex browser still reported Intel graphics immediately afterward: an app restart is required to apply the preference to its existing GPU process. CPU tasks and remote image generation cannot be transferred to the laptop GPU through a WebGL setting.

Desktop phone-size checks are not physical iPhone 12 / Safari measurements.

## Checked on 2026-10-21

### Realism revision

- All 67 automated tests pass and the production build succeeds. New checks cover the Matterhorn elevation range, asymmetric terrain, finite spruce/willow meshes, bounded deposit and plant counts, grounded planting and clearance from every spruce crown.
- The opening and close cascade views were inspected for scanned cliff detail, vegetation coverage, needle colour, terrain intersections and shoreline deposits. The scene reports no console errors. The existing FXAA shader may emit driver warnings about derivatives; it compiles and renders.
- The production bundle reaches `ready` at 390 × 844 with the mobile budget and simulated 3× density. A deliberately failed `rock_face_diff_2k.jpg` request opens retry, lighter-rendering and world-selection controls. A clean landscape reload is checked separately. These checks use desktop emulation, not a physical phone.

### Earlier mountain detail

- All 64 automated tests pass and the production build succeeds. The new actual-mesh regression covers upward unit normals, bounded desktop/phone/recovery geometry, interpolated triangle heights, underwater basin depth and camera clearance at all three quality settings.
- The opening lake and close cascade destination were inspected in the browser. The eroded mountain, meadow transitions, summit snow and reflection render without shader or console errors.
- The actual production bundle reaches `ready` at 390 × 844 with the mobile budget and simulated 3× pixel density. The world picker exposes Original, Autumn and Monsoon while retaining the mobile setting. This is desktop browser emulation, not physical-device GPU validation.

## Checked on 2026-10-18

- All 52 automated tests pass; the production build succeeds. The new layout test prevents enclosing side mountains. The camera clears the expanded terrain throughout its continuous, reversible route.
- The live opening view shows an open lake, one far-shore massif, low side hills, and photographic clouds against blue sky. The close cascade view was inspected for terrain intersections and repetitive stone detail; the rock shader now combines warped textures at two scales.
- The production bundle reaches `ready` at 390 × 844 with the mobile budget and simulated 3× pixel density. Rotation to 844 × 390 preserves the renderer, and seeking moves the camera toward the summit destination. No horizontal page overflow appears.
- A deliberately failed rock request exits loading with retry, lighter-rendering and world-selection controls. The picker offers clean links that preserve the mobile budget and remove the injected fault.
- This verifies startup and layout in a desktop browser, not physical iPhone frame rate or Safari GPU memory behavior.

## Checked on 2026-10-17

- All 50 automated tests pass and the production build succeeds. A sharp look-target turn near the snowline was caught by the route test and corrected.
- The live desktop scene reaches `ready` without shader or console errors. Opening shore, close waterfall and high lake views were inspected. The camera passes through the same continuous terrain, with no people or human silhouettes.
- The actual production bundle reaches `ready` at 390 × 844 with the mobile budget and simulated 3× display density. Rotation to 844 × 390 preserves the renderer; seeking the snowline reaches the expected camera position.
- The three-world picker fits the portrait viewport. Original, Autumn and Monsoon links preserve `quality=mobile`; Winter and Spring are unavailable. Escape closes the picker.
- A deliberately failed rock request exits loading with retry, lighter-rendering and world-selection controls. Selecting the clean Monsoon link removes the fault and returns to `ready`.
- Windows high-performance preferences were read back successfully. The current browser context still reports Intel, so RTX activation requires restarting the relevant app.
