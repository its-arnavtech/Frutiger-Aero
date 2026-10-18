import * as THREE from 'three';

export async function loadMaterials(load) {
  const sources = { rock: ['/assets/monsoon/wet-slate.png', true], pebbles: ['/assets/monsoon/glacial-pebbles.png', true], normal: ['/assets/materials/marble_cliff_02_nor_gl_1k.jpg'], water: ['/assets/materials/waternormals.jpg'] };
  return Object.fromEntries(await Promise.all(Object.entries(sources).map(async ([name, [url, color]]) => {
    const texture = await load(url); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    if (color) texture.colorSpace = THREE.SRGBColorSpace;
    return [name, texture];
  })));
}

export function cirqueMaterial(rockMap, pebbleMap) {
  const material = new THREE.MeshStandardMaterial({ map: rockMap, roughness: .78, color: '#d3d1c9', envMapIntensity: .6 });
  material.onBeforeCompile = shader => {
    shader.uniforms.pebbleMap = { value: pebbleMap };
    shader.vertexShader = `varying vec3 vCliff, vSlope;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCliff=position; vSlope=normal;');
    shader.fragmentShader = `varying vec3 vCliff, vSlope; uniform sampler2D pebbleMap;
      float nHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float nValue(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(nHash(i),nHash(i+vec2(1,0)),f.x),mix(nHash(i+vec2(0,1)),nHash(i+vec2(1,1)),f.x),f.y);}
      ${shader.fragmentShader}`
      .replace('#include <map_fragment>', `
        vec3 weights=pow(abs(normalize(vSlope)),vec3(6.)); weights/=dot(weights,vec3(1.));
        vec3 p=vCliff*.04;
        vec4 sampledDiffuseColor=texture2D(map,p.zy)*weights.x+texture2D(map,p.xz)*weights.y+texture2D(map,p.xy)*weights.z;
        float sediment=smoothstep(.55,.9,normalize(vSlope).y)*(1.-smoothstep(2.,18.,vCliff.y));
        sampledDiffuseColor=mix(sampledDiffuseColor,texture2D(pebbleMap,vCliff.xz*.28),sediment);
        vec3 macro=texture2D(map,p.xz*.16).rgb;
        diffuseColor*=sampledDiffuseColor;
        float seam=.5+.5*sin(vCliff.y*.82+nValue(vCliff.xz*.03)*3.);
        diffuseColor.rgb*=mix(.92,1.5,nValue(vCliff.xz*.038))+seam*.12;
        diffuseColor.rgb*=mix(vec3(.85,.89,.89),vec3(1.22,1.15,1.05),macro);
        float slope=normalize(vSlope).y;
        float fields=nValue(vCliff.xz*.018)+nValue(vCliff.xz*.075)*.25;
        float bands=exp(-pow((vCliff.y-27.)/13.,2.))+exp(-pow((vCliff.y-91.)/12.,2.))*.8+exp(-pow((vCliff.y-149.)/10.,2.))*.55;
        float snow=smoothstep(.67,.78,fields+bands*.14)*smoothstep(.25,.6,slope)*smoothstep(2.,12.,vCliff.y);
        snow*=1.-smoothstep(100.,210.,vCliff.z);
        snow=smoothstep(.38,.47,snow+nValue(vCliff.xz*.7)*.025);
        vec3 ice=mix(vec3(.57,.65,.67),vec3(.79,.83,.83),nValue(vCliff.xz*.4));
        diffuseColor.rgb=mix(diffuseColor.rgb,ice,snow);
        float wet=1.-smoothstep(-.5,2.8,vCliff.y);
        diffuseColor.rgb*=1.-wet*.25;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(mix(.34,.74,smoothstep(0.,8.,vCliff.y)),.94,snow);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        float detail=dot(sampledDiffuseColor.rgb,vec3(.333));
        vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition),r1=cross(dy,normal),r2=cross(normal,dx);float det=dot(dx,r1);
        normal=normalize(abs(det)*normal-sign(det)*(.22*(1.-snow)+.015)*(dFdx(detail)*r1+dFdy(detail)*r2));`);
  };
  material.customProgramCacheKey = () => 'monsoon-stratified-cirque-v1';
  return material;
}
