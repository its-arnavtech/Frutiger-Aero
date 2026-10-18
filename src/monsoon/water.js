import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { terrainHeight, terrainBounds, lake, clamp } from './layout.js';

export function createLake(scene, maps, profile, signal) {
  const { width, depth: extent, centerZ } = terrainBounds;
  const water = new Water(new THREE.PlaneGeometry(width, extent), {
    textureWidth: profile.mirrorSize, textureHeight: profile.mirrorSize,
    waterNormals: maps.water, sunDirection: new THREE.Vector3(-.35, .8, -.4).normalize(), fog: true,
  });
  const size = 512, heights = new Uint8Array(size * size);
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) heights[z * size + x] = Math.round(clamp(-terrainHeight(x / (size - 1) * width - width / 2, z / (size - 1) * extent + centerZ - extent / 2) / lake.depth) * 255);
  const depth = new THREE.DataTexture(heights, size, size, THREE.RedFormat); depth.minFilter = depth.magFilter = THREE.LinearFilter; depth.needsUpdate = true;
  water.material.uniforms.lakeDepth = { value: depth };
  water.material.uniforms.lakeBounds = { value: new THREE.Vector4(width / 2, extent / 2 - centerZ, width, extent) };
  water.material.uniforms.maxDepth = { value: lake.depth };
  water.material.transparent = true; water.material.depthWrite = false;
  water.material.fragmentShader = `
    uniform sampler2D mirrorSampler,normalSampler,lakeDepth; uniform float time,maxDepth; uniform vec3 eye; uniform vec4 lakeBounds;
    varying vec4 mirrorCoord,worldPosition;
    #include <common>
    #include <fog_pars_fragment>
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    vec2 rainRing(vec2 p){
      vec2 cell=floor(p),f=fract(p),offset=vec2(hash(cell),hash(cell+7.3));
      vec2 d=f-(.2+offset*.6);float dist=length(d),age=fract(time*.8+hash(cell+3.));
      float wave=sin((dist-age*.5)*85.)*exp(-pow((dist-age*.5)*22.,2.))*(1.-age)*smoothstep(0.,.13,age);
      return normalize(d+vec2(.0001))*wave;
    }
    void main(){
      vec2 p=worldPosition.xz;vec3 toEye=eye-worldPosition.xyz;float range=length(toEye);vec3 view=toEye/range;
      vec2 broad=texture2D(normalSampler,p*.025+time*vec2(.004,.007)).xy-.5;
      vec2 fine=texture2D(normalSampler,p*.27+time*vec2(-.014,.008)).xy-.5;
      vec2 ring=rainRing(p*.72)+rainRing(p*.72+vec2(.5,.7));
      vec2 slope=(broad*.07+fine*.028+ring*.009)/(1.+range*.0018);
      vec3 normal=normalize(vec3(slope.x,1.,slope.y));float facing=max(dot(view,normal),0.);
      float fresnel=.025+.975*pow(1.-facing,5.);
      vec3 reflection=texture2D(mirrorSampler,mirrorCoord.xy/mirrorCoord.w+slope*.025).rgb;
      float depth=texture2D(lakeDepth,(p+lakeBounds.xy)/lakeBounds.zw).r*maxDepth;
      float distanceInWater=depth/max(facing,.22);
      float absorption=1.-exp(-distanceInWater*.12);
      float alpha=clamp(fresnel+absorption*(1.-fresnel),.045,.98);
      vec3 body=mix(vec3(.028,.17,.15),vec3(.012,.064,.077),smoothstep(2.,18.,depth));
      vec3 color=(reflection*fresnel+body*absorption*(1.-fresnel))/max(alpha,.001);
      color+=vec3(.025)*max(0.,ring.x)*exp(-range*.012);
      gl_FragColor=vec4(color,alpha);
      #include <fog_fragment>
    }`;
  water.rotation.x = -Math.PI / 2; water.position.z = centerZ; water.renderOrder = 2; water.name = 'Clear glacial water with rain rings'; scene.add(water);
  signal.addEventListener('abort', () => depth.dispose(), { once: true });
  return { update(time) { water.material.uniforms.time.value = time; } };
}
