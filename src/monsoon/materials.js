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
  const material = new THREE.MeshStandardMaterial({ map: maps.rock, roughness: .83, color: '#e0dfd6', envMapIntensity: .75 });
  material.onBeforeCompile = shader => {
    shader.uniforms.pebbleMap = { value: maps.pebbles };
    shader.uniforms.grassMap = { value: maps.grass };
    shader.vertexShader = `varying vec3 vCliff, vSlope;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCliff=position; vSlope=normal;');
    shader.fragmentShader = `varying vec3 vCliff, vSlope; uniform sampler2D pebbleMap, grassMap;
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
        float seam=.5+.5*sin(vCliff.y*.46+vCliff.x*.18+nValue(vCliff.xz*.02)*5.);
        diffuseColor.rgb*=mix(.90,1.28,nValue(vCliff.xz*.014))+seam*.10;
        diffuseColor.rgb*=mix(vec3(.85,.89,.89),vec3(1.22,1.15,1.05),macro);
        float slope=normalize(vSlope).y;
        float fields=nValue(vCliff.xz*.018)+nValue(vCliff.xz*.075)*.25;
        float altitude=smoothstep(280.,550.,vCliff.y);
        float snow=smoothstep(.49,.63,fields*.45+altitude*.55)*smoothstep(.18,.65,slope);
        snow=smoothstep(.22,.56,snow+nValue(vCliff.xz*.35)*.04);
        vec3 ice=mix(vec3(.62,.74,.81),vec3(.91,.93,.94),nValue(vCliff.xz*.12));
        float meadow=smoothstep(.45,.84,slope)*(1.-smoothstep(75.,200.,vCliff.y))*smoothstep(1.2,6.,vCliff.y);
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
  material.customProgramCacheKey = () => 'monsoon-open-massif-v2';
  return material;
}
