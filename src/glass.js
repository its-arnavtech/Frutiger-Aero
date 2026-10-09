import * as THREE from 'three';

// Shared GLSL: a sharp lookup of the photographed sky. Reflections that point
// below the horizon see the lagoon and the pale city rather than the photo.
const skyLookup = /* glsl */`
  uniform samplerCube skyCube; uniform mat3 skyTurn;
  vec3 skyReflection(vec3 r, float blur) {
    vec3 sky = textureCube(skyCube, skyTurn * vec3(r.x, max(r.y, -.02), r.z), blur).rgb * 1.3;
    vec3 below = mix(vec3(.07, .36, .44), vec3(.55, .78, .84), smoothstep(-.7, 0., r.y));
    return mix(below, sky, smoothstep(-.1, .05, r.y));
  }
  vec3 hash3(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); q += dot(q, q.yxz + 33.33);
    return fract((q.xxy + q.yzz) * q.zyx);
  }`;

export function createSky(renderer, photograph, turn) {
  const target = new THREE.WebGLCubeRenderTarget(1024, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  target.fromEquirectangularTexture(renderer, photograph);
  const rotation = new THREE.Euler(0, turn, 0);
  // Matches how the renderer turns a cube background.
  const matrix = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, -turn, 0)));
  return { cube: target.texture, rotation, uniforms: { skyCube: { value: target.texture }, skyTurn: { value: matrix } } };
}

// Curtain-wall glass. The photographed interiors stay visible straight on;
// toward grazing angles every pane mirrors the sky at its own slight tilt, which
// is what makes a glazed tower read as glass rather than as a picture.
export function facadeGlass({ facade, sky, reflect = 1.15, f0 = .11 }) {
  const material = new THREE.MeshStandardMaterial({
    map: facade, emissiveMap: facade, emissive: 0xffffff, emissiveIntensity: .5, color: 0xffffff,
    vertexColors: true, roughness: .2, metalness: 0, envMapIntensity: .55,
  });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, sky.uniforms, { glassF0: { value: f0 }, glassReflect: { value: reflect } });
    shader.vertexShader = `attribute vec4 facade; varying vec4 vFacade; varying vec3 vGlassWorld;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFacade = facade; vGlassWorld = (modelMatrix * vec4(transformed, 1.)).xyz;');
    shader.fragmentShader = `varying vec4 vFacade; varying vec3 vGlassWorld; uniform float glassF0; uniform float glassReflect;\n${skyLookup}\n${shader.fragmentShader}`
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 pane = hash3(floor(vFacade.xy) + vFacade.w);
        // Lift the interiors toward the airy, daylit cyan of real low-iron glass.
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.62, .9, .98), .16) * mix(.88, 1.12, pane.x);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance = mix(totalEmissiveRadiance, vec3(.62, .9, .98), .16) * vColor * mix(.88, 1.12, pane.x);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 worldNormal = inverseTransformDirection(normal, viewMatrix);
          // Panes are flat sheets on a curved tower, each set very slightly askew.
          float bend = -(fract(vFacade.x) - .5) * vFacade.z * .85;
          worldNormal.xz = mat2(cos(bend), sin(bend), -sin(bend), cos(bend)) * worldNormal.xz;
          worldNormal = normalize(worldNormal + (pane - .5) * vec3(.05, .03, .05));
          normal = normalize((viewMatrix * vec4(worldNormal, 0.)).xyz);
        }`)
      .replace('#include <opaque_fragment>', `
        {
          vec3 worldNormal = inverseTransformDirection(normal, viewMatrix), toEye = normalize(cameraPosition - vGlassWorld);
          float fresnel = glassF0 + (1. - glassF0) * pow(1. - saturate(dot(worldNormal, toEye)), 5.);
          vec3 mirrored = skyReflection(reflect(-toEye, worldNormal), 0.) * glassReflect;
          outgoingLight = min(outgoingLight - reflectedLight.indirectSpecular, vec3(9.)) * (1. - fresnel) + mirrored * fresnel;
        }
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => 'aero-facade-glass';
  return material;
}

// Thin clear glass: bell-jar towers, garden spheres, balustrades. It adds the
// mirrored sky on top of whatever is behind it instead of tinting it grey.
export function clearGlass({ sky, sun, tint = 0x9fe6f2, body = .07, base = .045, grid = 0, film = 0, glint = 1, side = THREE.FrontSide }) {
  const material = new THREE.ShaderMaterial({
    transparent: true, premultipliedAlpha: true, depthWrite: false, fog: true, side,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      glassTint: { value: new THREE.Color(tint) }, glassBody: { value: body }, glassGrid: { value: grid }, glassFilm: { value: film },
      sunDirection: { value: sun.clone() }, glassGlint: { value: glint }, glassBase: { value: base },
    }]),
    vertexShader: /* glsl */`
      varying vec3 vWorldNormal; varying vec3 vWorld; varying vec2 vUv;
      #include <common>
      #include <fog_pars_vertex>
      void main() {
        vUv = uv; vec4 world = modelMatrix * vec4(position, 1.); vWorld = world.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 mvPosition = viewMatrix * world; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 glassTint; uniform float glassBody; uniform float glassGrid; uniform float glassFilm; uniform float glassGlint; uniform float glassBase; uniform vec3 sunDirection;
      varying vec3 vWorldNormal; varying vec3 vWorld; varying vec2 vUv;
      #include <common>
      #include <fog_pars_fragment>
      ${skyLookup}
      void main() {
        vec3 n = normalize(vWorldNormal) * (gl_FrontFacing ? 1. : -1.), toEye = normalize(cameraPosition - vWorld);
        float facing = saturate(dot(n, toEye)), fresnel = glassBase + (1. - glassBase) * pow(1. - facing, 5.);
        vec3 r = reflect(-toEye, n), mirrored = skyReflection(r, 0.);
        // Soap-film interference, used only on the floating spheres.
        mirrored *= mix(vec3(1.), .78 + .3 * cos(vec3(0., 2.1, 4.2) + fresnel * 11. + vWorld.y * .05), glassFilm);
        float sunward = max(dot(r, sunDirection), 0.);
        float glint = (pow(sunward, 1400.) * 26. + pow(sunward, 90.) * .5) * glassGlint;
        float alpha = saturate(fresnel + glassBody + glint);
        vec3 colour = mirrored * fresnel * 1.15 + glassTint * glassBody * .9 + vec3(1., .97, .9) * glint;
        if (glassGrid > 0.) {
          // Slender glazing bars, antialiased from the bay coordinates.
          vec2 bay = vUv * glassGrid, edge = abs(fract(bay - .5) - .5) / max(fwidth(bay), 1e-4);
          float bar = (1. - saturate(min(edge.x, edge.y) - .1)) * saturate(1.6 - max(fwidth(bay).x, fwidth(bay).y) * 5.);
          colour = mix(colour, vec3(.78, .86, .88) * (.55 + .45 * saturate(dot(n, sunDirection))), bar * .85); alpha = max(alpha, bar * .85);
        }
        gl_FragColor = vec4(colour, alpha);
        #ifdef USE_FOG
          float fogFactor = 1. - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor * alpha, fogFactor);
        #endif
      }`,
  });
  Object.assign(material.uniforms, sky.uniforms);
  return material;
}
