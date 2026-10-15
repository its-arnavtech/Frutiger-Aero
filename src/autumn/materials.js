import * as THREE from 'three';

export async function loadAutumnMaterials(load) {
  const sources = {
    leafGround: ['/assets/autumn/leaves_forest_ground_diff_1k.jpg', true],
    leafNormal: ['/assets/autumn/leaves_forest_ground_nor_gl_1k.jpg'],
    leafRough: ['/assets/autumn/leaves_forest_ground_rough_1k.jpg'],
    timber: ['/assets/autumn/weathered_brown_planks_diff_1k.jpg', true],
    timberNormal: ['/assets/autumn/weathered_brown_planks_nor_gl_1k.jpg'],
    timberRough: ['/assets/autumn/weathered_brown_planks_rough_1k.jpg'],
    soil: ['/assets/materials/coast_sand_01_diff_1k.jpg', true],
    soilNormal: ['/assets/materials/coast_sand_01_nor_gl_1k.jpg'],
    rock: ['/assets/materials/marble_cliff_02_diff_1k.jpg', true],
    rockNormal: ['/assets/materials/marble_cliff_02_nor_gl_1k.jpg'],
    grass: ['/assets/materials/leafy_grass_diff_1k.jpg', true],
  };
  return Object.fromEntries(await Promise.all(Object.entries(sources).map(async ([name, [path, color]]) => {
    const texture = await load(path); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    if (color) texture.colorSpace = THREE.SRGBColorSpace;
    return [name, texture];
  })));
}

export function forestFloor(maps) {
  const material = new THREE.MeshStandardMaterial({ map: maps.leafGround, normalMap: maps.leafNormal, normalScale: new THREE.Vector2(.8, .8), roughnessMap: maps.leafRough, roughness: .93, vertexColors: true, envMapIntensity: .85 });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { soilMap: { value: maps.soil }, grassMap: { value: maps.grass } });
    shader.vertexShader = `varying vec3 vGround;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround=position;');
    shader.fragmentShader = `varying vec3 vGround; uniform sampler2D soilMap; uniform sampler2D grassMap;\n${shader.fragmentShader}`
      .replace('#include <map_fragment>', `#include <map_fragment>
        float wet=1.-smoothstep(.1,2.4,vGround.y);
        float mossCoverage=smoothstep(.18,.7,sin(vGround.x*.041+sin(vGround.z*.026)*2.)*sin(vGround.z*.057));
        vec3 soil=texture2D(soilMap,vGround.xz*.32).rgb;
        vec3 moss=texture2D(grassMap,vGround.xz*.44).rgb*vec3(.88,.93,.75);
        diffuseColor.rgb=mix(diffuseColor.rgb,moss,mossCoverage*.42);
        diffuseColor.rgb=mix(diffuseColor.rgb,soil*vec3(.46,.43,.38),wet*.85);
        diffuseColor.rgb*=.84+.16*sin(vGround.z*.025+vGround.x*.019);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(.32,roughnessFactor,smoothstep(.1,2.3,vGround.y));');
  };
  material.customProgramCacheKey = () => 'amberfall-leaf-litter';
  return material;
}

export function timberMaterial(maps, color) {
  return new THREE.MeshStandardMaterial({ map: maps.timber, normalMap: maps.timberNormal, normalScale: new THREE.Vector2(.45, .45), roughnessMap: maps.timberRough, color, roughness: .85, envMapIntensity: .7 });
}

export function weatheredPlaster() {
  const material = new THREE.MeshStandardMaterial({ color: '#c5bfa8', roughness: .94 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = `varying vec3 vWall;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWall=position;');
    shader.fragmentShader = `varying vec3 vWall;\n${shader.fragmentShader}`.replace('#include <color_fragment>', `#include <color_fragment>
      float fleck=fract(sin(dot(floor(vWall.xz*140.+vWall.y*74.),vec2(12.7,37.3)))*4375.8);
      float streak=sin(vWall.x*2.1+sin(vWall.z*1.6)*2.)*.5+.5;
      diffuseColor.rgb*=.89+fleck*.13-streak*.08;
    `);
  };
  return material;
}
