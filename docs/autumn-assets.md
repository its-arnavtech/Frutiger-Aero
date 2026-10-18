# Amberfall asset record

## Generated maple leaf

- Service: built-in imagegen service, using the imagegen skill.
- Runtime file: `public/assets/autumn/maple-leaf.png`.
- Original output: `C:/Users/Arnav/.codex/generated_images/01a11eb4-b42d-7f51-9146-008ceda3fdef/exec-6bac9932-3d72-4ee0-b5dc-ec7afeaaab23.png`.
- 1280 × 1280 RGBA, transparent background. Used on moving 3D leaf cutouts and fallen leaves on the banks. Original output copied without image edits.

Final generation prompt:

> Use case: photorealistic-natural. Asset type: transparent cutout texture for a live 3D autumn forest game. A single beautiful freshly fallen Japanese maple leaf, warm luminous burnt orange with golden yellow tips and a red central stem, extremely detailed natural translucent leaf veins, five pointed lobes with finely serrated edges and a slightly curled edge, photographed directly overhead with diffuse neutral soft light, physically realistic and sharp. Centered, fully inside the canvas with generous transparent padding, stem pointing down. No shadow or surface behind it, true transparent background, no text, no watermark. Square composition. This will be used as the texture of hundreds of falling leaves moving through an autumn world.

## Generated maple branch

- Service: built-in imagegen, using the imagegen skill.
- Runtime file: `public/assets/autumn/maple-branch.png`.
- Original output: `C:/Users/Arnav/.codex/generated_images/01a11eb4-b42d-7f51-9146-008ceda3fdef/exec-2cd76117-f416-4e66-8519-43f868aa4f31.png`.
- Transparent botanical texture, copied without image edits. Used on the actual branching tree meshes, with coverage-preserving mipmaps, per-tree tint, wind and physically based shading.

Final generation prompt:

> Use case: photorealistic-natural. Asset type: transparent foliage texture for instanced branches on live 3D autumn trees. An isolated natural cluster of 30 to 40 small autumn maple leaves attached to a delicate branching brown twig, photographed straight on as a flat botanical specimen with soft neutral overcast lighting. The branch forks out from the bottom center into a roughly rounded but irregular fan occupying most of the square. Realistically varied muted ochre, warm yellow, copper and a few olive leaves; subtle red at some tips. Each individual leaf is anatomically accurate, has crisp fine veins, tiny spots, thin serrated edges, natural curl, and slight translucency. The leaves are distinct at varied angles with small transparent gaps between them. Photographic material scan, not an illustration, not stylized, no outlines, no painted look, no blown highlights. Thin twigs partially visible. Entire cluster contained within frame with 5 percent transparent padding. True transparent background with transparent gaps, no surface, no cast shadow, no text. Sharp edge-to-edge focus, rich natural fine detail. Square texture.

## Scanned material additions

These Poly Haven materials are CC0, downloaded at 1K with diffuse, OpenGL normal and roughness maps into `public/assets/autumn/`:

- [Leaves Forest Ground](https://polyhaven.com/a/leaves_forest_ground): `leaves_forest_ground_{diff,nor_gl,rough}_1k.jpg`.
- [Weathered Brown Planks](https://polyhaven.com/a/weathered_brown_planks): `weathered_brown_planks_{diff,nor_gl,rough}_1k.jpg`.

## Reused photographic sources

The CC0 Poly Haven sky photograph is warmed in the sky shader and its HDR companion lights surface reflections. Coast Sand supplies the riverbed; Marble Cliff supplies stone detail. Three.js's water normal texture animates the river surface. Autumn now uses connected, procedurally modeled roots, trunks, forks and twigs in `tree-geometry.js`, with the existing Metasequoia Bark scan and Grass Ground scan. Original-world foliage remains unchanged.

Source links and licenses are retained in [assets.md](assets.md). The landscape, village, bridge, waterwheel, mountain ridges, river, sedges and camera path are modeled procedurally in `src/autumn/`.

## Golden maple spray — October 18 realism pass

- Service: built-in imagegen service, using the imagegen skill.
- Runtime file: `public/assets/autumn/golden-maple-spray.png`.
- Original output: `C:/Users/Arnav/.codex/generated_images/01a11eb4-b42d-7f51-9146-008ceda3fdef/exec-d0c3274d-8f6a-45d4-87e4-ed09c88ab37f.png`.
- Original transparent output copied without edits. Replaces the dense brown branch texture on live tree geometry; transparent gaps, coverage-preserving mipmaps and full camera geometry remain throughout the route.

Final generation prompt:

> Use case: photorealistic-natural. Asset type: alpha-cutout leaf spray texture for a physically lit real-time 3D autumn maple tree. A fine natural branching twig carrying 12 to 16 separate freshly yellow autumn maple leaves. Broad anatomically correct five-lobed maple leaves, fine serrated edges, sharp branching veins, delicate thin stems, small natural curl, fresh luminous golden yellow and lemon yellow with a few yellow-green leaves and just one subtle amber leaf. The leaves form a sparse irregular fan from a twig entering the bottom center, each leaf clearly discernible, generous transparent gaps between leaves; about half of the square remains transparent. Use a straight-on orthographic botanical photograph, extremely crisp focus, neutral diffuse daylight, no baked shadows or directional sunlight. Genuine photographic leaf surface detail, natural minor imperfections. Entire spray inside the square with small clear margins. True transparent background including all gaps. No background, no white matte, no ground, no glow, no blurred leaves, no browned dead foliage, no orange clump, no text, no watermark. Square image.
