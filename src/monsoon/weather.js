import * as THREE from 'three';
import { terrainHeight, rng } from './layout.js';
import { createWaterfalls } from './waterfalls.js';

export function createWeather(scene, profile, surfaceHeight = terrainHeight) {
  const clock = { value: 0 }, centre = { value: new THREE.Vector3() }, random = rng(3921);
  const count = profile.low ? 600 : profile.mobile ? 1000 : 2000;
  const geometry = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1));
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) seeds.set([random() * 110, random() * 65, random() * 110, random()], i * 4);
  geometry.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds, 4)); geometry.instanceCount = count;
  const rain = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { time: clock, centre },
    vertexShader: `attribute vec4 seed;uniform float time;uniform vec3 centre;varying vec2 vUv;varying float fade;
      void main(){vUv=uv;vec3 p=seed.xyz;
        p.xz=mod(p.xz+vec2(time*1.8,time*.45)-centre.xz+55.,110.)-55.+centre.xz;
        p.y=mod(p.y-time*(24.+seed.w*9.)-centre.y+18.,65.)-18.+centre.y;
        float distance=length(p-centre);fade=(1.-smoothstep(30.,55.,distance))*.14;
        fade*=smoothstep(.1,1.,p.y);
        vec4 mv=modelViewMatrix*vec4(p,1.);mv.xy+=vec2(position.x*(.015+seed.w*.013)-position.y*.1,position.y*(.8+seed.w*.8));
        gl_Position=projectionMatrix*mv;}`,
    fragmentShader: 'varying vec2 vUv;varying float fade;void main(){float a=sin(vUv.y*3.14159)*(1.-abs(vUv.x-.5)*2.);gl_FragColor=vec4(.72,.81,.83,a*fade);}',
  }));
  rain.frustumCulled = false; rain.layers.set(1); rain.renderOrder = 4; rain.name = 'Wind-driven rainfall'; scene.add(rain);

  const haze = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { time: clock },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vUv;uniform float time;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      void main(){vec2 p=vUv*vec2(5.,3.);float f=n(p+vec2(time*.025,0.))*.7+n(p*2.-time*.015)*.3;
        float edge=pow(max(0.,1.-length((vUv-.5)*2.)),1.8);gl_FragColor=vec4(.74,.82,.85,edge*f*.16);}`,
  });
  const veils = [];
  for (let i = 0; i < 9; i++) {
    const x = -320 + i * 80, z = -590 - random() * 180;
    const veil = new THREE.Mesh(new THREE.PlaneGeometry(190 + random() * 90, 22 + random() * 32), haze);
    veil.position.set(x, Math.max(terrainHeight(x, z) + 18, 12) + random() * 28, z); veil.layers.set(1); veil.renderOrder = 3; veil.name = 'Drifting mountain mist'; scene.add(veil); veils.push(veil);
  }
  const waterfalls=createWaterfalls(scene,profile,surfaceHeight);
  return { count, waterfalls, update(time, camera) { clock.value = time; centre.value.copy(camera.position); waterfalls.update(time,camera); for (const veil of veils) veil.quaternion.copy(camera.quaternion); } };
}
