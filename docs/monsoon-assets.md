# Monsoon / Rainmere assets

The user's photograph originally guided the alpine stone, snow and clear water. The October 18 revision opens this geography into a broad lake with one mountain ahead, low green side hills and a blue, cloud-filled sky. The reference photograph is not shipped or used as a background. The world contains no people, characters or human silhouettes. The mountain, hills, lake, stones, cascades and precipitation belong to the live 3D scene.

## Current realistic terrain and surfaces

The later October 21 revision replaces the radial, fluted mountain entirely. `src/monsoon/alpine-elevation.js` contains a 513 × 385 crop of Mapzen Terrarium elevations around the Matterhorn, centered at 7.6586 E, 45.9763 N. Zoom-14 tiles are decoded and resampled by `tools/prepare-monsoon-terrain.py`. Six source metres correspond to one horizontal scene metre; height is artistically rescaled and the boundary blends into the fictional lake. This is an artistic landscape, not a geographical reconstruction or navigational dataset.

Terrain source: [Mapzen Terrain Tiles on AWS](https://registry.opendata.aws/terrain-tiles/), retrieved October 21, 2026. **Produced using Copernicus data and information funded by the European Union - EU-DEM layers. SRTM data courtesy of the U.S. Geological Survey.** [Provider source credits and terms](https://github.com/tilezen/joerd/blob/master/docs/attribution.md). Downloaded tiles and exact source URLs are cached in ignored `artifacts/monsoon-dem/provenance.json`; the resulting elevation field is bundled locally.

The [Rock Face scan from Poly Haven](https://polyhaven.com/a/rock_face), under CC0, supplies `rock_face_diff_2k.jpg`, `rock_face_nor_gl_2k.jpg` and `rock_face_rough_1k.jpg` in `public/assets/monsoon/`. `tools/prepare-monsoon-relief.py` reduces its displacement map into `src/monsoon/rock-relief.js` for live geometric relief. Warped projection combines broad cliff formations with finer mineral grain; the scanned normals affect actual lighting. Existing CC0 Grass Ground and Coast Sand scans supply meadow, sand and underwater-bed colour and normal maps.

Ten fractured stone variants form boulder and gravel deposits with smaller chips around larger rocks. Wet stone, moss and lichen shading use the scanned rock maps. Instanced curved grass, individually folded willow leaves and open, three-dimensional spruce branch whorls add actual vegetation. Greenery follows altitude and slope; plant counts and terrain spacing are bounded for phone and recovery profiles. Lake reflections contain the same mountain, trees and boulders. Wind ripples soften the reflection.

The generated maps recorded below remain historical assets in the repository; the current Monsoon scene no longer loads them.

## Generated rock

- Saved asset: `public/assets/monsoon/wet-slate.png`.
- Generated with the built-in `image_gen` service on 2026-10-17. Applied with triplanar projection to the modeled cliffs and instanced shoreline stones.
- Source output: `exec-c1242344-8e9f-4cd5-a1af-88f8cf44dc08.png`.
- Prompt:

> Use case: photorealistic-natural. Asset type: seamless PBR base-color texture for actual 3D alpine cliffs in a rainy mountain lake world. Generate a square, extremely detailed orthographic close-up of dark grey alpine sedimentary rock, fine horizontal bedding, irregular vertical fissures, broken slate faces, slightly brown mineral weathering and a few subtle pale quartz seams. Diffuse overcast illumination with no directional shadow, no specular highlight, flat exposure appropriate for an albedo map. Edge-to-edge surface, no perspective, no horizon, no landscape, no snow, no plants, no humans or animals, no objects, no writing, no watermark. Natural physically believable photographic rock detail at multiple scales, quiet neutral grey tones with restrained variation. The material is rain-darkened limestone, not lava or crystalline marble. Seamlessly tileable horizontally and vertically, square 2048 by 2048 if supported.

## Generated pebble bed

- Saved asset: `public/assets/monsoon/glacial-pebbles.png`.
- Generated with the built-in `image_gen` service on 2026-10-17; blended into shallow, flatter parts of the terrain. Larger stones remain actual instanced geometry.
- Source output: `exec-0496e9a6-c12f-482f-af97-4e38fca1ea25.png`.
- Prompt:

> Use case: photorealistic-natural. Asset type: seamless square ground albedo texture for the bottom and banks of a real-time 3D alpine glacial lake. Orthographic directly overhead close-up of a dense natural bed of small rain-wet flat river stones and pebbles. Mixed muted slate grey, olive grey, taupe, brown-grey and occasional pale quartz. Irregular rounded and angular stone shapes, fine cracks, authentic mineral grain, tiny dark sandy gaps. Each stone about 2–8 cm, about 15–25 stones across the width. Natural wet colour but diffuse shadowless overcast lighting: no glossy highlights, no water surface, no reflections, no horizon, no perspective. Entire image filled with this continuous surface. Seamlessly tileable on all edges. High photographic detail and neutral exposure. No people, no humans, no animals, no plants, no objects, no letters, no watermark. Square 2048 by 2048 if supported.

## Reused assets

The Marble Cliff normal map, Grass Ground scan and Kloofendal 48d Partly Cloudy PureSky photograph/HDR are CC0 Poly Haven assets already included in the project. The full panoramic sky rotates very slowly on a camera-centered sphere; its HDR companion lights materials. The water normal texture is distributed with Three.js under its included license. See `docs/assets.md` and `public/assets/materials/THREE-LICENSE.txt`.

Rain, rain rings, vegetation, snow coverage, waterfalls and mist use procedural geometry and shaders. Optional rain sound is synthesized locally. No external API calls occur at runtime.

## Earlier October 21 mountain detail (superseded)

The additional user references guide fractured alpine faces, green lower slopes and snow-filled summit channels. Both remain visual references; neither image is used as a backdrop or shipped as a new texture. The live terrain now uses warped branching drainage, several scales of ridged fracture relief, and a continuous nonuniform grid with two-metre spacing around the desktop mountain (four metres on phones, six in recovery mode). Broad slope and local concavity are sampled from this same surface to place snow, meadow and cavity shading. Tilted, warped sediment bands supplement the existing rock maps. Shore stones and cascades still follow the shared terrain; the reflection renders the same mountain geometry.
