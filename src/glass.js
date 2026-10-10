import * as THREE from 'three';

// Shared GLSL for everything that mirrors its surroundings. Upward reflections
// read the sharp photographed sky; level and downward ones read a cube map
// captured from inside the finished city, so glass shows the towers, water and
// gardens around it rather than an empty horizon.
export const skyLookup = /* glsl */`
  uniform samplerCube skyCube; uniform samplerCube cityCube; uniform mat3 skyTurn;
  vec3 skyReflection(vec3 r, float blur) {
    vec3 sky = textureCube(skyCube, skyTurn * vec3(r.x, max(r.y, -.02), r.z), blur).rgb * 1.3;
    return mix(textureCube(cityCube, r, blur).rgb, sky, smoothstep(.2, .5, r.y));
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
  const uniforms = { skyCube: { value: target.texture }, skyTurn: { value: matrix }, cityCube: { value: target.texture } };
  // Photograph the built city once, from above the canal, for use in reflections.
  function capture(scene, position) {
    const probe = new THREE.WebGLCubeRenderTarget(768, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const camera = new THREE.CubeCamera(1, 2000, probe);
    camera.position.copy(position); scene.add(camera);
    camera.update(renderer, scene);
    scene.remove(camera); uniforms.cityCube.value = probe.texture;
  }
  return { cube: target.texture, rotation, uniforms, capture };
}

// Where each row of rooms sits in the interior photograph, bottom row first, as
// [low, high] in texture v. The painted floor bands between them are left out:
// the shader draws its own framing, which takes real light and shadow.
const ROOM_ROWS = [[1155, 1247], [1043, 1140], [926, 1027], [811, 910], [695, 795], [576, 679], [460, 560], [342, 443], [230, 327], [116, 215], [3, 101]]
  .map(([top, bottom]) => new THREE.Vector2(1 - (bottom - 3) / 1254, 1 - (top + 3) / 1254));

// Curtain-wall glass, built up the way a real facade is. Each bay has slim
// mullions and a spandrel band that are lit like painted metal. Behind them the
// glass mirrors its surroundings, more strongly toward grazing angles and with
// every pane at its own slight tilt, and through it you see a room set back
// from the window, so the interiors shift as the camera moves past.
export function facadeGlass({ facade, sky, f0 = .19, glow = .8 }) {
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .2, metalness: 0, envMapIntensity: .7 });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, sky.uniforms, { glassF0: { value: f0 }, glassGlow: { value: glow }, facadeMap: { value: facade }, facadeRows: { value: ROOM_ROWS } });
    shader.vertexShader = `attribute vec4 facade; varying vec4 vFacade; varying vec3 vGlassWorld;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFacade = facade; vGlassWorld = (modelMatrix * vec4(transformed, 1.)).xyz;');
    shader.fragmentShader = `varying vec4 vFacade; varying vec3 vGlassWorld; uniform float glassF0; uniform float glassGlow; uniform sampler2D facadeMap; uniform vec2 facadeRows[11];\n#define MULLION .017\n#define SPANDREL .105\n${skyLookup}\n${shader.fragmentShader}`
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec2 bay = vFacade.xy, cell = floor(bay), f = fract(bay), aa = fwidth(bay);
        // Beyond this distance a pane is smaller than a pixel: use averages, not detail.
        float facadeFar = smoothstep(.3, 1.1, max(aa.x, aa.y));
        vec3 pane = hash3(cell + vFacade.w);
        // Framing is box-filtered against the pixel footprint, so slender members
        // keep their true weight at any distance instead of thickening into a cage.
        vec2 px = max(aa, vec2(1e-4)); float edge = min(f.x, 1. - f.x);
        float mullion = clamp((min(edge + px.x * .5, MULLION) - max(edge - px.x * .5, -MULLION)) / px.x, 0., 1.);
        float spandrel = clamp((min(f.y + px.y * .5, SPANDREL) - max(f.y - px.y * .5, 0.)) / px.y, 0., 1.)
          + clamp((min(f.y - 1. + px.y * .5, SPANDREL) - max(f.y - 1. - px.y * .5, 0.)) / px.y, 0., 1.);
        mullion = mix(mullion, 2. * MULLION, smoothstep(.6, 1., px.x)); spandrel = mix(min(spandrel, 1.), SPANDREL, smoothstep(.6, 1., px.y));
        float facadeFrame = 1. - (1. - mullion) * (1. - spandrel);

        // Panes are flat sheets on a curved tower.
        vec3 paneNormal = inverseTransformDirection(normal, viewMatrix);
        float bend = -(f.x - .5) * vFacade.z * .85;
        paneNormal.xz = mat2(cos(bend), sin(bend), -sin(bend), cos(bend)) * paneNormal.xz;
        vec3 toEye = normalize(cameraPosition - vGlassWorld);

        // The room: the photograph hangs a little way behind the glass, so it
        // slides against the frame as the view changes; its edges fall into shade.
        vec3 across = normalize(cross(paneNormal, vec3(0., 1., 0.)) + vec3(1e-4, 0., 0.)), upward = cross(across, paneNormal);
        vec3 sight = vec3(dot(toEye, across), dot(toEye, upward), max(dot(toEye, paneNormal), .22));
        vec2 glazing = vec2((f.x - MULLION) / (1. - 2. * MULLION), (f.y - SPANDREL) / (1. - SPANDREL));
        vec2 deep = glazing - sight.xy / sight.z * .3 * (1. - facadeFar), within = clamp(deep, 0., 1.);
        float reveal = 1. - smoothstep(0., .25, max(abs(deep.x - within.x), abs(deep.y - within.y)));
        vec2 shift = floor(hash3(vec2(vFacade.w, 7.)).xy * vec2(12., 11.));
        vec2 rows = facadeRows[int(mod(cell.y + shift.y, 11.))];
        vec2 roomUv = vec2((mod(cell.x + shift.x, 12.) + mix(.07, .93, within.x)) / 12., mix(rows.x, rows.y, within.y));
        vec2 smoothUv = bay / vec2(12., 11.);
        vec3 room = textureGrad(facadeMap, roomUv, dFdx(smoothUv), dFdy(smoothUv)).rgb;
        // Some rooms have their lights on, a few are dark, a few have blinds drawn.
        float lit = mix(step(.86, pane.y), .14, facadeFar), unlit = mix(step(pane.y, .07), .07, facadeFar), blinds = step(.965, pane.z) * (1. - smoothstep(.1, .4, max(aa.x, aa.y)));
        room *= mix(vec3(.62), vec3(1.25, 1.2, 1.04), lit) * (1. - .6 * unlit) * mix(.5, 1., reveal) * mix(.74, 1., smoothstep(1., .78, glazing.y));
        room = mix(room, vec3(.62, .74, .78) * (.5 + .07 * sin(glazing.y * 75.)), blinds);
        room *= vColor * glassGlow;

        diffuseColor.rgb = mix(vec3(.2, .23, .26), vec3(.46, .5, .53), spandrel) * facadeFrame;
        totalEmissiveRadiance = room * (1. - facadeFrame);
        roughnessFactor = mix(.16, .55, facadeFrame);
        vec3 glassNormal = normalize(paneNormal + (pane - .5) * vec3(.024, .014, .024) * (1. - facadeFar));
        normal = normalize((viewMatrix * vec4(glassNormal, 0.)).xyz);`)
      .replace('#include <opaque_fragment>', `
        {
          float fresnel = (glassF0 + (1. - glassF0) * pow(1. - saturate(dot(glassNormal, toEye)), 5.)) * (1. - .85 * facadeFrame);
          vec3 mirrored = skyReflection(reflect(-toEye, glassNormal), .8 + facadeFrame * 4.);
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
        vec3 colour = mirrored * fresnel + glassTint * glassBody * .9 + vec3(1., .97, .9) * glint;
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
