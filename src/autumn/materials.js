import * as THREE from 'three';
import { surfaceDetail } from './surface-detail.js';

export async function loadAutumnMaterials(load) {
  const sources = {
    leafGround: ['/assets/autumn/leaves_forest_ground_diff_1k.jpg', true],
    leafRough: ['/assets/autumn/leaves_forest_ground_rough_1k.jpg'],
    timber: ['/assets/autumn/weathered_brown_planks_diff_1k.jpg', true],
    timberNormal: ['/assets/autumn/weathered_brown_planks_nor_gl_1k.jpg'],
    timberRough: ['/assets/autumn/weathered_brown_planks_rough_1k.jpg'],
    rock: ['/assets/materials/marble_cliff_02_diff_1k.jpg', true],
    rockNormal: ['/assets/materials/marble_cliff_02_nor_gl_1k.jpg'],
    rockRough: ['/assets/materials/marble_cliff_02_rough_1k.jpg'],
    alpine: ['/assets/autumn/alpine-slate.png', true],
    grass: ['/assets/materials/grass_ground_diff_1k.jpg', true],
    grassNormal: ['/assets/materials/grass_ground_nor_gl_1k.jpg'],
    bark: ['/assets/materials/metasequoia_bark_diff_1k.jpg', true],
    barkNormal: ['/assets/materials/metasequoia_bark_nor_gl_1k.jpg'],
  };
  return Object.fromEntries(await Promise.all(Object.entries(sources).map(async ([name, [path, color]]) => {
    const texture = await load(path); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    if (color) texture.colorSpace = THREE.SRGBColorSpace;
    return [name, texture];
  })));
}

export function forestFloor(maps) {
  const material = new THREE.MeshStandardMaterial({ map: maps.leafGround, normalMap: maps.grassNormal, normalScale: new THREE.Vector2(.7, .7), roughnessMap: maps.leafRough, roughness: .93, vertexColors: true, envMapIntensity: .85 });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { grassMap: { value: maps.grass } });
    shader.vertexShader = `varying vec3 vGround;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround=position;');
    shader.fragmentShader = `varying vec3 vGround; uniform sampler2D grassMap;\n${shader.fragmentShader}`
      .replace('#include <map_fragment>', `#include <map_fragment>
        float mossCoverage=smoothstep(.18,.7,sin(vGround.x*.041+sin(vGround.z*.026)*2.)*sin(vGround.z*.057));
        vec3 moss=texture2D(grassMap,vGround.xz*.26).rgb*vec3(.69,1.02,.52);
        // Irregular litter beds break up the former uniformly clipped lawn.
        float litter=.5+.5*sin(vGround.x*.19+sin(vGround.z*.12)*2.)*sin(vGround.z*.17+vGround.x*.06);
        diffuseColor.rgb=mix(diffuseColor.rgb*vec3(.78,.72,.57),moss,.28+mossCoverage*.45+litter*.23);
        // Smooth, pale mineral sand beneath the water, without the former
        // high-contrast pebble pattern painted over the entire lake.
        vec3 sand=vec3(.36,.31,.22)*(.91+.09*sin(vGround.x*.11+sin(vGround.z*.08)*2.));
        diffuseColor.rgb=mix(diffuseColor.rgb,sand,1.-smoothstep(-.1,1.3,vGround.y));
        diffuseColor.rgb*=.84+.16*sin(vGround.z*.025+vGround.x*.019);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(.55,roughnessFactor,smoothstep(.1,2.3,vGround.y));')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal=normalize(mix(normal,nonPerturbedNormal,1.-smoothstep(0.,1.2,vGround.y)));');
  };
  material.customProgramCacheKey = () => 'amberfall-leaf-litter';
  return material;
}

export function timberMaterial(maps, color) {
  return new THREE.MeshStandardMaterial({ map: maps.timber, normalMap: maps.timberNormal, normalScale: new THREE.Vector2(.45, .45), roughnessMap: maps.timberRough, color, roughness: .85, envMapIntensity: .7 });
}

export function mountainStone(maps) {
  const material = new THREE.MeshStandardMaterial({ color: '#e5e8e9', map: maps.alpine, vertexColors: true, roughness: .92, envMapIntensity: .65 });
  material.onBeforeCompile = shader => {
    shader.uniforms.alpineNormalMap = { value: maps.rockNormal };
    shader.uniforms.alpineRoughMap = { value: maps.rockRough };
    shader.vertexShader = `attribute float alpineCavity; varying float ridgeCavity;
      varying vec3 ridgePosition, ridgeNormal;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nridgePosition=position; ridgeNormal=normal; ridgeCavity=alpineCavity;');
    shader.fragmentShader = `varying vec3 ridgePosition, ridgeNormal; varying float ridgeCavity;
      uniform sampler2D alpineNormalMap,alpineRoughMap;
      ${surfaceDetail}
      ${shader.fragmentShader}`
      .replace('#include <map_fragment>', `
        vec3 weight=projectionWeights(ridgeNormal);
        vec3 p=ridgePosition*vec3(.012,.019,.012);
        float warp=detailNoise(ridgePosition*.006);
        p+=vec3(warp*.17,warp*.29,warp*.11);
        vec4 sampledDiffuseColor=projectSurface(map,p,weight);
        vec3 broad=projectSurface(map,p*3.73+vec3(.31,.71,.13),weight).rgb;
        sampledDiffuseColor.rgb=mix(sampledDiffuseColor.rgb,broad,.28);
        diffuseColor*=sampledDiffuseColor;
        float mineral=detailNoise(ridgePosition*vec3(.009,.021,.009));
        float bedding=detailNoise(vec3(ridgePosition.x*.013,ridgePosition.y*.11+warp*3.,ridgePosition.z*.017));
        diffuseColor.rgb*=mix(vec3(.77,.83,.9),vec3(1.2,1.08,.9),mineral)*(.77+bedding*.32);
        diffuseColor.rgb*=1.-max(0.,ridgeCavity)*.25;
        float slope=normalize(ridgeNormal).y;
        float grit=detailNoise(ridgePosition*.21);
        float drift=detailNoise(ridgePosition*.037)*.65+detailNoise(ridgePosition*.12)*.35;
        float snowLine=420.+(drift-.5)*120.-max(ridgeCavity,0.)*115.;
        float altitude=smoothstep(snowLine-35.,snowLine+100.,ridgePosition.y);
        float holding=smoothstep(.28,.84,slope+ridgeCavity*.18);
        float snow=smoothstep(.25,.66,altitude*holding+max(ridgeCavity,0.)*altitude*.3);
        snow*=smoothstep(.08,.27,drift+altitude*.35);
        vec3 snowColor=mix(vec3(.65,.74,.82),vec3(.91,.94,.96),grit*.4+.6);
        diffuseColor.rgb=mix(diffuseColor.rgb,snowColor,snow);
        float sediment=smoothstep(.81,.96,slope)*(1.-snow)*(1.-smoothstep(210.,460.,ridgePosition.y));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.26,.245,.22)*(.8+grit*.25),sediment*.48);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor=mix(clamp(projectSurface(alpineRoughMap,p*1.7,weight).g*.65+.3,.65,1.),.83,snow);`)
      .replace('#include <normal_fragment_maps>', `
        vec3 rockSurface=projectedNormal(alpineNormalMap,p*1.7,weight,normal,-vViewPosition,.75);
        normal=normalize(mix(rockSurface,normal,snow*.93));
        float rockRelief=dot(sampledDiffuseColor.rgb,vec3(.333))*(1.-snow)*5.5;
        normal=reliefNormal(normal,-vViewPosition,rockRelief);`);
  };
  material.customProgramCacheKey = () => 'autumn-alpine-eroded-pbr-snow-v2';
  return material;
}

export function weatheredPlaster() {
  const material = new THREE.MeshStandardMaterial({ color: '#c5bfa8', roughness: .94 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = `varying vec3 vWall;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWall=position;');
    shader.fragmentShader = `varying vec3 vWall;\n${shader.fragmentShader}`.replace('#include <color_fragment>', `#include <color_fragment>
      float streak=sin(vWall.x*1.3+vWall.z*.9+sin(vWall.y*.7))*.5+.5;
      float mottling=sin(vWall.x*9.+vWall.z*7.)*sin(vWall.y*6.);
      diffuseColor.rgb*=.94+mottling*.018-streak*.06;
    `);
  };
  return material;
}
