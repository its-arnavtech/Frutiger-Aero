# Autumn-world validation

## Automated

`npm test` includes five autumn-specific cases in `tests/autumn.test.js`:

1. Sample 6,001 camera positions: constant speed within 3%, finite positions, exact reversal, continuous loop seam.
2. Check clearance above land/water, all lodge bounds and the bridge; confirm the route passes below the arch.
3. Check every tree against the whole flight, including the large island maple. The route maintains at least four metres outside the conservative canopy bounds.
4. Check that the look target never crosses the camera and that per-sample orientation changes and camera banking stay bounded.
5. Check the eight ordered destinations, all four quadrants around the central island, and the high valley overlook.

The shared startup and mobile-allocation regressions and the original-world tests remain in the suite.

`tests/autumn-realism.test.js` also checks the downhill mill supply, the submerged outlet, actual water mesh contact with the wheel, downstream UV direction, real window openings by raycasting, and the mountain mesh's height, normals and baked shading. `tests/autumn-tree.test.js` checks complete canopy bounds and prevents individual leaves or their reflections from sampling neighbouring atlas cells.

## Browser checks

Run the built preview, inspect the opening river, then visit each waypoint. Confirm that the bridge passes overhead, the lake orbit reveals different sides of the maple, and the overlook reveals the same village and river. Reverse the timeline to verify spatial continuity. Watch nearby foliage during travel for changes in geometry; only frustum culling and the mirror use optimization.

At 390 × 844 and 844 × 390, load with `?world=autumn&quality=mobile`. Confirm that loading reaches `ready`, the canvas resizes, all eight destinations are available, and Play/Pause, replay and timeline input work. These are responsive-budget checks, not physical iPhone 12 measurements.

Open the world picker using mouse and keyboard. Confirm Original, Autumn and Monsoon are usable links on the combined branch; the active world is indicated; Winter and Spring cannot be selected. Escape closes the dialog and restores focus. Switch worlds and check that title, icon, control colours and destinations belong to the selected world. A `quality=low` or `quality=mobile` setting must survive switching. The default and unknown-world URLs must open Original.

Run `npm run test:mobile`. The `fault=asset` case blocks the autumn maple texture; `fault=bundle`, `fault=no-webgl`, `fault=context-loading` and `fault=context-ready` exercise the same real production-bundle recovery flow as the original world. The loader must show recovery rather than remain indefinitely active. Clearing `fault` must permit a clean startup.

## Checked on 2026-10-15

- All 46 automated tests pass; the production build succeeds.
- Both Original and Autumn reach a live rendered scene when selected through the picker. The correct title, colours and eight destination buttons appear after navigation.
- Production Autumn reaches `ready` at 390 × 844 with a simulated 3× device pixel ratio and the mobile allocation budget. Resizing to 844 × 390 retains the renderer and the lake orbit responds to waypoint input.
- The portrait picker fits the viewport. Escape closes it and restores focus; future worlds have no links. Switching back to Original preserves `quality=mobile` and loads its city journey.
- A deliberately failed autumn leaf request produces a recoverable loading error. The recovery screen's world picker opens and a clean Autumn selection returns to `ready`.
- A reserved GLSL identifier in the new ground shader was found during browser validation and corrected. Shader failures now log compiler details while retaining the plain recovery message in the interface.

These checks used the desktop in-app Chromium browser. They do not establish iPhone 12 hardware performance or Safari compatibility on a physical device.

## Final visual pass on 2026-10-17

- All 46 tests and the production build pass after refining the maple canopy, island shoreline and mountain material.
- Autumn reaches `ready` with no console errors. The Mirror lake view shows the updated maple, shoreline stones and sedges, distant ridges and live water reflections.
- The larger maple's explicit canopy radius is included in camera-clearance tests and frustum bounds. Tree geometry remains unchanged throughout the camera path.

## Development checks on 2026-10-20

- All 58 Node tests pass. These build and inspect geometry on the CPU; they do not construct a WebGL renderer or start a preview server.
- The production bundle builds. Autumn now imports the small shared foliage helpers independently; the original city's roughly 4 MB vegetation dependency stays in its own lazy-loaded scene bundle.
- New scenery includes individual maple leaves, modeled snowy mountain ridges, recessed house windows, roof shingles and a connected working millrace. The water surface no longer samples the gravel texture and instead reveals the actual smooth bed.
- Earlier desktop inspection on October 18 covered the village, lake and mountain material. The subsequent mountain shading, waterfall flow-direction fix and shared-helper extraction have **not** received a fresh browser check.
- At the user's request, no preview server, browser rendering, screenshot pass or mobile fixture was run for this final development pass. Visual review and physical iPhone 12/Safari validation remain pending.
- Before merging to main, inspect the wheel at roughly 16.5% of the journey, the Mirror lake mountain, all sanctuary windows and the overhead shallows. Check the water texture runs downhill, foliage remains stable during forward/reverse travel, and the mountain's shaded gullies preserve detail.
