# Aerō worlds

Choose a living 3D world and explore it in one continuous, scroll-controlled flight. The original Frutiger Aero city remains the default. Open the world button at the top right to switch to **Autumn / Amberfall**, an independent river valley, or **Monsoon / Rainmere**, an uninhabited alpine lake. Monsoon is developed on `codex/monsoon-world`, based on the completed multi-world autumn branch.

Direct links are `/?world=original`, `/?world=autumn` and `/?world=monsoon`. Winter and Spring appear as **Coming later**, ready for future theme branches. Only the selected world's scene module is loaded. Switching navigates to its own URL and releases the old page's graphics context.

Drift under a lantern-strung timber bridge, pass the glowing windows and waterwheel of a riverside village, follow the river into a mountain lake, circle an ancient maple, visit a hillside sanctuary, and rise above a copper-and-gold forest before returning home. The journey is a little over a kilometre long. Everything along the route belongs to the same 3D scene.

## Run

```sh
npm install
npm run dev
```

`npm run build` creates the static site in `dist/`; `npm run preview` serves it. No backend, API keys, or external runtime services are needed.

## Controls

- Scroll or swipe to travel. Reverse scrolling retraces the camera path.
- Scrub the glass timeline, or use the eight waypoint dots.
- Play / Space starts a 170-second flight. Pause to linger anywhere.
- Home or the amber orb returns to the beginning.
- Sound enables quiet synthesized ambience. Fullscreen is available where supported.

## Autumn / Amberfall

Three.js renders the complete scene. The shared [landscape plan](src/autumn/layout.js) defines the winding river, lake, island, village and terrain. A constant-speed [camera spline](src/autumn/journey.js) physically moves through this geography; its targets turn toward the landmarks as the flight progresses.

The forest contains over a thousand branching trees, with seven shapes and varied ochre, copper and olive foliage. An imagegen botanical branch texture supplies individual leaf veins, spots and cutout edges; physically based shading supplies skylight, transmitted sunlight and wind. Every tree keeps its complete geometry in the camera view at every distance. Only the lower-resolution water reflection uses simpler crowns.

The village has pitched roofs, timber frames, glowing lattice windows, verandas, riverside boardwalks, paper lanterns and a rotating mill wheel. The river reflects the actual world. Drifting paper lanterns, windblown maple leaves, swallows and moving water keep the scene alive while the camera rests. Dry sedges, fallen leaves and river stones soften the shore; successive mountain ridges recede into haze.

The sky and HDR environment use photographic source assets. Scanned leaf litter and weathered timber include normal and roughness maps. Wet banks blend into a gravel riverbed; depth-dependent water colour, fine ripples and Fresnel reflections make the shallows visible. Imagegen supplied the branch and individual falling-leaf textures, applied to live 3D geometry. See the [autumn asset record and generation prompts](docs/autumn-assets.md) and [source licenses](docs/assets.md).

## Monsoon / Rainmere

A rainy alpine cirque surrounds a clear glacial lake, inspired by the supplied mountain photograph. Travel over submerged pebbles, beside rain-darkened slate walls and snowmelt waterfalls, along lingering snow shelves, and above the same lake before returning to the shore. No people, characters, buildings or human silhouettes are present.

The terrain, lake-depth chart and flight tests share the same geography. Photographic generated rock textures cover physical cliff geometry. Snow accumulates by slope, elevation and irregular coverage; rain falls in a bounded volume around the camera, circles spread across the water, and mist drifts beside the walls. The transparent water reveals actual submerged stones while reflecting the scene. The optional sound is a soft synthesized rainfall. See [assets and generation prompts](docs/monsoon-assets.md) and [validation cases](docs/monsoon-testing.md).

## Adding worlds

Add the new scene and journey modules in their own directory, then register the metadata and lazy loader in `src/themes.js`. The scene exposes `createWorld`; the journey exposes `places`. Mark a future theme available only once its scene works. Theme-specific interface colours belong in `src/themes.css`, scoped by `data-theme`. The shared loading, recovery, scrolling, audio, timeline and picker remain reusable.

## Performance and phone startup

Phones select bounded reflection, shadow and post-processing allocations before constructing the world. The startup flow yields between stages, bounds texture and shader waits, and exposes retry and lighter-rendering controls on failure. Add `&quality=mobile` to a world link for the phone budget; `&quality=low` selects a smaller recovery budget. The picker preserves these settings. Autumn has no blocking startup benchmark or dependency on Phaser effects.

Trees are instanced, static architecture is merged by material, shadows are cached, and fine shore detail is excluded from reflections. The renderer adjusts internal resolution if sustained frames are slow, while the final pass reconstructs and sharpens the image. Tree geometry never changes with camera distance. Rendering and audio suspend in background tabs. Reduced motion removes pointer parallax, scroll easing and ambient animation.

## Validation

```sh
npm test
npm run build
npm run test:mobile
```

The automated suite covers constant-speed travel, reverse scrolling, the closed-loop seam, look-target stability, all eight destinations, and clearance from the terrain, bridge, buildings and every planted tree. Existing startup, cancellation, shader-compilation, mobile-allocation and original-world regressions remain included.

The mobile test server serves the real production bundle with a simulated 3x pixel ratio and optional network/WebGL faults. It is local-only. See [mobile regression cases](docs/mobile-testing.md) and the [autumn validation notes](docs/autumn-testing.md). Desktop mobile emulation does not reproduce an iPhone's GPU or Safari driver; physical-device validation remains separate.

For inspection, `#loading[data-state]` reports startup status and `#world` exposes the active rendering budget, camera position, tree count, resolution and sampled frame rate as data attributes.
