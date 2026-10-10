import * as THREE from 'three';
import { sweep, surface } from './build.js';
import { TAU, islands, islandHeight, islandEdge, RIM } from './layout.js';

export async function loadSurfaces(renderer) {
  const loader = new THREE.TextureLoader(), anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  async function set(name) {
    const [color, normal, roughness] = await Promise.all(['diff', 'nor_gl', 'rough'].map(kind => loader.loadAsync(`/assets/materials/${name}_${kind}_1k.jpg`)));
    color.colorSpace = THREE.SRGBColorSpace;
    for (const texture of [color, normal, roughness]) { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = anisotropy; }
    return { color, normal, roughness };
  }
  const [grass, rock, sand] = await Promise.all([set('grass_ground'), set('marble_cliff_02'), set('coast_sand_01')]);
  return { grass, rock, sand };
}

// Ground is textured from world position, so lawns, islands and the gardens
// inside the spheres all share one continuous, seamless turf. The scanned grass
// supplies blade-scale detail; the colour itself is graded to a watered lawn.
function groundMaterial(maps, wild) {
  const material = new THREE.MeshStandardMaterial({ map: maps.grass.color, normalMap: maps.grass.normal, normalScale: new THREE.Vector2(1.5, 1.5), roughness: .9, envMapIntensity: .5 });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { groundSand: { value: maps.sand.color }, groundRock: { value: maps.rock.color } });
    shader.vertexShader = `varying vec3 vLand; varying vec3 vLandNormal;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLand = (modelMatrix * vec4(transformed, 1.)).xyz; vLandNormal = normal;');
    shader.fragmentShader = `varying vec3 vLand; varying vec3 vLandNormal; uniform sampler2D groundSand; uniform sampler2D groundRock;\n${shader.fragmentShader}`
      .replace('#include <map_fragment>', `
        vec2 turf = vLand.xz;
        // Two scales of scanned grass: blades underfoot, texture from a distance.
        float blade = dot(texture2D(map, turf * .23).rgb, vec3(.3, .55, .15)) * .6 + dot(texture2D(map, turf * .91 + .21).rgb, vec3(.3, .55, .15)) * .4;
        float mottle = texture2D(map, turf * .019 + .37).g, drift = texture2D(map, turf * .0043).r;
        // The scan is dry and brown, so only its light and shade are used: the
        // darkest blades map to deep green, the brightest to sunlit yellow-green.
        vec3 lush = mix(vec3(.04, .1, .018), vec3(.25, .37, .075), saturate(blade * 7.5 - .5));
        lush *= .74 + .5 * mottle; lush = mix(lush, lush * vec3(1.28, 1.1, .62), saturate(drift * 2.4 - .55) * .5);
        ${wild ? `
        float shore = 1. - smoothstep(.2, 2.4, vLand.y), steep = smoothstep(.36, .7, 1. - normalize(vLandNormal).y) * (1. - shore);
        vec3 canopy = lush * mix(vec3(.5, .68, .6), vec3(.86, .95, .7), saturate(mottle * 3. - .9));
        lush = mix(mix(canopy, texture2D(groundSand, turf * .09).rgb, shore), texture2D(groundRock, turf * .045).rgb * 1.1, steep);` : `
        // Faint mowing bands, as on any tended lawn.
        lush *= .9 + .1 * smoothstep(-.3, .3, sin(turf.x * .52 + turf.y * .31));`}
        diffuseColor.rgb = lush;`)
      .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('texture2D( normalMap, vNormalMapUv )', 'texture2D( normalMap, vLand.xz * .23 )'));
  };
  material.customProgramCacheKey = () => `aero-ground-${wild}`;
  return material;
}

export function landFinishes(maps) {
  return { lawn: { material: groundMaterial(maps, false) }, wild: { material: groundMaterial(maps, true) } };
}

function terrain(island, rings, segments, reach) {
  return surface(Array.from({ length: rings + 1 }, (_, r) => Array.from({ length: segments + 1 }, (_, a) => {
    const angle = a / segments * TAU, radius = r / rings * reach * islandEdge(island, angle);
    const x = island.x + Math.cos(angle) * radius * island.rx, z = island.z + Math.sin(angle) * radius * island.rz;
    return { x, y: islandHeight(island, x, z), z };
  })));
}

export function buildLandscape({ add }) {
  // Park islands sit in the lagoon like great planters, each inside a white kerb.
  const KERB = [[.02, -1.8], [.02, .46], [.3, .7], [.37, 1], [.23, 1.27], [-.08, 1.36], [-.42, 1.29], [-.58, 1.06]];
  for (const island of islands) {
    if (island.wild) { add('wild', terrain(island, 26, 84, 1)); continue; }
    add('lawn', terrain(island, 14, 72, RIM + .03));
    const outline = Array.from({ length: 120 }, (_, i) => {
      const angle = i / 120 * TAU, reach = islandEdge(island, angle) * (RIM + .045);
      return { x: island.x + Math.cos(angle) * reach * island.rx, z: island.z + Math.sin(angle) * reach * island.rz };
    });
    add('white', sweep(outline, KERB, { closed: true, outward: 1, uvScale: .5 }));
  }
}
