# Aerō

A full-screen, live 3D Frutiger Aero city that plays like a film as you scroll. One camera makes a single unbroken flight through the whole place: in from the open lagoon, down the canal between glass towers, through the porcelain gateway and under the footbridge, a slow orbit of the great garden sphere, out over the western lagoon and its park island, back down the canal into the sun, around the eastern towers, and up to an overlook of the entire city. The camera physically travels one persistent scene with a fixed field of view. There are no image-plane environments, zoom effects, or scene crossfades.

## Run

```sh
npm install
npm run dev
```

`npm run build` creates a static production site in `dist/`. `npm run preview` serves that build.

## Controls

- Scroll or swipe to fly. Reverse scrolling retraces exactly the same path.
- Use the glass timeline to scrub, or the dots to jump to a named place on the route.
- Play button / Space: a hands-free flight of about three minutes.
- Circular arrow / Home: restart. End: go to the overlook.
- Sound button: opt into locally synthesized ambient sound.
- Corner button: fullscreen, where supported by the browser.

## The world

Everything is laid out from one plan, [src/layout.js](src/layout.js), which the builders, the planting, the camera route and the tests all read.

- **Towers.** Forty-three towers in five designs (domed capsules, twisted spindles, stacked porcelain discs, planted terraces and clear bell jars around hanging gardens) stand in three rows along the canal and in a ring around the basin, with seventy plain shells beyond them for the hazy skyline. Glazing uses the generated interior photograph ([prompt](docs/facade-prompt.md)) on real curved shells with modeled podiums, fins, sky lobbies, spires and observation pods.
- **Glass.** The curtain-wall shader keeps the interiors visible straight on and, toward grazing angles, mirrors the photographed sky in every pane at its own slight tilt. Clear glass (bell jars, sky bridges, balustrades, the garden spheres) adds the mirrored sky and a sun glint over whatever is behind it.
- **Quays and gardens.** Each bank is a garden peninsula inside a thick porcelain quay with a paved promenade, glass balustrade, lamps, street trees in planters and rolling lawns. Park islands are planters ringed by a white kerb.
- **Water.** A shallow lagoon: near the camera you look down through clear water to a pale bed with moving caustics; toward the horizon the surface becomes a planar reflection of the real scene, with sun glitter.
- **Planting.** Branching trees with photographed leaf sprays in several species, shrubs, and hanging vines, placed over the lawns, islands, terraces and inside the spheres. Each tree is drawn at one of three levels of detail chosen every frame.
- **Light and film.** A photographed HDR sky lights the scene and is turned so its sun matches the light that casts the shadows. The picture is rendered in HDR, then given ambient occlusion, a soft optical bloom, aerial haze at the horizon and a neutral filmic grade.

## Performance

The cost of a frame is almost entirely per pixel, so before the loading screen clears the renderer times a few real frames and fits the resolution to the GPU; a GPU with room to spare gets 4x multisampling, and others get FXAA at a higher resolution instead. If frames later run slow it steps down further. Static geometry is merged into a handful of draw calls per material, shadows are rendered once and cached, fine detail is left out of the water's mirror pass, and rendering and audio suspend in background tabs. Reduced-motion preferences stop ambient animation and remove pointer parallax and scroll easing. The scene requires WebGL 2 and reports an explicit error when it is unavailable.

Three.js renders the world. Babylon.js supplies the Catmull–Rom splines for the camera route. Phaser.js renders the atmospheric motes.

## Development

`npm test` checks the route: one continuous constant-speed path that reaches every district, clears every tower, sky bridge, sphere, pod and tree line by a margin, keeps a steady subject, and retraces itself exactly in reverse.

For inspection and profiling, `?view=x,y,z,tx,ty,tz` pins the camera to a position and target, `?samples=0|2|4` forces the antialiasing mode, and `?off=` takes a comma-separated list of stages to disable (`economy`, `mirror`, `ao`, `bloom`, `veg`, `city`, `water`, `fog`).

No backend, API keys, or external asset services are needed at runtime. Asset sources and licenses are documented in [docs/assets.md](docs/assets.md). The original imagegen artwork remains in `public/art/` as visual reference only; its prompts are recorded in [public/art/prompts.md](public/art/prompts.md).
