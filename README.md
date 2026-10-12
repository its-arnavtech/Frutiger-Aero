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

- **Towers.** Forty-three towers in five designs (domed capsules, twisted spindles, stacked porcelain discs, planted terraces and clear bell jars around hanging gardens) stand in three rows along the canal and in a ring around the basin, with seventy plain shells beyond them for the skyline. Each has a modeled podium, fins, sky lobbies and a spire, and every tower that rises from open water stands in a planted garden island of its own.
- **Windows.** The curtain wall is built up the way a real facade is. Every bay is two panes between slim aluminium mullions, above a band of opaque spandrel glass that hides the floor slab. The glass sits behind the face of the frame, so the members show their sides and slide across it as the camera moves, and their coverage is filtered so they keep their true weight at any distance. Each pane is a flat sheet with its own slight tilt and bow, which breaks the reflected city into offset images and lets the sun flash off single panes. Reflections come from a cube-map photograph taken inside the finished city. Behind the glass each bay is a room with a floor, a ceiling with strip lights and side walls, with the generated interior photograph ([prompt](docs/facade-prompt.md)) across the back; rooms that face the sun get a bright patch on the floor, some have their lights on, and some have roller blinds part-way down. Clear glass (bell jars, sky bridges, balustrades, the garden spheres) uses the same reflections with a sun glint.
- **White architecture.** Porcelain surfaces are assembled from panels with fine joints, slight tone variation and a tide mark at the waterline. The glaze has a faint orange-peel that breaks up its highlights, cloudy variation in its sheen, and pale streaks where rain has run down the walls.
- **Paving.** Promenades are honed pale marble. Each slab is cut from a different part of a scanned rock face and turned one of four ways, so no two match; the scan's fracture lines become the veining and its relief the surface of the stone.
- **Quays and gardens.** Each bank is a garden peninsula inside a thick porcelain quay with a paved promenade, glass balustrade, lamps, street trees in planters and rolling lawns. Park islands are planters ringed by a white kerb.
- **Water.** Depth comes from a chart of distance to the nearest shore, so the canal and the margins of every island are pale turquoise over a bed with moving caustics, and open water deepens to blue. Toward the horizon the surface becomes a planar reflection of the real scene, with sun glitter.
- **Boats.** Thirty-four boats of three kinds, each modeled from the same hull lines: glass-canopied launches that run a circuit of the canal (drawing together to pass through the gateway, and swinging out around the island off its mouth) and circle the park islands; runabouts moored along both quays; and sloops under mainsail and jib sailing the open lagoon around the city. Moving boats trail foam that stays where it was left on the water, and carry a soft shadow of their own because the scene's shadows are baked once.
- **Planting.** Branching trees with photographed leaf sprays in several species, shrubs, and hanging vines, placed over the lawns, islands, terraces and inside the spheres. Leaf textures carry mipmaps that preserve the gaps between leaves, crowns are shaded darker toward their core, and the camera always draws complete tree crowns and branches throughout the flight; only reflections use simplified trees. Leaf photographs are also read as relief, so sprays shade leaf by leaf. Lawns take their blade detail from a scanned grass surface at two scales, with patches of broader-leaved clover from a second scan.
- **Light and film.** A photographed HDR sky is turned so its sun matches the light that casts the shadows. Once the city is built it is photographed from inside against that sky, and the result becomes the light every surface receives, so the lagoon throws turquoise up under quays and soffits and lawns tint the walls beside them. The picture is rendered in HDR, then given ambient occlusion, a soft optical bloom, aerial haze at the horizon and a neutral filmic grade.

## Performance

The canvas always matches the screen, up to twice its CSS size. The cost of a frame is almost entirely per pixel, so before the loading screen clears the renderer times a few real frames and chooses the resolution the world is drawn at to suit the GPU; the last pass enlarges that to the canvas with a bicubic filter and contrast-adaptive sharpening, so textures arrive crisp rather than stretched. A GPU with room to spare draws at full resolution with 4x multisampling, and others use FXAA. Where the browser can time the GPU, the drawing resolution then follows what frames really cost, rising in the first few seconds if that first measurement was pessimistic. If frames later run slow it steps down further. Surface textures are filtered at the GPU's highest anisotropy. Static geometry is merged into a handful of draw calls per material, shadows are rendered once and cached, fine detail is left out of the water's mirror pass, and rendering and audio suspend in background tabs. Reduced-motion preferences stop ambient animation and remove pointer parallax and scroll easing. The scene requires WebGL 2 and reports an explicit error when it is unavailable.

Three.js renders the world. Babylon.js supplies the Catmull–Rom splines for the camera route. Phaser.js renders the atmospheric motes.

## Development

`npm test` checks the route: one continuous constant-speed path that reaches every district, clears every tower, sky bridge, sphere, pod, tree line and boat by a margin, keeps a steady subject, and retraces itself exactly in reverse. It also checks that every boat's course stays in open water.

For inspection and profiling, `?view=x,y,z,tx,ty,tz` pins the camera to a position and target, `?samples=0|2|4` forces the antialiasing mode, and `?off=` takes a comma-separated list of stages to disable (`economy`, `mirror`, `ao`, `bloom`, `bounce`, `veg`, `city`, `boats`, `water`, `fog`).

No backend, API keys, or external asset services are needed at runtime. Asset sources and licenses are documented in [docs/assets.md](docs/assets.md). The original imagegen artwork remains in `public/art/` as visual reference only; its prompts are recorded in [public/art/prompts.md](public/art/prompts.md).

## Phone loading

Phones select a smaller reflection, shadow and post-processing budget before
allocating GPU buffers, keep full-detail foliage throughout the route, and skip
the blocking startup benchmark and optional 2D motes. The loading screen reports
progress and offers retry or lighter rendering if downloads, shader preparation,
or the graphics context fail. `?quality=mobile` selects this budget explicitly.
See [mobile regression cases](docs/mobile-testing.md) for automated tests and
the local production-bundle fault-injection server.
