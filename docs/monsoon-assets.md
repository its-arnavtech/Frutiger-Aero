# Monsoon / Rainmere assets

The user's photograph originally guided the alpine stone, snow and clear water. The October 18 revision opens this geography into a broad lake with one mountain ahead, low green side hills and a blue, cloud-filled sky. The reference photograph is not shipped or used as a background. The world contains no people, characters or human silhouettes. The mountain, hills, lake, stones, cascades and precipitation belong to the live 3D scene.

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

Mountain ridges, moving rain, rain rings, snow coverage, waterfalls and mist use procedural geometry and shaders. Optional rain sound is synthesized locally. No external API calls occur at runtime.
