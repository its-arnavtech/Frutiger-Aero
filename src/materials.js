import * as THREE from 'three';
import { islandHeight, smoothstep } from './journey';
const TAU = Math.PI * 2;

export function skyMaterial(sun) {
  return new THREE.ShaderMaterial({
    uniforms: {sun: {value: sun}}, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vWorld; void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 vWorld; uniform vec3 sun;
    void main(){vec3 d=normalize(vWorld);float h=max(d.y,0.);vec3 c=mix(vec3(.29,.71,.93),vec3(.008,.16,.61),pow(h,.42));
    float s=max(dot(d,sun),0.);c+=vec3(1.,.88,.62)*pow(s,130.)*.6;c+=vec3(1.,.98,.9)*pow(s,1600.)*3.;
    gl_FragColor=vec4(c,1.);
    #include <colorspace_fragment>
    }`,
  });
}
export function normalTexture() {
  const n = 256, data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = x / n * TAU, v = y / n * TAU;
    const dx = Math.cos(u * 7 + Math.sin(v * 4)) * .24 + Math.cos(u * 17 + v * 13) * .15;
    const dy = Math.sin(v * 9 + Math.cos(u * 3)) * .24 + Math.sin(v * 19 - u * 11) * .15;
    const i = (y * n + x) * 4;
    data[i] = 128 + dx * 127; data[i + 1] = 128 + dy * 127; data[i + 2] = 248; data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, n, n);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = texture.minFilter = THREE.LinearFilter; texture.needsUpdate = true; return texture;
}
export function cloudTexture(random) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < 38; i++) {
    const along=random(),x=90+along*330,y=153-Math.sin(along*Math.PI)*48+(random()-.5)*28,radius=30+random()*44;
    const gradient = ctx.createRadialGradient(x, y, radius * .12, x, y, radius);
    gradient.addColorStop(0, 'rgba(255,255,255,.95)'); gradient.addColorStop(.5, 'rgba(255,255,255,.7)'); gradient.addColorStop(1, 'rgba(230,250,255,0)');
    ctx.fillStyle = gradient; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  return new THREE.CanvasTexture(canvas);
}
export function makeTerrain(island) {
  const rings = 30, segments = 112, vertices = [], colors = [], indices = [];
  const color = new THREE.Color(), green = new THREE.Color('#69bc20'), sand = new THREE.Color('#f1e9c7');
  for (let r = 0; r <= rings; r++) for (let a = 0; a <= segments; a++) {
    const angle = a / segments * TAU, radius = r / rings;
    const edge = 1 + .07 * Math.sin(angle * 5 + island.seed) + .035 * Math.sin(angle * 9);
    const x = island.x + Math.cos(angle) * radius * island.rx * edge, z = island.z + Math.sin(angle) * radius * island.rz * edge;
    const y = islandHeight(island, x, z); vertices.push(x, y, z);
    color.copy(sand).lerp(green, smoothstep(.03, .8, y));
    color.multiplyScalar(.86 + .14 * Math.sin(x * .9) * Math.sin(z * 1.4) + .09 * Math.cos(x * 3 + z));
    colors.push(color.r, color.g, color.b);
    if (r < rings && a < segments) { const i = r * (segments + 1) + a; indices.push(i, i + 1, i + segments + 1, i + 1, i + segments + 2, i + segments + 1); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
export function bubbleMaterial() {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    vertexShader: `varying vec3 n; varying vec3 view; varying vec3 world; void main(){vec4 p=modelMatrix*vec4(position,1.);world=p.xyz;n=normalize(mat3(modelMatrix)*normal);view=normalize(cameraPosition-p.xyz);gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader: `varying vec3 n;varying vec3 view;varying vec3 world;
    void main(){vec3 normal=normalize(n);float f=pow(1.-abs(dot(normal,normalize(view))),2.8);vec3 reflected=reflect(-normalize(view),normal);
    vec3 sky=mix(vec3(.55,.88,.98),vec3(.12,.5,.96),max(reflected.y,0.));vec3 rainbow=.6+.4*cos(vec3(0.,2.,4.)+f*13.+world.y*.06);
    float highlight=pow(max(dot(normal,normalize(vec3(-.5,.8,.6))),0.),70.);vec3 color=mix(sky,rainbow,.4*f)+highlight*.6;
    gl_FragColor=vec4(color,.025+f*.85+highlight*.8);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`,
  });
}
