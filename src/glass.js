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

// Curtain-wall glass, built up the way a real facade is. Every bay is two panes
// between slim aluminium mullions, above a band of opaque spandrel glass that
// hides the floor slab. The glass sits a little behind the face of the frame,
// so the members show their sides and slide across it as the view moves. Each
// pane is a flat sheet with its own slight tilt and bow, which breaks the
// reflected city into the quilt of offset images that real glazing shows, and
// lets the sun flash off single panes. Behind the glass is a room with a floor,
// a ceiling with lights and side walls, with the photographed interior across
// the back of it; some rooms have blinds part-way down.
export function facadeGlass({ facade, sky, f0 = .19, glow = .82 }) {
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .2, metalness: 0, envMapIntensity: .7 });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, sky.uniforms, { glassF0: { value: f0 }, glassGlow: { value: glow }, facadeMap: { value: facade }, facadeRows: { value: ROOM_ROWS } });
    // The uv channel of facade geometry carries the width of a bay in metres.
    shader.vertexShader = `attribute vec4 facade; varying vec4 vFacade; varying vec3 vGlassWorld; varying float vBayMetres;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFacade = facade; vBayMetres = uv.x; vGlassWorld = (modelMatrix * vec4(transformed, 1.)).xyz;');
    shader.fragmentShader = `varying vec4 vFacade; varying vec3 vGlassWorld; varying float vBayMetres;
      uniform float glassF0; uniform float glassGlow; uniform sampler2D facadeMap; uniform vec2 facadeRows[11];
      #define MULLION .017
      #define MIDRAIL .011
      #define TRANSOM .016
      #define SPANDREL .2
      #define RECESS .13
      #define ROOM_DEPTH 2.3
      ${skyLookup}
      // The share of a pixel-wide footprint centred on x that [low, high] covers.
      float band(float low, float high, float x, float w) { return clamp((min(x + w * .5, high) - max(x - w * .5, low)) / w, 0., 1.); }
      // How much of the stretch from a to b lies inside [low, high].
      float crossing(float a, float b, float low, float high) { return max(0., min(max(a, b), high) - max(min(a, b), low)); }
      ${shader.fragmentShader}`
      .replace('#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec2 bay = vFacade.xy, cell = floor(bay), f = fract(bay), px = max(fwidth(bay), vec2(1e-4));
        float grain = max(px.x, px.y);
        // Depth is for glass you are near; far panes shrink to their averages.
        float closeUp = 1. - smoothstep(.05, .22, grain), facadeFar = smoothstep(.3, 1., grain);
        float lite = floor(f.x * 2.), inLite = fract(f.x * 2.);
        vec3 pane = hash3(vec2(cell.x * 2. + lite, cell.y) + vFacade.w), suite = hash3(cell + vFacade.w + 17.);

        // Panes are flat sheets on a curved tower.
        vec3 paneNormal = inverseTransformDirection(normal, viewMatrix);
        float bend = -(inLite - .5) * vFacade.z * .42;
        paneNormal.xz = mat2(cos(bend), sin(bend), -sin(bend), cos(bend)) * paneNormal.xz;
        vec3 toEye = normalize(cameraPosition - vGlassWorld);
        vec3 across = normalize(cross(paneNormal, vec3(0., 1., 0.)) + vec3(1e-4, 0., 0.)), upward = cross(across, paneNormal);
        vec3 sight = vec3(dot(toEye, across), dot(toEye, upward), max(dot(toEye, paneNormal), .2));
        vec2 slide = sight.xy / sight.z, metres = vec2(max(vBayMetres, .5), 3.);
        float sunlit = 0.;
        #if NUM_DIR_LIGHTS > 0
          sunlit = saturate(dot(paneNormal, inverseTransformDirection(directionalLights[0].direction, viewMatrix)) * 2.5) * getShadowMask();
        #endif

        // Framing. g is where the line of sight meets the recessed glass; a member
        // lying between f and g is seen from the side. Coverage is box-filtered
        // over the pixel, so slender members keep their true weight at a distance.
        vec2 g = f - slide * (RECESS / metres) * closeUp;
        float mullion = band(-MULLION, MULLION, f.x, px.x) + band(1. - MULLION, 1. + MULLION, f.x, px.x) + band(.5 - MIDRAIL, .5 + MIDRAIL, f.x, px.x);
        float transom = band(0., TRANSOM, f.y, px.y) + band(SPANDREL - TRANSOM, SPANDREL, f.y, px.y) + band(1., 1. + TRANSOM, f.y, px.y);
        mullion = mix(min(mullion, 1.), 2. * (MULLION + MIDRAIL), smoothstep(.5, 1.2, px.x));
        transom = mix(min(transom, 1.), 2. * TRANSOM, smoothstep(.5, 1.2, px.y));
        float jamb = crossing(f.x, g.x, -MULLION, MULLION) + crossing(f.x, g.x, 1. - MULLION, 1. + MULLION) + crossing(f.x, g.x, .5 - MIDRAIL, .5 + MIDRAIL);
        float sill = crossing(f.y, g.y, 0., TRANSOM) + crossing(f.y, g.y, SPANDREL - TRANSOM, SPANDREL) + crossing(f.y, g.y, 1., 1. + TRANSOM);
        jamb = saturate(jamb / px.x) * (1. - mullion) * closeUp;
        sill = saturate(sill / px.y) * (1. - transom) * (1. - jamb) * closeUp;
        float metal = 1. - (1. - mullion) * (1. - transom) * (1. - jamb) * (1. - sill);
        float spandrel = mix(band(TRANSOM, SPANDREL - TRANSOM, g.y, px.y), SPANDREL - 2. * TRANSOM, smoothstep(.5, 1.2, px.y));
        float vision = (1. - metal) * (1. - spandrel);
        spandrel *= 1. - metal;

        // The room. A sight line runs from q on the glass to whichever it meets
        // first: a side wall, the floor or ceiling, or the back of the room.
        vec2 opening = vec2(1. - 2. * MULLION, 1. - SPANDREL);
        vec2 q = clamp((g - vec2(MULLION, SPANDREL)) / opening, 0., 1.);
        vec2 run = -slide * ROOM_DEPTH / (metres * opening) * (1. - facadeFar);
        run += (step(0., run) * 2. - 1.) * 1e-4;
        vec2 reach = (step(0., run) - q) / run;
        float depth = min(min(reach.x, reach.y), 1.);
        vec2 hit = q + run * depth;
        vec2 shift = floor(hash3(vec2(vFacade.w, 7.)).xy * vec2(12., 11.));
        vec2 rows = facadeRows[int(mod(cell.y + shift.y, 11.))];
        vec2 roomUv = vec2((mod(cell.x + shift.x, 12.) + mix(.07, .93, hit.x)) / 12., mix(rows.x, rows.y, hit.y));
        vec2 smoothUv = bay / vec2(12., 11.);
        vec3 photo = textureGrad(facadeMap, roomUv, dFdx(smoothUv), dFdy(smoothUv)).rgb;
        float lamps = mix(step(.8, suite.x), .2, facadeFar), dark = mix(step(suite.x, .08), .08, facadeFar);
        float inside = step(depth, .9999), onSide = inside * step(reach.x, reach.y), onFlat = inside - onSide, onCeiling = onFlat * step(0., run.y);
        // Walls, floor and ceiling carry on from the edges of the photograph.
        vec3 plaster = mix(photo, vec3(.7, .73, .74), .5);
        vec3 ceiling = mix(photo, vec3(.78, .8, .8), .55);
        float strips = (smoothstep(.07, .03, abs(depth - .3)) + smoothstep(.07, .03, abs(depth - .72))) * smoothstep(.03, .12, min(hit.x, 1. - hit.x));
        ceiling += strips * mix(vec3(.2), vec3(2.3, 2.2, 1.95), lamps);
        vec3 flooring = mix(photo, mix(vec3(.3, .33, .36), vec3(.46, .38, .29), step(.5, suite.z)), .55);
        // The sun lays a bright patch on the floor just inside the windows it reaches.
        flooring *= 1. + 2.4 * sunlit * (1. - smoothstep(.08, .5, depth));
        vec3 room = mix(mix(mix(photo, plaster, onSide), ceiling, onCeiling), flooring, onFlat - onCeiling);
        float corner = min(min(hit.x, 1. - hit.x), min(hit.y, 1. - hit.y));
        room *= mix(1., .58, depth) * (1. + .5 * (1. - inside)) * (.84 + .16 * smoothstep(0., .1, corner + inside));
        room *= mix(vec3(.66), vec3(1.25, 1.2, 1.05), lamps) * (1. - .6 * dark);
        // Roller blinds, drawn to a different height in each room.
        float drop = step(.72, suite.y) * (.1 + .6 * fract(suite.y * 9.3));
        float blind = step(1. - drop, q.y) * (1. - smoothstep(.12, .4, grain));
        room = mix(room, vec3(.74, .76, .72) * (.5 + .25 * sunlit + .05 * sin(q.y * 140.)) + room * .12, blind);
        room *= vec3(.78, .95, .96) * vColor * glassGlow;

        // Each pane leans and bows a little, and carries a faint roller wave.
        vec2 inPane = vec2(inLite, q.y) - .5;
        float bow = (pane.x - .5) * .05;
        vec3 glassNormal = normalize(paneNormal
          + across * (inPane.x * bow + (pane.y - .5) * .02 + .0009 * sin(inPane.y * 8. + pane.z * 6.283)) * (1. - facadeFar)
          + upward * (inPane.y * bow * .7 + (pane.z - .5) * .012) * (1. - facadeFar));
        vec3 frameNormal = normalize(mix(mix(paneNormal, across * sign(sight.x), jamb), upward * sign(sight.y), sill));
        normal = normalize((viewMatrix * vec4(mix(glassNormal, frameNormal, metal), 0.)).xyz);

        diffuseColor.rgb = vec3(.56, .59, .62) * (1. - .35 * max(jamb, sill)) * metal + vec3(.05, .1, .13) * vColor * spandrel;
        totalEmissiveRadiance = room * vision;
        roughnessFactor = mix(.12, .5, metal);`)
      .replace('#include <opaque_fragment>', `
        {
          float glassy = 1. - metal;
          float fresnel = (glassF0 + (1. - glassF0) * pow(1. - saturate(dot(glassNormal, toEye)), 5.)) * glassy;
          vec3 mirrored = skyReflection(reflect(-toEye, glassNormal), .8);
          // Coated glass reflects several times what the lighting model assumes
          // for a plain dielectric, so the sun flashes off single panes.
          outgoingLight += reflectedLight.directSpecular * 2. * glassy;
          outgoingLight = min(outgoingLight - reflectedLight.indirectSpecular, vec3(12.)) * (1. - fresnel) + mirrored * fresnel;
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
