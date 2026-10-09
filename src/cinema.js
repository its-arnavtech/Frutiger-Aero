import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

// The film pipeline. The world is rendered once into an HDR target with depth;
// ambient occlusion and a soft optical bloom are derived from it, and a final
// pass grades the picture for the display. Edges are smoothed either by
// multisampling, on GPUs with room for it, or by FXAA on the graded picture,
// which costs integrated graphics far less and so buys a sharper resolution.
const vertexShader = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
const pass = (fragmentShader, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped: false, ...extra });

const occlusionShader = /* glsl */`
  precision highp float;
  uniform highp sampler2D tDepth; uniform mat4 projection; uniform mat4 unprojection; uniform vec2 texel; uniform float radius; uniform float strength;
  varying vec2 vUv;
  vec3 eyePoint(vec2 uv) { vec4 p = unprojection * vec4(uv * 2. - 1., textureLod(tDepth, uv, 0.).x * 2. - 1., 1.); return p.xyz / p.w; }
  float noise(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }
  void main() {
    if (texture2D(tDepth, vUv).x >= .99999) { gl_FragColor = vec4(1.); return; }
    vec3 p = eyePoint(vUv), r = eyePoint(vUv + vec2(texel.x, 0.)), l = eyePoint(vUv - vec2(texel.x, 0.)), u = eyePoint(vUv + vec2(0., texel.y)), d = eyePoint(vUv - vec2(0., texel.y));
    // Take each derivative from the nearer neighbour so normals stay clean at edges.
    vec3 dx = abs(r.z - p.z) < abs(p.z - l.z) ? r - p : p - l, dy = abs(u.z - p.z) < abs(p.z - d.z) ? u - p : p - d;
    vec3 n = normalize(cross(dx, dy));
    float range = -p.z, reach = radius * (1. + range * .014), spread = min(reach * projection[1][1] / range * .5, .11);
    float spin = noise(gl_FragCoord.xy) * 6.2831853, bias = .02 + range * .0025, sum = 0.;
    for (int i = 0; i < SAMPLES; i++) {
      float k = (float(i) + .5) / float(SAMPLES), angle = spin + k * 6.2831853 * 3.7;
      vec2 offset = vec2(cos(angle) * texel.x / texel.y, sin(angle)) * spread * sqrt(k);
      vec3 v = eyePoint(vUv + offset) - p; float vv = dot(v, v), f = max(reach * reach - vv, 0.);
      sum += f * f * f * max((dot(v, n) - bias) / (vv + .01), 0.);
    }
    float ao = max(0., 1. - sum * strength * 5. / (pow(reach, 6.) * float(SAMPLES)));
    gl_FragColor = vec4(mix(ao, 1., smoothstep(260., 480., range)));
  }`;

const softenShader = /* glsl */`
  precision highp float;
  uniform sampler2D tOcclusion; uniform highp sampler2D tDepth; uniform vec2 stride; uniform vec2 planes;
  varying vec2 vUv;
  float metres(vec2 uv) { float z = textureLod(tDepth, uv, 0.).x; return planes.x * planes.y / (planes.y - z * (planes.y - planes.x)); }
  void main() {
    float centre = metres(vUv), total = texture2D(tOcclusion, vUv).r * .22, weight = .22;
    for (int i = 1; i <= 4; i++) for (int s = -1; s <= 1; s += 2) {
      vec2 uv = vUv + stride * float(i * s);
      float w = (.21 - .04 * float(i)) * max(0., 1. - abs(metres(uv) - centre) / (.05 * centre + .08));
      total += textureLod(tOcclusion, uv, 0.).r * w; weight += w;
    }
    gl_FragColor = vec4(total / weight);
  }`;

const shrinkShader = /* glsl */`
  uniform sampler2D tSource; uniform vec2 texel; uniform float first;
  varying vec2 vUv;
  vec3 tap(vec2 o) { return texture2D(tSource, vUv + o * texel).rgb; }
  void main() {
    vec3 a = tap(vec2(-1., -1.)), b = tap(vec2(1., -1.)), c = tap(vec2(-1., 1.)), d = tap(vec2(1., 1.));
    if (first > .5) {
      // Weight by brightness so single glints cannot flare into fireflies.
      vec4 w = 1. / (1. + vec4(dot(a, vec3(.33)), dot(b, vec3(.33)), dot(c, vec3(.33)), dot(d, vec3(.33))));
      gl_FragColor = vec4(min((a * w.x + b * w.y + c * w.z + d * w.w) / (w.x + w.y + w.z + w.w), vec3(24.)), 1.);
    } else gl_FragColor = vec4((a + b + c + d) * .25, 1.);
  }`;

const growShader = /* glsl */`
  uniform sampler2D tSource; uniform vec2 texel; uniform float blend;
  varying vec2 vUv;
  void main() {
    vec3 sum = texture2D(tSource, vUv + vec2(-1., -1.) * texel).rgb + texture2D(tSource, vUv + vec2(1., -1.) * texel).rgb
      + texture2D(tSource, vUv + vec2(-1., 1.) * texel).rgb + texture2D(tSource, vUv + vec2(1., 1.) * texel).rgb;
    gl_FragColor = vec4(sum * .25, blend);
  }`;

const gradeShader = /* glsl */`
  uniform sampler2D tScene; uniform sampler2D tOcclusion; uniform sampler2D tBloom;
  uniform float exposure; uniform float occlusion; uniform float bloom; uniform float saturation; uniform float contrast;
  varying vec2 vUv;
  // Khronos PBR Neutral: keeps hues true and only rolls off the brightest light.
  vec3 neutral(vec3 c) {
    float x = min(c.r, min(c.g, c.b)), offset = x < .08 ? x - 6.25 * x * x : .04;
    c -= offset;
    float peak = max(c.r, max(c.g, c.b));
    if (peak < .76) return c;
    float newPeak = 1. - .0576 / (peak + .24 - .76);
    c *= newPeak / peak;
    return mix(c, vec3(newPeak), 1. - 1. / (.15 * (peak - newPeak) + 1.));
  }
  void main() {
    vec3 c = texture2D(tScene, vUv).rgb;
    float shade = mix(1., texture2D(tOcclusion, vUv).r, occlusion);
    // Occluded corners keep some cool skylight rather than going black.
    c *= mix(vec3(.4, .5, .64), vec3(1.), shade);
    c = mix(c, texture2D(tBloom, vUv).rgb, bloom) * exposure;
    // Lean pure blue toward azure: the clear, optimistic sky of the era.
    float azure = max(0., c.b - max(c.r, c.g)); c.r -= azure * .22; c.g += azure * .3;
    c = neutral(c);
    float luma = dot(c, vec3(.2126, .7152, .0722));
    c = mix(vec3(luma), c, saturation);
    c = mix(c, c * c * (3. - 2. * c), contrast);
    c = mix(c * 12.92, 1.055 * pow(max(c, vec3(0.)), vec3(1. / 2.4)) - .055, step(vec3(.0031308), c));
    float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    gl_FragColor = vec4(c + (grain - .5) / 255., 1.);
  }`;

export function createCinema(renderer, scene, camera) {
  const quad = new FullScreenQuad(), size = new THREE.Vector2(), LEVELS = 5;
  const quality = { samples: 0, occlusion: true, bloom: true, glow: .1 };
  const half = { type: THREE.HalfFloatType, depthBuffer: false };
  let sceneTarget, graded, aoA, aoB, mips = [];

  const occlude = pass(occlusionShader, { tDepth: { value: null }, projection: { value: camera.projectionMatrix }, unprojection: { value: camera.projectionMatrixInverse }, texel: { value: new THREE.Vector2() }, radius: { value: 2.2 }, strength: { value: 1 } }, { defines: { SAMPLES: 8 } });
  const soften = pass(softenShader, { tOcclusion: { value: null }, tDepth: { value: null }, stride: { value: new THREE.Vector2() }, planes: { value: new THREE.Vector2(camera.near, camera.far) } });
  const shrink = pass(shrinkShader, { tSource: { value: null }, texel: { value: new THREE.Vector2() }, first: { value: 0 } });
  const grow = pass(growShader, { tSource: { value: null }, texel: { value: new THREE.Vector2() }, blend: { value: .62 } }, { transparent: true });
  const grade = pass(gradeShader, { tScene: { value: null }, tOcclusion: { value: null }, tBloom: { value: null }, exposure: { value: 1 }, occlusion: { value: 1 }, bloom: { value: .1 }, saturation: { value: 1.08 }, contrast: { value: .12 } });
  const smooth = pass(FXAAShader.fragmentShader, { tDiffuse: { value: null }, resolution: { value: new THREE.Vector2() } });
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); white.needsUpdate = true;
  const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); black.needsUpdate = true;

  function build() {
    for (const target of [sceneTarget, graded, aoA, aoB, ...mips]) target?.dispose();
    renderer.getDrawingBufferSize(size);
    const w = Math.max(2, size.x), h = Math.max(2, size.y), depth = new THREE.DepthTexture(w, h);
    sceneTarget = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: quality.samples, depthTexture: depth });
    graded = quality.samples ? null : new THREE.WebGLRenderTarget(w, h, { depthBuffer: false });
    const hw = Math.ceil(w / 2), hh = Math.ceil(h / 2);
    aoA = new THREE.WebGLRenderTarget(hw, hh, { depthBuffer: false }); aoB = new THREE.WebGLRenderTarget(hw, hh, { depthBuffer: false });
    mips = Array.from({ length: LEVELS }, (_, i) => new THREE.WebGLRenderTarget(Math.max(1, w >> (i + 1)), Math.max(1, h >> (i + 1)), half));
  }
  function draw(material, target) { quad.material = material; renderer.setRenderTarget(target); quad.render(renderer); }
  build();

  return {
    quality,
    get scene() { return sceneTarget; },
    render() {
      renderer.setRenderTarget(sceneTarget); renderer.render(scene, camera);
      const depth = sceneTarget.depthTexture;
      if (quality.occlusion) {
        occlude.uniforms.tDepth.value = soften.uniforms.tDepth.value = depth;
        occlude.uniforms.texel.value.set(1 / aoA.width, 1 / aoA.height);
        soften.uniforms.planes.value.set(camera.near, camera.far);
        draw(occlude, aoA);
        soften.uniforms.tOcclusion.value = aoA.texture; soften.uniforms.stride.value.set(1 / aoA.width, 0); draw(soften, aoB);
        soften.uniforms.tOcclusion.value = aoB.texture; soften.uniforms.stride.value.set(0, 1 / aoA.height); draw(soften, aoA);
      }
      if (quality.bloom) {
        let source = sceneTarget;
        for (let i = 0; i < LEVELS; i++) {
          shrink.uniforms.tSource.value = source.texture; shrink.uniforms.texel.value.set(.5 / source.width, .5 / source.height); shrink.uniforms.first.value = i === 0 ? 1 : 0;
          draw(shrink, mips[i]); source = mips[i];
        }
        // Fold each coarser level back into the finer one above it.
        renderer.autoClear = false;
        for (let i = LEVELS - 1; i > 0; i--) {
          grow.uniforms.tSource.value = mips[i].texture; grow.uniforms.texel.value.set(.5 / mips[i].width, .5 / mips[i].height);
          draw(grow, mips[i - 1]);
        }
        renderer.autoClear = true;
      }
      grade.uniforms.tScene.value = sceneTarget.texture;
      grade.uniforms.tOcclusion.value = quality.occlusion ? aoA.texture : white;
      grade.uniforms.tBloom.value = quality.bloom ? mips[0].texture : black;
      grade.uniforms.bloom.value = quality.bloom ? quality.glow : 0;
      if (graded) {
        draw(grade, graded);
        smooth.uniforms.tDiffuse.value = graded.texture; smooth.uniforms.resolution.value.set(1 / graded.width, 1 / graded.height);
        draw(smooth, null);
      } else draw(grade, null);
    },
    resize: build,
    setSamples(samples) { quality.samples = samples; build(); },
    grade: grade.uniforms, occlude: occlude.uniforms,
  };
}
