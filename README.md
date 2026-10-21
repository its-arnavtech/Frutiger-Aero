# Aerō worlds

Choose a living 3D world and explore it in one continuous, scroll-controlled flight. The original Frutiger Aero city remains the default. Open the world button at the top right to switch to **Autumn / Amberfall**, an independent river valley, or **Monsoon / Rainmere**, an uninhabited alpine lake. All three completed worlds ship together on `main`.

Direct links are `/?world=original`, `/?world=autumn` and `/?world=monsoon`. Winter and Spring appear as **Coming later**, ready for future theme branches. Only the selected world's scene module is loaded. Switching navigates to its own URL and releases the old page's graphics context.

Drift under a lantern-strung timber bridge, pass the glowing windows and waterwheel of a riverside village, follow the river into a mountain lake, circle an ancient maple, visit a hillside sanctuary, and rise above a copper-and-gold forest before returning home. The journey is a little over a kilometre long. Everything along the route belongs to the same 3D scene.

## Run

```sh
npm install
npm run dev
```

`npm run build` creates the static site in `dist/`; `npm run preview` serves it. No backend, API keys, or external runtime services are needed.

Use `npm run start:local` for review at **http://localhost:3000**. It builds first and serves versioned production bundles, avoiding mixed source-module versions after a disconnected development hot-reload session. Stop an existing server on port 3000 first. After editing, restart this command to rebuild the preview; use `npm run dev` when live source updates are wanted.

## Controls

- Scroll or swipe to travel. Reverse scrolling retraces the camera path.
- Scrub the glass timeline, or use the eight waypoint dots.
- Play / Space starts a 170-second flight. Pause to linger anywhere.
- Home or the amber orb returns to the beginning.
- Sound enables quiet synthesized ambience. Fullscreen is available where supported.

## Autumn / Amberfall

Three.js renders the complete scene. The shared [landscape plan](src/autumn/layout.js) defines the winding river, lake, island, village and terrain. A constant-speed [camera spline](src/autumn/journey.js) physically moves through this geography; its targets turn toward the landmarks as the flight progresses.

The forest contains over a thousand branching trees, with seven shapes, flared roots and asymmetrical boughs that join the trunk at different heights. An imagegen atlas supplies four individual photographic maple leaves. Each leaf has its own curved geometry, normal and colour variation; physically based shading supplies skylight, transmitted sunlight and wind. Scanned bark, meadow ground and fallen leaves complete the forest. Every tree keeps its complete geometry in the camera view at every distance. Only the lower-resolution water reflection uses simpler crowns.

The village has individual roof shingles, stone foundations, timber frames, recessed glazed windows with curtains, circular attic windows, paneled doors, verandas, chimneys and gutters. The sanctuary's upper story has windows on every side. A downhill wooden flume feeds the rotating mill wheel; falling water enters a carved pool and drains through a connected tailrace to the river. Drifting paper lanterns, windblown maple leaves, swallows and moving water keep the scene alive while the camera rests. The alpine backdrop has modeled ribs and gullies, layered grey rock and slope-dependent summit snow, with light atmospheric haze that preserves the visible relief.

The sky and HDR environment use photographic source assets. Scanned leaf litter and weathered timber include normal and roughness maps. Transparent water reveals the actual smooth sandy bed and submerged shoreline stones; depth absorption, slow ripples and Fresnel reflections control its appearance. The former repeating gravel pattern on the water surface is removed. Imagegen supplied the leaf and alpine rock textures, applied to live 3D geometry. See the [autumn asset record and generation prompts](docs/autumn-assets.md) and [source licenses](docs/assets.md).

The mill's visible paddle spill and downstream current share one animation clock. Sub-metre terrain around the mill keeps the narrow stream open. Seven eroded stone shapes, smaller chips, wet mineral surfaces and curved meadow grass break up the bank. Leaf colour varies primarily between trees, while smaller individual leaves retain their photographic veins and surface relief.

## Monsoon / Rainmere

A vast clear lake faces one dramatic mountain beyond its far shore. Low green hills leave both sides open, and a photographic blue sky carries bright cumulus clouds. Travel over submerged pebbles, across the lake toward snowmelt cascades, and along the green shore before returning home. The mountain remains ahead throughout the continuous loop. No people, characters, buildings or human silhouettes are present.

The terrain, lake-depth chart and flight tests share the same geography. Branching erosion channels, broken buttresses and nested rock fractures shape the mountain, with a two-metre desktop mesh concentrated around its faces. Generated rock textures add mineral grain and tilted bedding. Broad slope and concavity control snow accumulation in summit gullies and grassy lower ledges; baked cavity shading gives the ravines depth. Phone and recovery profiles use coarser, bounded meshes. Light rain falls around the camera, circles spread across the water, and mist drifts around the mountain. Cached terrain shadows and a photographic HDR environment supply directional and reflected light. The transparent water reveals actual submerged stones while reflecting the scene. The optional sound is a soft synthesized rainfall. See [assets and generation prompts](docs/monsoon-assets.md) and [validation cases](docs/monsoon-testing.md).

## Adding worlds

Add the new scene and journey modules in their own directory, then register the metadata and lazy loader in `src/themes.js`. The scene exposes `createWorld`; the journey exposes `places`. Mark a future theme available only once its scene works. Theme-specific interface colours belong in `src/themes.css`, scoped by `data-theme`. The shared loading, recovery, scrolling, audio, timeline and picker remain reusable.

## Performance and phone startup

Phones select bounded reflection, shadow and post-processing allocations before constructing the world. The startup flow yields between stages, bounds texture and shader waits, and exposes retry and lighter-rendering controls on failure. Add `&quality=mobile` to a world link for the phone budget; `&quality=low` selects a smaller recovery budget. The picker preserves these settings. Autumn has no blocking startup benchmark or dependency on Phaser effects.

Trees are instanced, static architecture is merged by material, shadows are cached, and fine shore detail is excluded from reflections. Autumn's distant mountain self-shadow and gully shading are baked into vertex colours once, preserving the nearby shadow map's detail. Shared foliage helpers load independently of the original city's tree generator and embedded textures. The renderer adjusts internal resolution if sustained frames are slow, while the final pass reconstructs and sharpens the image. Tree geometry never changes with camera distance. Rendering and audio suspend in background tabs. Reduced motion removes pointer parallax, scroll easing and ambient animation.

## Validation

```sh
npm test
npm run build
npm run test:mobile
```

The automated suite covers constant-speed travel, reverse scrolling, the closed-loop seam, look-target stability, all eight destinations, and clearance from the terrain, bridge, buildings and every planted tree. Existing startup, cancellation, shader-compilation, mobile-allocation and original-world regressions remain included.

The mobile test server serves the real production bundle with a simulated 3x pixel ratio and optional network/WebGL faults. It is local-only. See [mobile regression cases](docs/mobile-testing.md) and the [autumn validation notes](docs/autumn-testing.md). Desktop mobile emulation does not reproduce an iPhone's GPU or Safari driver; physical-device validation remains separate.

For inspection, `#loading[data-state]` reports startup status and `#world` exposes the active rendering budget, camera position, tree count, resolution and sampled frame rate as data attributes.
