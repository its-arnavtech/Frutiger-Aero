import * as THREE from 'three';

export async function loadAutumnMaterials(load) {
  const sources = {
    leafGround: ['/assets/autumn/leaves_forest_ground_diff_1k.jpg', true],
    leafRough: ['/assets/autumn/leaves_forest_ground_rough_1k.jpg'],
    timber: ['/assets/autumn/weathered_brown_planks_diff_1k.jpg', true],
    timberNormal: ['/assets/autumn/weathered_brown_planks_nor_gl_1k.jpg'],
    timberRough: ['/assets/autumn/weathered_brown_planks_rough_1k.jpg'],
    rock: ['/assets/materials/marble_cliff_02_diff_1k.jpg', true],
    rockNormal: ['/assets/materials/marble_cliff_02_nor_gl_1k.jpg'],
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

export function mountainStone(map) {
  const material = new THREE.MeshStandardMaterial({ color: '#c7cdd0', map, vertexColors: true, roughness: .92, envMapIntensity: .6 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = `varying vec3 ridgePosition, ridgeNormal;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nridgePosition=position; ridgeNormal=normal;');
    shader.fragmentShader = `varying vec3 ridgePosition, ridgeNormal;
      float mountainHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float mountainNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mountainHash(i),mountainHash(i+vec2(1,0)),f.x),mix(mountainHash(i+vec2(0,1)),mountainHash(i+vec2(1,1)),f.x),f.y);}
      ${shader.fragmentShader}`
      .replace('#include <map_fragment>', `
        vec3 weight=pow(abs(normalize(ridgeNormal)),vec3(4.)); weight/=dot(weight,vec3(1.));
        vec3 p=ridgePosition*vec3(.016,.026,.016);
        p+=vec3(mountainNoise(ridgePosition.yz*.007),mountainNoise(ridgePosition.xz*.006),mountainNoise(ridgePosition.xy*.009))*.32;
        vec4 sampledDiffuseColor=texture2D(map,p.yz)*weight.x+texture2D(map,p.xz)*weight.y+texture2D(map,p.xy)*weight.z;
        vec3 broad=texture2D(map,p.yz*.283+vec2(.31,.71)).rgb*weight.x+texture2D(map,p.xz*.283+vec2(.51,.13)).rgb*weight.y+texture2D(map,p.xy*.283+vec2(.81,.37)).rgb*weight.z;
        sampledDiffuseColor.rgb=mix(sampledDiffuseColor.rgb,broad,.22);
        diffuseColor*=sampledDiffuseColor;
        float mineral=mountainNoise(ridgePosition.xy*.006+vec2(ridgePosition.z*.002,0.));
        diffuseColor.rgb*=mix(vec3(.78,.84,.9),vec3(1.14,1.05,.89),mineral);
        float slope=normalize(ridgeNormal).y;
        float altitude=smoothstep(330.,620.,ridgePosition.y);
        float drift=mountainNoise(ridgePosition.xz*.027);
        float scree=mountainNoise(ridgePosition.xz*.18)*.6+mountainNoise(ridgePosition.xy*.41)*.4;
        float snow=smoothstep(.43,.72,altitude*.66+drift*.34)*smoothstep(.25,.76,slope);
        snow=smoothstep(.18,.61,snow-(1.-scree)*.23);
        diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.36,.45,.53),vec3(.61,.68,.73),scree),snow);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        float rockRelief=dot(sampledDiffuseColor.rgb,vec3(.333));
        vec3 rx=dFdx(-vViewPosition), ry=dFdy(-vViewPosition), r1=cross(ry,normal), r2=cross(normal,rx);
        float determinant=dot(rx,r1);
        normal=normalize(abs(determinant)*normal-sign(determinant)*(.2*(1.-snow)+.015)*(dFdx(rockRelief)*r1+dFdy(rockRelief)*r2));`);
  };
  material.customProgramCacheKey = () => 'autumn-alpine-snow-stone';
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
