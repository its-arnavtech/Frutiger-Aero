import * as THREE from 'three';

export async function loadMaterials(load) {
  const sources = { rock: ['/assets/monsoon/wet-slate.png', true], pebbles: ['/assets/monsoon/glacial-pebbles.png', true], normal: ['/assets/materials/marble_cliff_02_nor_gl_1k.jpg'], water: ['/assets/materials/waternormals.jpg'], grass: ['/assets/materials/grass_ground_diff_1k.jpg', true], sky: ['/assets/environment/kloofendal_48d_partly_cloudy_puresky_4k.jpg', true] };
  return Object.fromEntries(await Promise.all(Object.entries(sources).map(async ([name, [url, color]]) => {
    const texture = await load(url); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    if (color) texture.colorSpace = THREE.SRGBColorSpace;
    return [name, texture];
  })));
}

export function cirqueMaterial(maps) {
  const material = new THREE.MeshStandardMaterial({ map: maps.rock, vertexColors: true, roughness: .83, color: '#e0dfd6', envMapIntensity: .65 });
  material.onBeforeCompile = shader => {
    shader.uniforms.pebbleMap = { value: maps.pebbles };
    shader.uniforms.grassMap = { value: maps.grass };
    shader.vertexShader = `attribute vec2 mountainHabitat; varying vec2 vHabitat; varying vec3 vCliff, vSlope;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCliff=position; vSlope=normal; vHabitat=mountainHabitat;');
    shader.fragmentShader = `varying vec2 vHabitat; varying vec3 vCliff, vSlope; uniform sampler2D pebbleMap, grassMap;
      float nHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float nValue(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(nHash(i),nHash(i+vec2(1,0)),f.x),mix(nHash(i+vec2(0,1)),nHash(i+vec2(1,1)),f.x),f.y);}
      ${shader.fragmentShader}`
      .replace('#include <map_fragment>', `
        vec3 weights=pow(abs(normalize(vSlope)),vec3(6.)); weights/=dot(weights,vec3(1.));
        vec3 p=vCliff*.12;
        p+=vec3(nValue(vCliff.yz*.013),nValue(vCliff.xz*.017),nValue(vCliff.xy*.011))*.65;
        vec4 sampledDiffuseColor=texture2D(map,p.zy)*weights.x+texture2D(map,p.xz)*weights.y+texture2D(map,p.xy)*weights.z;
        vec3 mineral=texture2D(map,p.zy*.371+vec2(.29,.73)).rgb*weights.x+texture2D(map,p.xz*.371+vec2(.61,.17)).rgb*weights.y+texture2D(map,p.xy*.371+vec2(.83,.43)).rgb*weights.z;
        sampledDiffuseColor.rgb=mix(sampledDiffuseColor.rgb,mineral,.32);
        float sediment=smoothstep(.55,.9,normalize(vSlope).y)*(1.-smoothstep(2.,18.,vCliff.y));
        sampledDiffuseColor=mix(sampledDiffuseColor,texture2D(pebbleMap,vCliff.xz*.28),sediment);
        vec3 macro=texture2D(map,p.xz*.16).rgb;
        diffuseColor*=sampledDiffuseColor;
        float bedding=vCliff.y*.19+vCliff.x*.065+nValue(vCliff.xz*.009)*9.;
        float seam=smoothstep(.78,.96,.5+.5*sin(bedding));
        diffuseColor.rgb*=mix(.86,1.18,nValue(vCliff.xz*.014))-seam*.10;
        diffuseColor.rgb*=mix(vec3(.85,.89,.89),vec3(1.22,1.15,1.05),macro);
        float slope=normalize(vSlope).y;
        // Broad slope and concavity survive fine rock relief: snow stays in
        // sheltered couloirs while protruding ribs remain exposed grey stone.
        float fields=nValue(vCliff.xz*.022)*.7+nValue(vCliff.xz*.083)*.3;
        float snowline=420.+(fields-.5)*75.-vHabitat.y*85.;
        float accumulation=smoothstep(snowline-18.,snowline+24.,vCliff.y);
        float retention=smoothstep(.16,.56,vHabitat.x+vHabitat.y*.2);
        float snow=accumulation*retention;
        snow=smoothstep(.24,.70,snow+(nValue(vCliff.xz*.42)-.5)*.065);
        vec3 ice=mix(vec3(.73,.82,.88),vec3(.96,.975,.98),nValue(vCliff.xz*.16));
        float meadow=smoothstep(.49,.85,vHabitat.x)*(1.-smoothstep(95.,260.,vCliff.y))*smoothstep(1.2,6.,vCliff.y);
        vec3 grass=texture2D(grassMap,vCliff.xz*.16).rgb*vec3(.65,.83,.53);
        grass*=.8+nValue(vCliff.xz*.025)*.42;
        diffuseColor.rgb=mix(diffuseColor.rgb,grass,meadow*.94);
        diffuseColor.rgb=mix(diffuseColor.rgb,ice,snow);
        float wet=1.-smoothstep(-.5,2.8,vCliff.y);
        diffuseColor.rgb*=1.-wet*.25;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(mix(.34,.74,smoothstep(0.,8.,vCliff.y)),.94,snow);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        float detail=dot(sampledDiffuseColor.rgb,vec3(.333));
        vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition),r1=cross(dy,normal),r2=cross(normal,dx);float det=dot(dx,r1);
        normal=normalize(abs(det)*normal-sign(det)*(.22*(1.-snow)+.015)*(dFdx(detail)*r1+dFdy(detail)*r2));`);
  };
  material.customProgramCacheKey = () => 'monsoon-eroded-massif-v3';
  return material;
}
