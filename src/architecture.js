import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);

// All of the buildings belong to the same physical landscape. Geometry is
// batched by finish, rather than making every window another render call.
export function createArchitecture({ scene, environment, islands, islandHeight }) {
  const root = new THREE.Group();
  root.name = 'Aero architecture';
  scene.add(root);
  const finishes = {
    porcelain: new THREE.MeshPhysicalMaterial({ color: 0xf1f4ed, roughness: .27, metalness: .18, clearcoat: .65, clearcoatRoughness: .18, envMap: environment, envMapIntensity: .7 }),
    pearl: new THREE.MeshStandardMaterial({ color: 0xd8e6de, roughness: .35, metalness: .34, envMap: environment }),
    metal: new THREE.MeshStandardMaterial({ color: 0xbcd3d3, roughness: .22, metalness: .86, envMap: environment, envMapIntensity: 1.3 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x68c4d0, roughness: .085, metalness: .52, clearcoat: 1, clearcoatRoughness: .06, envMap: environment, envMapIntensity: 1.7 }),
    glassDark: new THREE.MeshPhysicalMaterial({ color: 0x398fa1, roughness: .1, metalness: .54, clearcoat: 1, envMap: environment, envMapIntensity: 1.6 }),
    glassLight: new THREE.MeshPhysicalMaterial({ color: 0x9ed8d7, roughness: .095, metalness: .5, clearcoat: 1, envMap: environment, envMapIntensity: 1.6 }),
    railGlass: new THREE.MeshPhysicalMaterial({ color: 0x72d0d4, transparent: true, opacity: .4, roughness: .06, metalness: .3, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false, envMap: environment, envMapIntensity: 1.25 }),
    stone: new THREE.MeshStandardMaterial({ color: 0xe2dfd0, roughness: .84, metalness: .02 }),
    shadow: new THREE.MeshStandardMaterial({ color: 0x264851, roughness: .67, metalness: .26 }),
    soil: new THREE.MeshStandardMaterial({ color: 0x343b20, roughness: 1 }),
    leaves: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .7, side: THREE.DoubleSide, vertexColors: true }),
    light: new THREE.MeshStandardMaterial({ color: 0xd3fafd, emissive: 0x72d8e3, emissiveIntensity: .3, roughness: .18, metalness: .2 }),
  };
  const batches = new Map(Object.keys(finishes).map(key => [key, []]));
  const transform = new THREE.Object3D();
  let seed = 8361;
  const random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };

  function add(geometry, finish, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
    transform.position.set(...position);
    transform.rotation.set(...rotation);
    transform.scale.set(...scale);
    transform.updateMatrix();
    geometry.applyMatrix4(transform.matrix);
    // A consistent attribute layout makes primitive and custom shapes merge.
    geometry.deleteAttribute('uv');
    batches.get(finish).push(geometry.index ? geometry.toNonIndexed() : geometry);
    if (geometry.index) geometry.dispose();
  }

  function tube(points, radius, finish = 'metal', segments = 32, radialSegments = 6) {
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, radialSegments, false), finish);
  }

  function rod(a, b, radius, finish = 'metal', endRadius = radius) {
    const direction = b.clone().sub(a);
    const geometry = new THREE.CylinderGeometry(endRadius, radius, direction.length(), 8, 1);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, direction.normalize()));
    geometry.translate((a.x + b.x) * .5, (a.y + b.y) * .5, (a.z + b.z) * .5);
    add(geometry, finish);
  }

  function quad(a, b, c, d, finish) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...d, ...b, ...c, ...d], 3));
    geometry.computeVertexNormals();
    add(geometry, finish);
  }

  function annulus(inner, outer, thickness, finish, position, rotation = [-Math.PI / 2, 0, 0], segments = 64) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, 0, TAU, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, inner, 0, TAU, true);
    shape.holes.push(hole);
    add(new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: Math.min(.045, thickness / 3), bevelThickness: Math.min(.045, thickness / 3), curveSegments: segments / 4 }), finish, position, rotation);
  }

  // The gate has an actual glazed soffit, structural depth, inset seams, and
  // foundations. Its clear opening remains wider than fourteen world units.
  annulus(7.38, 8.02, .78, 'porcelain', [0, 7.3, 9.59], [0, 0, 0], 128);
  annulus(7.3, 7.47, .57, 'glass', [0, 7.3, 9.70], [0, 0, 0], 128);
  for (const z of [9.54, 10.42]) {
    add(new THREE.TorusGeometry(7.69, .043, 8, 128), 'metal', [0, 7.3, z]);
    add(new THREE.TorusGeometry(7.405, .023, 8, 128), 'light', [0, 7.3, z]);
  }
  for (let i = 0; i < 32; i++) {
    const angle = i / 32 * TAU;
    const normal = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
    rod(normal.clone().multiplyScalar(7.45).add(new THREE.Vector3(0, 7.3, 10.40)), normal.clone().multiplyScalar(7.91).add(new THREE.Vector3(0, 7.3, 10.40)), .014, 'pearl');
  }
  for (const sign of [-1, 1]) {
    add(new THREE.CylinderGeometry(1.07, 1.45, .45, 48), 'stone', [sign * 6.52, .33, 10]);
    add(new THREE.CylinderGeometry(.72, .94, 1.7, 32), 'porcelain', [sign * 6.52, 1.15, 10], [0, 0, sign * .16]);
    add(new THREE.CylinderGeometry(.76, .96, .15, 32), 'metal', [sign * 6.52, .58, 10]);
    tube([new THREE.Vector3(sign * 6.55, .55, 10.65), new THREE.Vector3(sign * 7.22, 2.42, 10.53), new THREE.Vector3(sign * 7.75, 5.9, 10.35)], .095, 'pearl', 24, 10);
  }

  // Curved curtain walls are divided into individual glazing panels, including
  // recessed spandrels and finely spaced mullions. Their varying reflection is
  // a material change, not a painted-on image of a building.
  function tower(x, z, height, radius, phase) {
    const base = islandHeight(islands[1], x, z) + .13;
    const floors = Math.round(height / 2.35);
    const floorHeight = height / floors;
    const sides = 48;
    const footprint = (angle, y, expansion = 0) => {
      const taper = 1 - .21 * y / height;
      const organic = 1 + .035 * Math.sin(angle * 3 + phase + y * .018);
      const r = radius * taper * organic + expansion;
      return [x + Math.cos(angle) * r, base + y, z + Math.sin(angle) * r * .82];
    };
    add(new THREE.CylinderGeometry(radius * 1.25, radius * 1.37, .38, 64), 'stone', [x, base - .13, z], [0, 0, 0], [1, 1, .82]);
    add(new THREE.CylinderGeometry(radius * 1.12, radius * 1.25, .32, 64), 'porcelain', [x, base + .19, z], [0, 0, 0], [1, 1, .82]);
    for (let floor = 0; floor < floors; floor++) {
      const y0 = floor * floorHeight + .25;
      const y1 = (floor + 1) * floorHeight;
      for (let panel = 0; panel < sides; panel++) {
        const a = panel / sides * TAU;
        const b = (panel + 1) / sides * TAU;
        // Quad order is outward, so every glass panel is front-facing outside.
        const shade = random();
        const finish = shade < .16 ? 'glassDark' : shade > .84 ? 'glassLight' : 'glass';
        quad(footprint(a, y0), footprint(a, y1 - .16), footprint(b, y1 - .16), footprint(b, y0), finish);
        quad(footprint(a, y1 - .16, -.025), footprint(a, y1 + .10, -.025), footprint(b, y1 + .10, -.025), footprint(b, y1 - .16, -.025), 'shadow');
        quad(footprint(a, y1 + .035, .055), footprint(a, y1 + .10, .055), footprint(b, y1 + .10, .055), footprint(b, y1 + .035, .055), 'pearl');
      }
    }
    for (let panel = 0; panel < sides; panel++) {
      const angle = panel / sides * TAU;
      const vertical = Array.from({ length: 9 }, (_, i) => new THREE.Vector3(...footprint(angle, height * i / 8, .035)));
      tube(vertical, panel % 4 === 0 ? .056 : .018, panel % 4 === 0 ? 'porcelain' : 'metal', 16, 5);
    }
    // Six generous external fins catch the sunlight separately from the glass.
    for (let fin = 0; fin < 6; fin++) {
      const a = fin / 6 * TAU + phase * .1;
      const path = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        path.push(new THREE.Vector3(...footprint(a + .035 * Math.sin(t * Math.PI), height * t, .16 + .12 * Math.sin(t * Math.PI))));
      }
      tube(path, .075, 'porcelain', 32, 7);
    }
    // Three projecting garden terraces break up the straight glass silhouette.
    for (const level of [.28, .57, .81]) {
      const y = Math.round(floors * level) * floorHeight;
      const inner = radius * (1 - .21 * y / height);
      const outer = inner + .53;
      const priorCounts = new Map([...batches].map(([key, value]) => [key, value.length]));
      annulus(inner - .05, outer, .20, 'porcelain', [x, base + y - .06, z]);
      annulus(outer - .28, outer - .05, .18, 'porcelain', [x, base + y + .17, z]);
      annulus(outer - .24, outer - .085, .03, 'soil', [x, base + y + .34, z]);
      for (const [key, geometries] of batches) {
        for (let i = priorCounts.get(key); i < geometries.length; i++) {
          geometries[i].translate(-x, 0, -z).scale(1, 1, .82).translate(x, 0, z);
        }
      }
      // Small broadleaf shrubs are mesh leaves with individual orientation.
      for (let shrub = 0; shrub < 42; shrub++) {
        const angle = shrub / 42 * TAU;
        const plantX = x + Math.cos(angle) * (outer - .15);
        const plantZ = z + Math.sin(angle) * (outer - .15) * .82;
        for (let leaf = 0; leaf < 10; leaf++) {
          const color = new THREE.Color().setHSL(.235 + random() * .065, .44 + random() * .14, .20 + random() * .13);
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -.075, .09, .025, 0, .27, .035, 0, 0, 0, 0, .27, .035, .075, .09, .025], 3));
          geometry.setAttribute('color', new THREE.Float32BufferAttribute(Array(6).fill([color.r, color.g, color.b]).flat(), 3));
          geometry.computeVertexNormals();
          add(geometry, 'leaves', [plantX + (random() - .5) * .3, base + y + .31 + random() * .24, plantZ + (random() - .5) * .3], [random() * 1.4 - .7, random() * TAU, random() * 1.8 - .9], [1, .65 + random(), 1]);
        }
      }
    }
    const crownRadius = radius * .79;
    add(new THREE.SphereGeometry(1, 48, 16, 0, TAU, 0, Math.PI / 2), 'porcelain', [x, base + height + .10, z], [0, 0, 0], [crownRadius + .13, .9, (crownRadius + .13) * .82]);
    add(new THREE.CylinderGeometry(crownRadius * .61, crownRadius * .68, .29, 40), 'glassDark', [x, base + height + .91, z], [0, 0, 0], [1, 1, .82]);
    add(new THREE.SphereGeometry(1, 40, 12, 0, TAU, 0, Math.PI / 2), 'glass', [x, base + height + 1.055, z], [0, 0, 0], [crownRadius * .62, .42, crownRadius * .5]);
    for (let rib = 0; rib < 12; rib++) {
      const angle = rib / 12 * TAU;
      const path = Array.from({ length: 12 }, (_, i) => {
        const a = i / 11 * Math.PI * .45;
        return new THREE.Vector3(x + Math.cos(angle) * (crownRadius + .14) * Math.cos(a), base + height + .11 + .92 * Math.sin(a), z + Math.sin(angle) * (crownRadius + .14) * .82 * Math.cos(a));
      });
      tube(path, .018, 'metal', 12, 5);
    }
    // A restrained antenna and rooftop equipment give the crown a real scale.
    rod(new THREE.Vector3(x, base + height + 1.1, z), new THREE.Vector3(x, base + height + 3, z), .065, 'metal', .012);
    for (const sign of [-1, 1]) add(new THREE.BoxGeometry(.31, .28, .65), 'pearl', [x + sign * .8, base + height + .9, z + .3]);
  }
  tower(29, -2, 29, 3.1, .5);
  tower(36, 6, 20, 2.7, 2.8);
  tower(23, -11, 17, 2.5, 1.6);

  const bridgePath = new THREE.CatmullRomCurve3([
    [-33, 9, -28], [-18, 11, -38], [0, 12, -41], [17, 9, -49], [29, 6, -55],
  ].map(p => new THREE.Vector3(...p)));
  const frames = Array.from({ length: 161 }, (_, i) => {
    const t = i / 160;
    const center = bridgePath.getPointAt(t);
    const tangent = bridgePath.getTangentAt(t);
    return { center, side: new THREE.Vector3().crossVectors(tangent, UP).normalize() };
  });
  const offset = (frame, lateral, vertical) => frame.center.clone().addScaledVector(frame.side, lateral).addScaledVector(UP, vertical);
  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i], b = frames[i + 1];
    quad(offset(a, 1.55, 0), offset(b, 1.55, 0), offset(b, -1.55, 0), offset(a, -1.55, 0), 'stone');
    quad(offset(a, -1.55, -.42), offset(b, -1.55, -.42), offset(b, 1.55, -.42), offset(a, 1.55, -.42), 'pearl');
    for (const sign of [-1, 1]) {
      const outer = sign * 1.55;
      const front = [offset(a, outer, 0), offset(a, outer, -.42), offset(b, outer, -.42), offset(b, outer, 0)];
      if (sign === -1) front.reverse();
      quad(...front, 'porcelain');
      quad(offset(a, sign * 1.48, .16), offset(a, sign * 1.48, 1.12), offset(b, sign * 1.48, 1.12), offset(b, sign * 1.48, .16), 'railGlass');
      const strip = [offset(a, sign * 1.36, .007), offset(b, sign * 1.36, .007), offset(b, sign * 1.43, .007), offset(a, sign * 1.43, .007)];
      if (sign === 1) strip.reverse();
      quad(...strip, 'light');
    }
    if (i % 4 === 0) {
      rod(offset(a, -1.43, .1), offset(a, -1.43, 1.15), .026, 'metal');
      rod(offset(a, 1.43, .1), offset(a, 1.43, 1.15), .026, 'metal');
      rod(offset(a, -1.46, .009), offset(a, 1.46, .009), .009, 'pearl');
    }
  }
  for (const sign of [-1, 1]) {
    tube(frames.filter((_, i) => i % 2 === 0).map(frame => offset(frame, sign * 1.48, 1.14)), .052, 'metal', 128, 6);
    tube(frames.filter((_, i) => i % 2 === 0).map(frame => offset(frame, sign * 1.51, .08)), .065, 'porcelain', 128, 6);
    tube(frames.filter((_, i) => i % 2 === 0).map(frame => offset(frame, sign * .83, -.47)), .13, 'porcelain', 128, 8);
  }
  // Y columns land on the islands, leaving the flight beneath the middle span
  // completely open. Cross bracing also stays tucked under the deck.
  for (const t of [.105, .87]) {
    const center = bridgePath.getPointAt(t);
    const side = new THREE.Vector3().crossVectors(bridgePath.getTangentAt(t), UP).normalize();
    const island = t < .5 ? islands[2] : islands[3];
    const ground = Math.max(.4, islandHeight(island, center.x, center.z));
    const base = new THREE.Vector3(center.x, ground, center.z);
    const fork = new THREE.Vector3(center.x, center.y - 2.2, center.z);
    rod(base, fork, .48, 'porcelain', .31);
    for (const sign of [-1, 1]) rod(fork, center.clone().addScaledVector(side, sign * 1.1).addScaledVector(UP, -.43), .22, 'porcelain', .16);
    add(new THREE.CylinderGeometry(.83, 1.05, .35, 32), 'stone', [center.x, ground + .1, center.z]);
  }
  for (let i = 0; i < frames.length - 8; i += 8) {
    rod(offset(frames[i], -.82, -.45), offset(frames[i + 8], .82, -.45), .035, 'metal');
    rod(offset(frames[i], .82, -.45), offset(frames[i + 8], -.82, -.45), .035, 'metal');
  }

  for (const [finish, geometries] of batches) {
    if (!geometries.length) continue;
    const geometry = mergeGeometries(geometries, false);
    for (const part of geometries) part.dispose();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, finishes[finish]);
    mesh.name = `Architecture: ${finish}`;
    mesh.castShadow = !['railGlass', 'light', 'leaves'].includes(finish);
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  return {
    root,
    dispose() {
      root.traverse(object => { if (object.isMesh) object.geometry.dispose(); });
      for (const material of Object.values(finishes)) material.dispose();
      scene.remove(root);
    },
  };
}
