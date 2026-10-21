import * as THREE from 'three';
import { surfaceDetail } from '../autumn/surface-detail.js';

export async function loadMaterials(load) {
  const sources = {
    rock: ['/assets/monsoon/rock_face_diff_2k.jpg', true],
    rockNormal: ['/assets/monsoon/rock_face_nor_gl_2k.jpg'],
    rockRough: ['/assets/monsoon/rock_face_rough_1k.jpg'],
    sand: ['/assets/materials/coast_sand_01_diff_1k.jpg', true],
    sandNormal: ['/assets/materials/coast_sand_01_nor_gl_1k.jpg'],
    water: ['/assets/materials/waternormals.jpg'],
    grass: ['/assets/materials/grass_ground_diff_1k.jpg', true],
    grassNormal: ['/assets/materials/grass_ground_nor_gl_1k.jpg'],
    sky: ['/assets/environment/kloofendal_48d_partly_cloudy_puresky_4k.jpg', true],
  };
  return Object.fromEntries(await Promise.all(Object.entries(sources).map(async ([name, [url, color]]) => {
    const texture = await load(url); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    if (color) texture.colorSpace = THREE.SRGBColorSpace;
    return [name, texture];
  })));
}

export function cirqueMaterial(maps) {
  const material = new THREE.MeshStandardMaterial({ map: maps.rock, vertexColors: true, roughness: .92, color: '#ffffff', envMapIntensity: .5 });
  material.onBeforeCompile = shader => {
    shader.uniforms.grassMap = { value: maps.grass };
    for (const name of ['rockNormal', 'rockRough', 'grassNormal', 'sand', 'sandNormal']) shader.uniforms[name] = { value: maps[name] };
    shader.vertexShader = `attribute vec2 mountainHabitat; varying vec2 vHabitat; varying vec3 vCliff, vSlope;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCliff=position; vSlope=normal; vHabitat=mountainHabitat;');
    shader.fragmentShader = `varying vec2 vHabitat; varying vec3 vCliff, vSlope; uniform sampler2D grassMap,rockNormal,rockRough,grassNormal,sand,sandNormal;
      ${surfaceDetail}
      float nHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float nValue(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(nHash(i),nHash(i+vec2(1,0)),f.x),mix(nHash(i+vec2(0,1)),nHash(i+vec2(1,1)),f.x),f.y);}
      ${shader.fragmentShader}`
      .replace('#include <map_fragment>', `
        vec3 weights=pow(abs(normalize(vSlope)),vec3(6.)); weights/=dot(weights,vec3(1.));
        vec3 p=vCliff*.018;
        p+=vec3(nValue(vCliff.yz*.013),nValue(vCliff.xz*.017),nValue(vCliff.xy*.011))*.65;
        vec4 sampledDiffuseColor=texture2D(map,p.zy)*weights.x+texture2D(map,p.xz)*weights.y+texture2D(map,p.xy)*weights.z;
        vec3 mineral=texture2D(map,p.zy*.371+vec2(.29,.73)).rgb*weights.x+texture2D(map,p.xz*.371+vec2(.61,.17)).rgb*weights.y+texture2D(map,p.xy*.371+vec2(.83,.43)).rgb*weights.z;
        vec3 fineRock=projectSurface(map,vCliff*.22,weights).rgb;
        sampledDiffuseColor.rgb=mix(sampledDiffuseColor.rgb,mineral,.20)*(.8+fineRock*.65);
        float grey=dot(sampledDiffuseColor.rgb,vec3(.2126,.7152,.0722));
        diffuseColor.rgb*=mix(sampledDiffuseColor.rgb,vec3(grey)*vec3(.89,.96,1.06),.76);
        diffuseColor.rgb*=mix(.84,1.08,nValue(vCliff.xz*.012));
        float slope=normalize(vSlope).y;
        // Broad slope and concavity survive fine rock relief: snow stays in
        // sheltered couloirs while protruding ribs remain exposed grey stone.
        float fields=nValue(vCliff.xz*.022)*.7+nValue(vCliff.xz*.083)*.3;
        float snowline=570.+(fields-.5)*90.-vHabitat.y*50.;
        float accumulation=smoothstep(snowline-18.,snowline+24.,vCliff.y);
        float retention=smoothstep(.16,.56,vHabitat.x+vHabitat.y*.2);
        float snow=accumulation*retention;
        snow=smoothstep(.24,.70,snow+(nValue(vCliff.xz*.42)-.5)*.065);
        snow=max(snow,smoothstep(630.,690.,vCliff.y)*smoothstep(.08,.35,vHabitat.x));
        vec3 ice=mix(vec3(.73,.82,.88),vec3(.96,.975,.98),nValue(vCliff.xz*.16));
        float treeline=360.+(nValue(vCliff.xz*.009)-.5)*130.;
        float meadow=smoothstep(.25,.67,vHabitat.x+vHabitat.y*.09)*(1.-smoothstep(treeline,treeline+130.,vCliff.y))*smoothstep(.35,2.,vCliff.y);
        vec3 grassTex=texture2D(grassMap,vCliff.xz*.32).rgb;
        vec3 grass=mix(grassTex*vec3(.64,1.13,.48),vec3(.12,.23,.035),.25);
        grass*=.77+nValue(vCliff.xz*.032)*.48;
        diffuseColor.rgb=mix(diffuseColor.rgb,grass,meadow);
        float sediment=(1.-smoothstep(.25,2.4+fields*2.,vCliff.y))*smoothstep(.5,.85,slope);
        vec3 sandColor=texture2D(sand,vCliff.xz*.22).rgb*vec3(.66,.68,.62);
        diffuseColor.rgb=mix(diffuseColor.rgb,sandColor,sediment);
        diffuseColor.rgb=mix(diffuseColor.rgb,ice,snow);
        float wet=1.-smoothstep(-.5,2.8,vCliff.y);
        diffuseColor.rgb*=1.-wet*.25;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(clamp(projectSurface(rockRough,p,weights).g,.65,1.),.96,meadow); roughnessFactor=mix(roughnessFactor,.4,wet); roughnessFactor=mix(roughnessFactor,.94,snow);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 stoneN=projectedNormal(rockNormal,p,weights,normal,-vViewPosition,1.1);
        stoneN=normalize(mix(stoneN,projectedNormal(rockNormal,vCliff*.22,weights,normal,-vViewPosition,.55),.3));
        vec3 grassN=projectedNormal(grassNormal,vCliff*.32,weights,normal,-vViewPosition,.6);
        normal=normalize(mix(stoneN,grassN,meadow));
        vec3 sandN=projectedNormal(sandNormal,vCliff*.22,weights,normal,-vViewPosition,.28);
        normal=normalize(mix(normal,sandN,sediment));
        normal=normalize(mix(normal,nonPerturbedNormal,snow*.85));`);
  };
  material.customProgramCacheKey = () => 'monsoon-surveyed-green-alpine-v4';
  return material;
}
