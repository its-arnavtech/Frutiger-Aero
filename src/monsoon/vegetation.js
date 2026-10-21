import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, noise, TAU, basinRadius } from './layout.js';
import { createRiverStone, createMeadowTuft, riverStoneMaterial } from '../autumn/ground-details.js';

// Separate fracture geometries, clustered sizes and a common scanned material
// make the bank a deposit of related stones rather than a random dot pattern.
export function buildShore(scene, maps, profile, surfaceHeight) {
  const random = rng(34071), pose = new THREE.Object3D(), tint = new THREE.Color();
  const material = riverStoneMaterial(maps), footprints = [];
  const batches = Array.from({length: 10}, (_, i) => {
    const mesh = new THREE.InstancedMesh(createRiverStone(312 + i * 139, i < 6 ? 4 : 1), material, 700);
    mesh.count = 0; mesh.castShadow = i < 6; mesh.receiveShadow = true;
    mesh.name = `Glacial deposit: fracture variant ${i + 1}`; scene.add(mesh); return mesh;
  });
  function place(x, z, s, variant) {
    const y = surfaceHeight(x, z), r = basinRadius(x, z);
    if (y > 11 || y < -6 || r < .84 || r > 1.22) return;
    const batch = batches[s > .36 ? variant % 6 : 6 + variant % 4];
    if (batch.count === 700) return;
    pose.position.set(x, y - s * .13, z);
    pose.rotation.set((random()-.5)*.45, random()*TAU, (random()-.5)*.3);
    pose.scale.set(s*(.85+random()*.65),s*(.7+random()*.4),s*(.8+random()*.45)); pose.updateMatrix();
    batch.setMatrixAt(batch.count,pose.matrix);
    tint.setHSL(.11+random()*.045,.035+random()*.08,.72+random()*.22);
    batch.setColorAt(batch.count++,tint);
    if (s > .65) footprints.push({x,y,z,radius:s*1.6});
  }
  for(let i=0;i<(profile.low?180:profile.mobile?270:420);i++) {
    const angle=random()*TAU, r=.97+random()*.12;
    const x=Math.cos(angle)*285*r,z=-80+Math.sin(angle)*405*r;
    if(noise(x*.024,z*.024)<.36)continue;
    const s=.5+random()**2*2.5;
    place(x,z,s,i);
    for(let j=0;j<8;j++) {
      const a=random()*TAU,d=s*(.7+random()*3.8);
      place(x+Math.cos(a)*d,z+Math.sin(a)*d,.08+random()**2*.68,i+j);
    }
  }
  // Submerged gravel uses geometry in the foreground, subdued sand beyond it.
  for(let i=0;i<1000;i++) {
    const x=(random()-.5)*170,z=230+random()*110;
    if(noise(x*.06,z*.06)<.45)continue;
    place(x,z,.06+random()**3*.42,i);
  }
  for(const mesh of batches)mesh.computeBoundingSphere();

  const grass=new THREE.InstancedMesh(createMeadowTuft(974),new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1,envMapIntensity:.45}),profile.low?2000:profile.mobile?4000:8500);
  grass.count=0; const shrubSites=[];
  for(let i=0;i<40000 && grass.count<grass.instanceMatrix.count;i++) {
    const a=random()*TAU,r=1.035+random()**1.6*.24,x=Math.cos(a)*285*r,z=-80+Math.sin(a)*405*r,y=surfaceHeight(x,z);
    if(y<1.4 || y>19 || noise(x*.08,z*.08)<.39)continue;
    const slope=1/Math.hypot((surfaceHeight(x+2,z)-surfaceHeight(x-2,z))/4,1,(surfaceHeight(x,z+2)-surfaceHeight(x,z-2))/4);
    if(slope<.78)continue;
    pose.position.set(x,y-.045,z);pose.rotation.set(0,random()*TAU,0);pose.scale.setScalar(.7+random()*1.35);pose.updateMatrix();grass.setMatrixAt(grass.count++,pose.matrix);
    if(grass.count%31===0)shrubSites.push({x,y,z});
  }
  grass.layers.set(1); grass.receiveShadow=true;grass.computeBoundingSphere();grass.name='Uneven banks of curved sedges and alpine grasses';scene.add(grass);
  const shrubs=new THREE.InstancedMesh(createShrub(7301),new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.91,envMapIntensity:.5}),shrubSites.length);
  for(let i=0;i<shrubSites.length;i++) {
    const {x,y,z}=shrubSites[i],height=.65+random()*1.25;
    pose.position.set(x,y-.05,z);pose.rotation.set(0,random()*TAU,0);pose.scale.set(height*1.3,height,height*1.3);pose.updateMatrix();shrubs.setMatrixAt(i,pose.matrix);
  }
  shrubs.castShadow=shrubs.receiveShadow=true;shrubs.computeBoundingSphere();shrubs.name='Low alpine willow with individual folded leaves';scene.add(shrubs);
  const forest = plantForest(scene,profile,surfaceHeight,random);
  return { stoneCount:batches.reduce((sum,b)=>sum+b.count,0), footprints, vegetation:forest };
}

export function createShrub(seed) {
  const random=rng(seed),pieces=[],vertices=[],colors=[],indices=[];
  for(let b=0;b<7;b++) {
    const angle=b/7*TAU, height=.45+random()*.5,reach=.18+random()*.4;
    const tip=new THREE.Vector3(Math.cos(angle)*reach,height,Math.sin(angle)*reach);
    const branch=new THREE.CylinderGeometry(.007,.019,tip.length(),4);
    branch.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),tip.clone().normalize()));branch.translate(tip.x/2,tip.y/2,tip.z/2);branch.deleteAttribute('uv');
    const brown=new THREE.Color('#62583e'),tones=[];
    for(let i=0;i<branch.attributes.position.count;i++)tones.push(...brown.toArray());
    branch.setAttribute('color',new THREE.Float32BufferAttribute(tones,3));pieces.push(branch);
    for(let j=0;j<15;j++) {
      const t=.25+random()*.75,side=j%2?1:-1,turn=angle+side*(.7+random());
      const center=tip.clone().multiplyScalar(t),len=.055+random()*.08,w=len*.3;
      const forward=new THREE.Vector3(Math.cos(turn),.25+random()*.5,Math.sin(turn)).normalize().multiplyScalar(len),across=new THREE.Vector3(-Math.sin(turn)*w,0,Math.cos(turn)*w);
      const points=[center,center.clone().addScaledVector(forward,.5).add(across),center.clone().addScaledVector(forward,.5).add(new THREE.Vector3(0,.014,0)),center.clone().addScaledVector(forward,.5).sub(across),center.clone().add(forward)];
      const n=vertices.length/3,color=new THREE.Color().setHSL(.22+random()*.065,.25+random()*.2,.19+random()*.14);
      for(const point of points){vertices.push(...point.toArray());colors.push(...color.toArray());}
      indices.push(n,n+1,n+2,n,n+2,n+3,n+1,n+4,n+2,n+2,n+4,n+3);
    }
  }
  const leaves=new THREE.BufferGeometry();leaves.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));leaves.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));leaves.setIndex(indices);leaves.computeVertexNormals();pieces.push(leaves);
  const geometry=mergeGeometries(pieces);for(const piece of pieces)piece.dispose();geometry.computeBoundingSphere();return geometry;
}

export function createConifer(seed) {
  const random=rng(seed), pieces=[], colors=[];
  const trunk=new THREE.CylinderGeometry(.025,.055,1,6);trunk.translate(0,.5,0);
  const brown=new THREE.Color('#5b5341');colors.push(...Array.from({length:trunk.attributes.position.count},()=>brown.toArray()).flat());
  trunk.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));pieces.push(trunk);
  // Open branch whorls with irregular serrated needles, visible gaps, and
  // drooping branch tips instead of stacked solid cones or round crowns.
  const vertices=[], tones=[], indices=[];
  for(let tier=0;tier<10;tier++) {
    const y=.14+tier*.079, reach=(1-y)*(.28+random()*.09),turn=random()*TAU;
    for(let branch=0;branch<7;branch++) {
      const angle=turn+branch/7*TAU+(random()-.5)*.25,dx=Math.cos(angle),dz=Math.sin(angle),len=reach*(.7+random()*.45),start=vertices.length/3;
      for(let step=0;step<5;step++) {
        const t=step/4,width=(1-t)*len*(step%2?.32:.52),height=y+.04*Math.sin(t*3)-t*t*.055;
        const color=new THREE.Color('#193b25').lerp(new THREE.Color('#546044'),random()*.65);
        vertices.push(dx*len*t-dz*width,height,dz*len*t+dx*width,
          dx*len*t,height+width*.55,dz*len*t,
          dx*len*t+dz*width,height,dz*len*t-dx*width);
        for(let side=0;side<3;side++)tones.push(...color.toArray());
        if(step<4){const n=start+step*3;indices.push(n,n+3,n+1,n+1,n+3,n+4,n+1,n+4,n+2,n+2,n+4,n+5);}
      }
    }
  }
  const branches=new THREE.BufferGeometry();branches.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));branches.setAttribute('color',new THREE.Float32BufferAttribute(tones,3));branches.setIndex(indices);branches.computeVertexNormals();
  // Match the trunk's attributes before merging.
  trunk.deleteAttribute('uv');pieces.push(branches);
  const geometry=mergeGeometries(pieces);for(const piece of pieces)piece.dispose();geometry.computeBoundingSphere();return geometry;
}

function plantForest(scene,profile,surfaceHeight,random) {
  const material=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.96,envMapIntensity:.6});
  const batches=Array.from({length:3},(_,i)=>new THREE.InstancedMesh(createConifer(72+i*317),material,profile.low?120:profile.mobile?250:500));
  for(const mesh of batches){mesh.count=0;mesh.castShadow=mesh.receiveShadow=true;mesh.name='Irregular alpine spruce groves';scene.add(mesh);}
  const pose=new THREE.Object3D(),placements=[];
  for(let i=0;i<18000;i++) {
    const x=(random()-.5)*1300,z=-510-random()*720,y=surfaceHeight(x,z);
    const slope=1/Math.hypot((surfaceHeight(x+5,z)-surfaceHeight(x-5,z))/10,1,(surfaceHeight(x,z+5)-surfaceHeight(x,z-5))/10);
    const treeline=290+noise(x*.009,z*.009)*100;
    if(y<8 || y>treeline || slope<.72 || noise(x*.018,z*.018)<.44)continue;
    const mesh=batches[i%3];if(mesh.count>=mesh.instanceMatrix.count)continue;
    const h=5+random()**1.4*11, width=.8+random()*.5;
    pose.position.set(x,y-.2,z);pose.rotation.set((random()-.5)*.04,random()*TAU,(random()-.5)*.04);pose.scale.set(h*width,h,h*width);pose.updateMatrix();mesh.setMatrixAt(mesh.count++,pose.matrix);
    placements.push({x,y,z,height:h,radius:h*.4*width});
  }
  for(const mesh of batches)mesh.computeBoundingSphere();
  return placements;
}
