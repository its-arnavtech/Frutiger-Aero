import * as THREE from 'three';
import { terrainHeight, rng, streams } from './layout.js';

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
  const cascadeMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { time: clock },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vUv;uniform float time;void main(){
      float edge=pow(sin(vUv.x*3.14159),.7);float streak=.55+.25*sin(vUv.x*83.+sin(vUv.y*34.-time*3.));
      float rush=.7+.3*sin(vUv.y*230.-time*18.+vUv.x*11.);float a=edge*streak*rush;
      gl_FragColor=vec4(.68,.78,.80,a*.8);}`,
  });
  for (const stream of streams) {
    const vertices = [], uvs = [], indices = [];
    const dx = stream.to[0] - stream.from[0], dz = stream.to[1] - stream.from[1], length = Math.hypot(dx, dz), nx = -dz / length, nz = dx / length;
    for (let i = 0; i <= 240; i++) {
      const t = i / 240, x = stream.from[0] + dx * t + Math.sin(t * 9) * .8, z = stream.from[1] + dz * t;
      const width = stream.width * (.5 + t * .5);
      for (const side of [-1, 1]) {
        const sx=x+nx*width*side,sz=z+nz*width*side;
        vertices.push(sx,Math.max(.12,surfaceHeight(sx,sz)+.14),sz);uvs.push((side+1)/2,t);
      }
      if (i < 240) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(indices); g.computeVertexNormals();
    const fall = new THREE.Mesh(g, cascadeMaterial); fall.name = 'Snowmelt cascade'; scene.add(fall);
  }
  return { count, update(time, camera) { clock.value = time; centre.value.copy(camera.position); for (const veil of veils) veil.quaternion.copy(camera.quaternion); } };
}
