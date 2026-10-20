import * as THREE from 'three';
import { createBatcher, rod } from '../build.js';
import { millRace, terrainHeight, TAU } from './layout.js';

export function buildWatermill(scene, finishes) {
  const root = new THREE.Group(); root.name = 'Working overshot mill and connected millrace'; scene.add(root);
  const fixed = createBatcher(finishes), rotor = createBatcher(finishes), wheel = new THREE.Group();
  wheel.position.set(...millRace.wheel); wheel.rotation.y = Math.PI / 2;
  const spin = new THREE.Group(); wheel.add(spin); root.add(wheel);
  for (const z of [-.65, .65]) {
    rotor.add('wood', new THREE.TorusGeometry(3.8, .17, 8, 64), { at: [0, 0, z] });
    rotor.add('metal', new THREE.TorusGeometry(3.65, .055, 5, 64), { at: [0, 0, z + Math.sign(z) * .17] });
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; rotor.add('wood', rod([0, 0, z], [Math.cos(a) * 3.8, Math.sin(a) * 3.8, z], .12)); }
  }
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * TAU;
    rotor.add('pale', new THREE.BoxGeometry(.68, .16, 1.65), { at: [Math.cos(a) * 3.65, Math.sin(a) * 3.65, 0], turn: [0, 0, a + .15] });
  }
  rotor.add('metal', rod([0, 0, -1.8], [0, 0, 1.2], .22, { sides: 12, caps: true }));
  rotor.build(spin, 'Waterwheel');

  const path = new THREE.CatmullRomCurve3(millRace.feed.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  const boardLength = path.getLength() / 64 * 1.14;
  const vertices = [], uv = [], index = [], across = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= 64; i++) {
    const t = i / 64, p = path.getPointAt(t), tangent = path.getTangentAt(t); across.crossVectors(up, tangent).normalize();
    for (const side of [-1, 1]) {
      const q = p.clone().addScaledVector(across, side * .58); vertices.push(q.x, q.y, q.z); uv.push((side + 1) / 2, t * 18);
    }
    if (i < 64) { const a = i * 2; index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    if (i < 64) {
      const yaw = Math.atan2(tangent.x, tangent.z);
      fixed.add('wood', new THREE.BoxGeometry(1.7, .16, boardLength), { at: [p.x, p.y - .22, p.z], turn: [0, yaw, 0] });
      for (const side of [-1, 1]) { const q = p.clone().addScaledVector(across, side * .75); fixed.add('pale', new THREE.BoxGeometry(.12, .55, boardLength), { at: [q.x, q.y + .02, q.z], turn: [0, yaw, 0] }); }
    }
    if (i % 16 === 0) for (const side of [-1, 1]) {
      const q = p.clone().addScaledVector(across, side * .74), ground = terrainHeight(q.x, q.z);
      if (ground < q.y - .25) fixed.add('wood', rod([q.x, ground, q.z], [q.x, q.y - .25, q.z], .12));
    }
  }
  fixed.build(root, 'Mill flume and tailrace');
  const clock = { value: 0 };
  const stream = new THREE.ShaderMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false, uniforms: { time: clock, runout: { value: 0 }, flowLength: { value: 1 } },
    vertexShader: 'varying vec2 flowUv;void main(){flowUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 flowUv;uniform float time,runout,flowLength;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
      void main(){
      float downstream=flowUv.y-time*.65;
      float ribbons=noise(vec2(flowUv.x*19.+noise(vec2(downstream*.7,2.))*2.,downstream*2.1));
      float broken=noise(vec2(flowUv.x*41.,downstream*7.));
      float glint=smoothstep(.57,.88,ribbons)*(.4+.6*broken);
      float edge=smoothstep(0.,.18,flowUv.x)*(1.-smoothstep(.82,1.,flowUv.x));
      float dissolve=mix(1.,1.-smoothstep(.58,1.,flowUv.y/flowLength),runout);
      vec3 color=mix(vec3(.14,.27,.25),vec3(.8,.89,.86),.19+glint*.8);
      float alpha=mix(.69+glint*.28,.12+glint*.55,runout)*edge*dissolve;
      gl_FragColor=vec4(color,alpha);}`,
  });
  const flow = new THREE.BufferGeometry(); flow.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); flow.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); flow.setIndex(index); flow.computeVertexNormals();
  const troughWater = new THREE.Mesh(flow, stream); troughWater.name = 'Downhill water in the supply flume'; troughWater.renderOrder = 3; root.add(troughWater);
  // Water leaves the lip, hits the upper paddles, and drops into the tailrace.
  const fall = new THREE.PlaneGeometry(1.65, 7.9, 5, 48), p = fall.attributes.position;
  const fallingPath = new THREE.CatmullRomCurve3([
    millRace.lip, [-30.3, 7.75, -6.35], [-30.3, 6, -8.35],
    [-30.3, 4, -8.9], [-30.3, 1.4, -7.9], [-30.3, .08, -7.4],
  ].map(point => new THREE.Vector3(...point)), false, 'centripetal');
  for (let i = 0; i < p.count; i++) {
    const t = 1 - fall.attributes.uv.getY(i), width = .65 + t * .35;
    const centre = fallingPath.getPointAt(t);
    p.setXYZ(i, centre.x + p.getX(i) * width, centre.y, centre.z);
    // Increasing UV distance runs downstream on both the trough and the fall.
    fall.attributes.uv.setY(i, t * fallingPath.getLength() * .5);
  }
  fall.computeVertexNormals(); const curtain = new THREE.Mesh(fall, stream); curtain.name = 'Water crossing the paddles into the pool'; curtain.renderOrder = 3; root.add(curtain);
  // A sheet has almost no projected area when seen along the wheel axle.
  // Give the water a visible, rounded front edge over the actual paddles:
  // this is a second surface of the same stream, not a camera-facing sprite.
  const front = new THREE.PlaneGeometry(.58, 1, 4, 48), fp = front.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const t = 1 - front.attributes.uv.getY(i), centre = fallingPath.getPointAt(t);
    const width = .65 + t * .35;
    fp.setXYZ(i, centre.x + .825 * width, centre.y, centre.z + fp.getX(i));
    front.attributes.uv.setY(i, t * fallingPath.getLength() * .5);
  }
  front.computeVertexNormals();
  const edgeWater = new THREE.Mesh(front, stream); edgeWater.name = 'Visible water spilling over the front paddle edges'; edgeWater.renderOrder = 3; root.add(edgeWater);
  // Moving current continues through the excavated stream bed to the river.
  const tailPath = new THREE.CatmullRomCurve3([
    [-30.3, .045, -7.4], [-28, .04, -5.4], [-22, .035, -5],
    [-15, .03, -5], [-8, .025, -5],
  ].map(p => new THREE.Vector3(...p)), false, 'centripetal');
  const tail = new THREE.PlaneGeometry(1, 1, 8, 80), tp = tail.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const t = 1 - tail.attributes.uv.getY(i), centre = tailPath.getPointAt(t);
    across.crossVectors(up, tailPath.getTangentAt(t)).normalize();
    const q = centre.addScaledVector(across, tp.getX(i) * (1.7 + Math.sin(t * Math.PI) * .5));
    tp.setXYZ(i, q.x, q.y, q.z); tail.attributes.uv.setY(i, t * tailPath.getLength() * .5);
  }
  tail.computeVertexNormals();
  const outflowMaterial = stream.clone();
  outflowMaterial.uniforms = { time: clock, runout: { value: 1 }, flowLength: { value: tailPath.getLength() * .5 } };
  const outflow = new THREE.Mesh(tail, outflowMaterial); outflow.name = 'Visible current from the wheel to the river'; outflow.renderOrder = 3; root.add(outflow);
  const foamMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { time: clock },
    vertexShader: 'varying vec2 foamUv;void main(){foamUv=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 foamUv;uniform float time;void main(){float r=length(foamUv);float turbulence=sin(foamUv.x*23.+time*5.)*sin(foamUv.y*31.-time*4.);float rings=pow(.5+.5*sin(r*35.-time*5.),6.);float a=(1.-smoothstep(.15,1.,r))*(.24+.3*smoothstep(-.2,.8,turbulence)+rings*.3);gl_FragColor=vec4(.81,.9,.86,a);}`,
  });
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.3), foamMaterial);
  foam.rotation.x = -Math.PI / 2; foam.position.copy(fallingPath.getPoint(1)); foam.position.y = .035; foam.renderOrder = 4; root.add(foam);
  return { update(time) { spin.rotation.z = -time * .12; clock.value = time; }, root };
}
