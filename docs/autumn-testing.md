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

## Stream and shoreline pass on 2026-10-20

- After the user authorized running the app again, the development preview was started on localhost:3000. Desktop inspection covered the mill at 16.5% and the mountain/lake approach at 22%, including reverse seeking.
- The former waterfall was almost edge-on along the wheel axle. A second physical surface now exposes the stream over the outer paddles. Irregular animated highlights continue through the carved tailrace; they fade into the river. The rectangular retaining walls were replaced with irregular bank stones.
- Terrain sampling is locally refined to 0.4 metres around the mill. Regression rays check the actual ground triangles along the outlet, not only the mathematical terrain function. Tests also check projected waterfall width from the village camera, downstream water clearance, seven distinct rock silhouettes and small curved grass blades.
- Stones use several fixed fractured shapes, smaller chips, triplanar scanned mineral detail, surface relief, moss and wet bases. Frustum compaction includes reflected stones. Small chips use simpler permanent geometry, without camera-distance transitions.
- Leaves are smaller, with species-weighted colours, uneven boughs, greater sheltered-crown shading and leaf relief. The ground has irregular leaf-litter patches and curved meadow tufts. Summit shapes no longer repeat six radial ribs; snow edges and mineral colour are less uniform.
- All **60 automated tests pass** and the production bundle builds. No browser console errors were recorded. The existing large-chunk build warning remains for shared/original-world dependencies.
- At **390 × 844**, Autumn reached `ready` with the mobile rendering profile, and the timeline and ancient-maple waypoint responded. This is desktop Chromium with a phone-sized viewport, not physical iPhone 12/Safari validation.
- The desktop mill view reported about 20 FPS on this local browser at its adaptive 0.75 resolution floor; the portrait mobile-budget view reported about 57 FPS at 1.0. These are observations from this machine, not a performance guarantee. This pass does not establish photorealism or consistent 60 FPS across devices.
- Screenshot: `artifacts/autumn-polish/mill-stream.png` (local, ignored by Git). Main remains pending the user's visual review.

## Local loading recovery on 2026-10-20

- The failing Chrome session reported that `/src/autumn/layout.js` did not export `millRace`, alongside a failed Vite hot-reload connection. The server's current file contained the export: Chrome was using mismatched development modules. Reaching `ready` alone was insufficient; an initial recovery still displayed the older forest and shoreline.
- Development responses now use `Cache-Control: no-store`. For local review, `npm run start:local` builds first and serves the complete production bundle on port 3000. Its hashed asset URLs avoid mixing independently updated source modules. Editing a preview requires rebuilding and restarting it.
- Import and export failures now recommend reloading the latest files instead of blaming the connection. A regression test covers the exact missing-export error without exposing internal source paths in the recovery screen.
- All **61 tests pass** and the production build succeeds. A fresh Chrome session at `http://localhost:3000/?world=autumn` loaded `/assets/index-jOdskY1W.js`, reached `ready`, and reported the current 1,065 trees. No console warnings or errors were recorded. At 16.5%, the wheel spill and stream into the river, updated stones and smaller foliage were visible.
- Screenshot: `artifacts/autumn-polish/chrome-loading-fixed.png` (local, ignored by Git). This verifies local desktop loading and the current scenery; it does not establish physical iPhone/Safari compatibility or smooth rendering on this GPU. Main and production remain pending the user's validation.

## Rock, leaf and alpine detail — 2026-10-21

- All **62 automated tests pass**. The affected mountain/stone tests were rerun after the final ridge adjustments and pass. The production build succeeds, retaining the existing dependency chunk-size warning.
- Added regression coverage for physical leaf folds, unit normals, the ordinary crown's triangle budget and six-vertex atlas boundaries in the river reflection. Mountain checks now require both exposed ridges and concave gullies with finite snow-placement data. Camera clearance, continuous/reversible travel and mobile allocation tests continue to pass.
- Chrome loaded the final production entry `/assets/index-DsPO2Csa.js` on localhost:3000 and reached `ready`. Visual review covered the mill/nearby stones at 16.5%, the mountain at 22%, and the ancient maple waypoint, including backward seeking. The material shaders compiled without errors.
- The same build reached `ready` with `quality=mobile`. This checks the lighter rendering path in desktop Chrome, not a physical phone. The driver logged warnings in Three.js's FXAA shader; no startup or material shader errors occurred. Background-tab frame counters are not used as performance measurements.
- Local screenshots (ignored by Git): `artifacts/autumn-polish/scanned-stone-detail.png`, `folded-maple-canopy.png` and `detailed-mountain.png`. These show improved live geometry/materials, not a claim of photographic equivalence. Main/production still await the user's review.
