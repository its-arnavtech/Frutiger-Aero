# Mobile startup regression cases

Run `npm test` for the automated loading, cancellation, graphics compilation,
and allocation-budget regressions in `tests/startup.test.js`, as well as the
existing route and scroll tests. Run `npm run build` before testing the preview
or a Vercel deployment.

The reported device is an iPhone 12. Browser viewport emulation does not emulate
its A14 GPU, iOS memory limits, or Safari driver; physical-device checks remain
part of release validation.

`npm run test:mobile` serves the actual production bundle at
`http://127.0.0.1:5174/?quality=mobile` with a simulated 3× pixel ratio.
Add `&world=autumn` to exercise Autumn; otherwise Original is selected.
Append `&fault=asset`, `bundle`, `no-webgl`, `context-loading`, or `context-ready`
to reproduce network and real WebGL-context failures. These hooks live only in
the local test server, never the deployed app. Clear `fault` to test recovery.

| Case | Steps | Expected result |
| --- | --- | --- |
| iPhone 12 cold start | Safari, portrait 390 × 844 CSS pixels, reload with an empty cache | Loading stages advance, a live world appears, controls work. No indefinite loader. |
| iPhone 12 landscape | Rotate to 844 × 390 during loading and again during flight | Same world, correct aspect ratio, no reload or lost context. |
| Touch journey | Swipe up/down, tap a waypoint, drag timeline, then play/pause; repeat in each available world | Camera travels and reverses through the same scene; controls respond. |
| Slow connection | Cold load with network throttling | Loader reports current stage; a stalled asset fails within 30 seconds, entire startup within 60 seconds, with retry controls. |
| Failed bundle/asset | Block the main JS chunk, a landscape image, or maple leaf texture | Error and retry controls replace loading; never a blank ready state. |
| Interrupted leaf decode | Leave image decode pending | Loading fails within 15 seconds and frees the world resources. |
| Interrupted shader compile | Driver completion remains false | Error within the world's 20-second shader deadline; shader polling stops. |
| Unsupported graphics | Disable WebGL or simulate shader link failure | Recoverable error instead of an endless loader. |
| GPU context loss | Trigger `WEBGL_lose_context` during loading and after first frame in a test harness | Rendering stops, loading becomes an error, retry and lighter-rendering options appear. Late completion cannot hide the error. |
| Optional atmosphere blocked | Block the Phaser chunk | Amberfall loads independently; its leaves are animated in the 3D world and do not request Phaser. |
| Background/resume | Background Safari while loading, return; repeat after ready | No duplicate animation loops. World resumes, or a timeout offers retry. |
| Recovery | Tap Try again, then test Try lighter rendering | Clean page load; lighter mode persists in the URL and retains full-detail trees and the complete camera path. |
| Desktop regression | Wide viewport, run full route in both directions | Desktop resolution, effects, route and foliage remain intact. |

For inspection, `#loading[data-state]` reports `loading`, `ready`, or `error`,
`data-stage` records the current loading phase, and `#world[data-profile]`
reports the selected rendering budget. `?quality=low` uses the smaller recovery
budget. `?quality=mobile` exercises the phone
allocation path on a desktop; it is not a substitute for a physical phone.
