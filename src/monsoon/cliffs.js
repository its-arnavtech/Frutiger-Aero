import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { waterfallDrops } from './hydrology.js';
import { fallingPoint } from './waterfalls.js';
import { rng } from './layout.js';

// The surveyed DEM cannot contain individual overhangs. A CC0 photogrammetry
// outcrop supplies real undercuts and broken strata around the cascade walls.
export async function loadCliffScan(renderer,signal,resources) {
  const asset=await new GLTFLoader().loadAsync('/assets/monsoon/rock-face-scan/rock_face_01.gltf');
  let source;
  asset.scene.traverse(object=>{
    if(!object.isMesh)return;
    source ??= object;
    resources.add(object.geometry);resources.add(object.material);
    for(const value of Object.values(object.material))if(value?.isTexture){
      value.anisotropy=renderer.capabilities.getMaxAnisotropy();resources.add(value);
    }
  });
  if(signal.aborted){for(const resource of resources)resource.dispose();throw signal.reason;}
  if(!source)throw new Error('The cliff surface could not be loaded.');
  source.material.color.set('#aeb6b2');source.material.envMapIntensity=.6;
  source.material.normalScale?.set(.85,.85);
  return source;
}

export function buildScannedCliffs(scene,source,profile,surfaceHeight) {
  const random=rng(57391),pose=new THREE.Object3D(),placements=[];
  for(const fall of waterfallDrops)for(const fraction of (profile.low?[.52]:[.23,.58,.87]))for(const side of [-1,1]) {
    const point=fallingPoint(fall,fraction),scale=4.5+random()*3.8;
    const x=point.x+side*(scale*4.5+fall.width*1.8),z=point.z+(random()-.5)*5;
    const y=surfaceHeight(x,z),dx=(surfaceHeight(x+4,z)-surfaceHeight(x-4,z))/8,dz=(surfaceHeight(x,z+4)-surfaceHeight(x,z-4))/8;
    const turn=Math.atan2(-dx,-dz);
    pose.position.set(x,y-scale*.65,z);pose.rotation.set((random()-.5)*.1,turn+(random()-.5)*.25,(random()-.5)*.09);
    pose.scale.set(scale*(.88+random()*.25),scale,scale);pose.updateMatrix();placements.push(pose.matrix.clone());
  }
  const cliffs=new THREE.InstancedMesh(source.geometry,source.material,placements.length);
  for(let i=0;i<placements.length;i++)cliffs.setMatrixAt(i,placements[i]);
  cliffs.castShadow=cliffs.receiveShadow=true;cliffs.computeBoundingSphere();
  cliffs.name='Photogrammetric fractured cliff faces around the cascades';scene.add(cliffs);
  return cliffs;
}
