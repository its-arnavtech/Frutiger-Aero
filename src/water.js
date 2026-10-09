import * as THREE from 'three';

// A shallow, sunlit lagoon. Near the camera you look down through clear water
// to a pale bed laced with caustics; toward the horizon the surface turns into
// a mirror of the real scene, rendered from below with a reflected camera.
export function createWater({ renderer, scene, normals, sunDirection, sunColor }) {
  const target = new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType });
  const mirrorCamera = new THREE.PerspectiveCamera(), textureMatrix = new THREE.Matrix4();
  const plane = new THREE.Plane(), clip = new THREE.Vector4(), q = new THREE.Vector4();
  const up = new THREE.Vector3(0, 1, 0), eye = new THREE.Vector3(), look = new THREE.Vector3(), rotation = new THREE.Matrix4();
  normals.wrapS = normals.wrapT = THREE.RepeatWrapping;

  const material = new THREE.ShaderMaterial({
    name: 'Lagoon', lights: true, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, THREE.UniformsLib.lights, {
      mirrorSampler: { value: null }, normalSampler: { value: null }, textureMatrix: { value: null }, time: { value: 0 },
      sunDirection: { value: sunDirection.clone() }, sunColor: { value: new THREE.Color(sunColor) },
    }]),
    vertexShader: /* glsl */`
      uniform mat4 textureMatrix;
      varying vec4 mirrorCoord; varying vec4 worldPosition;
      #include <common>
      #include <fog_pars_vertex>
      #include <shadowmap_pars_vertex>
      void main() {
        worldPosition = modelMatrix * vec4(position, 1.);
        mirrorCoord = textureMatrix * worldPosition;
        vec4 mvPosition = viewMatrix * worldPosition;
        gl_Position = projectionMatrix * mvPosition;
        #include <beginnormal_vertex>
        #include <defaultnormal_vertex>
        #include <fog_vertex>
        #include <shadowmap_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D mirrorSampler; uniform sampler2D normalSampler; uniform float time; uniform vec3 sunDirection; uniform vec3 sunColor;
      varying vec4 mirrorCoord; varying vec4 worldPosition;
      #include <common>
      #include <packing>
      #include <bsdfs>
      #include <fog_pars_fragment>
      #include <lights_pars_begin>
      #include <shadowmap_pars_fragment>
      #include <shadowmask_pars_fragment>

      vec2 ripples(vec2 p) {
        vec2 a = texture2D(normalSampler, p * .083 + time * vec2(.021, .013)).xy;
        vec2 b = texture2D(normalSampler, p * .19 - time * vec2(.017, -.024)).xy;
        vec2 c = texture2D(normalSampler, p * .021 + time * vec2(-.006, .004)).xy;
        return (a + b * .7 + c * .65) * 2. - 2.35;
      }
      // Caustics: light gathers on the bed along the lines where two drifting
      // wave fields cancel, which draws the familiar shifting net of bright threads.
      float caustics(vec2 p) {
        vec2 a = texture2D(normalSampler, p * .09 + time * vec2(.012, .008)).xy - .5;
        vec2 b = texture2D(normalSampler, p * .15 - time * vec2(.01, -.013)).xy - .5;
        float first = 1. - smoothstep(0., .075, abs(a.x + b.y)), second = 1. - smoothstep(0., .075, abs(a.y - b.x));
        return first * first * .55 + second * second * .55 + first * second * .9;
      }
      void main() {
        vec3 toEye = cameraPosition - worldPosition.xyz; float range = length(toEye); vec3 view = toEye / range;
        // Distant water is drawn calmer: wave detail there is smaller than a pixel.
        vec2 slope = ripples(worldPosition.xz) * (.3 / (1. + range * .016) + .035);
        vec3 normal = normalize(vec3(slope.x, 1., slope.y));
        float facing = max(dot(normal, view), 0.), fresnel = .035 + .965 * pow(1. - facing, 4.2);
        vec3 mirrored = texture2D(mirrorSampler, mirrorCoord.xy / mirrorCoord.w + slope * .09).rgb;

        float lit = getShadowMask();
        vec3 into = refract(-view, normal, .75);
        float path = 3.3 / max(-into.y, .1);
        vec2 bed = worldPosition.xz + into.xz * path;
        float sparkle = range < 120. ? caustics(bed) * (1. - range / 120.) : 0.;
        vec3 floorLight = vec3(.6, .85, .8) * (.6 + lit * (.34 + sparkle * 1.5));
        vec3 clear = exp(-path * vec3(.35, .068, .085));
        vec3 body = floorLight * clear + vec3(.0, .4, .5) * (.78 + .22 * lit) * (1. - clear);

        vec3 colour = mix(body, mirrored, fresnel);
        float glitter = pow(max(dot(normal, normalize(view + sunDirection)), 0.), 600.) * 18. * lit;
        gl_FragColor = vec4(colour + sunColor * glitter, 1.);
        #include <fog_fragment>
      }`,
  });
  material.uniforms.mirrorSampler.value = target.texture;
  material.uniforms.normalSampler.value = normals;
  material.uniforms.textureMatrix.value = textureMatrix;

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200), material);
  mesh.rotation.x = -Math.PI / 2; mesh.receiveShadow = true; mesh.name = 'Lagoon'; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
  scene.add(mesh);

  // Mirror-camera construction follows three.js' Reflector for a y = 0 plane.
  function update(camera) {
    camera.updateMatrixWorld();
    eye.setFromMatrixPosition(camera.matrixWorld);
    if (eye.y <= 0) return;
    rotation.extractRotation(camera.matrixWorld);
    look.set(0, 0, -1).applyMatrix4(rotation).add(eye);
    mirrorCamera.position.set(eye.x, -eye.y, eye.z);
    mirrorCamera.up.set(0, 1, 0).applyMatrix4(rotation).reflect(up);
    mirrorCamera.lookAt(look.x, -look.y, look.z);
    mirrorCamera.far = camera.far; mirrorCamera.updateMatrixWorld();
    mirrorCamera.projectionMatrix.copy(camera.projectionMatrix);
    textureMatrix.set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1).multiply(mirrorCamera.projectionMatrix).multiply(mirrorCamera.matrixWorldInverse);
    // Clip everything beneath the surface with an oblique near plane.
    plane.setFromNormalAndCoplanarPoint(up, look.set(0, -.05, 0)).applyMatrix4(mirrorCamera.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const projection = mirrorCamera.projectionMatrix.elements;
    q.set((Math.sign(clip.x) + projection[8]) / projection[0], (Math.sign(clip.y) + projection[9]) / projection[5], -1, (1 + projection[10]) / projection[14]);
    clip.multiplyScalar(2 / clip.dot(q));
    projection[2] = clip.x; projection[6] = clip.y; projection[10] = clip.z + 1; projection[14] = clip.w;

    const previous = renderer.getRenderTarget();
    mesh.visible = false;
    renderer.setRenderTarget(target); renderer.clear();
    renderer.render(scene, mirrorCamera);
    renderer.setRenderTarget(previous);
    mesh.visible = true;
  }
  function resize(width, height) {
    const scale = Math.min(.5, 960 / width);
    target.setSize(Math.max(64, Math.round(width * scale)), Math.max(64, Math.round(height * scale)));
  }
  return { mesh, material, update, resize };
}
