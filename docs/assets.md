# Asset sources

All runtime assets are served locally. No API key or external runtime request is needed.

## Poly Haven — CC0

Photographic PBR surfaces and the sky capture come from [Poly Haven](https://polyhaven.com/). Poly Haven assets are released under [CC0](https://polyhaven.com/license).

| Asset | Files | Use |
| --- | --- | --- |
| [Leafy Grass](https://polyhaven.com/a/leafy_grass) | `public/assets/materials/leafy_grass_*` | Terrain albedo, OpenGL normal, roughness |
| [Marble Cliff 02](https://polyhaven.com/a/marble_cliff_02) | `public/assets/materials/marble_cliff_02_*` | Shoreline rocks and suspended island foundations |
| [Coast Sand 01](https://polyhaven.com/a/coast_sand_01) | `public/assets/materials/coast_sand_01_*` | Beaches and lagoon bed |
| [Kloofendal 48d Partly Cloudy Pure Sky](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky) | `public/assets/environment/*` | Photographed sky and HDR environment lighting |
| [Grass Ground](https://polyhaven.com/a/grass_ground) | `public/assets/materials/grass_ground_*` | Retained material reference |
| [Metasequoia Bark](https://polyhaven.com/a/metasequoia_bark) | `public/assets/materials/metasequoia_bark_*` | Retained material reference |

Color maps use sRGB. Normal and roughness maps use linear data. Displacement maps are retained as source assets; the current terrain geometry does not use displacement maps. The renderer adjusts the grass tint to the intended lush green art direction. The HDR panorama illuminates the scene and reflects in glass; the world itself remains navigable 3D geometry.

## EZ Tree — MIT

Branching trees and photographed alpha-cut leaf textures use [EZ Tree by Daniel Greenheck](https://github.com/dgreenheck/ez-tree), through `@dgreenheck/ez-tree`. Its embedded textures are bundled with the dependency. The MIT license is reproduced at `public/assets/vegetation/EZ-TREE-LICENSE.txt`.

## Three.js — MIT

The water normal texture is from the [Three.js r180 examples](https://github.com/mrdoob/three.js/blob/r180/examples/textures/waternormals.jpg). The license is reproduced at `public/assets/materials/THREE-LICENSE.txt`.

## Original generated artwork

`public/art/` retains the original imagegen visual references and prompts. The live world does not use these pictures as zooming backgrounds or scene transitions.
