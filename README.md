# Aerō

A full-screen, live 3D Frutiger Aero archipelago. Scroll to fly low over a reflective lagoon, through a porcelain gateway, beneath a curved bridge, around a floating terrarium, and back to an aerial view of the same islands. The perspective camera physically traverses one persistent scene, with a fixed field of view. There are no image-plane environments, zoom effects, or scene crossfades.

## Run

```sh
npm install
npm run dev
```

`npm run build` creates a static production site in `dist/`. `npm run preview` serves that build.

## Controls

- Scroll or swipe to move through the world. Reverse scrolling rewinds it.
- Use the glass timeline to scrub, or the three dots to visit points along the same route.
- Play button / Space: hands-free 95-second journey.
- Circular arrow / Home: restart. End: go to the island overlook.
- Sound button: opt into locally synthesized ambient sound.
- Corner button: fullscreen, where supported by the browser.

## Rendering

Three.js renders real terrain meshes, instanced trees and grass, glass towers, bridges, iridescent spheres, animated birds, waterfalls, and water with planar reflections of the actual scene. Babylon.js supplies an arc-length-parameterized Catmull–Rom camera route. Phaser.js renders the atmospheric motes. Water, foliage, birds, and bubbles remain alive when the camera stops. Scroll controls camera travel, and reverse scrolling retraces the same route.

Instanced vegetation, cached shadows, a bounded reflection target, and adaptive pixel density limit GPU work. Rendering and audio suspend in background tabs. Native page scroll supports touch and keyboard navigation. Reduced-motion preferences stop ambient animation and remove pointer parallax and scroll interpolation. The scene requires WebGL and reports an explicit error when it is unavailable.

The original imagegen artwork remains in `public/art/` as visual reference. Those images are not loaded by the live renderer. Their prompts are recorded in [public/art/prompts.md](public/art/prompts.md).

No backend, API keys, or external asset services are needed at runtime. `npm test` verifies route continuity, consistent travel speed, terrain/terrarium clearance, valid camera direction, and identical positions when rewinding.
