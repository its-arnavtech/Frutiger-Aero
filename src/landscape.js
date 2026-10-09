import * as THREE from 'three';
import { islands, islandHeight } from './journey.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export async function loadSurfaces(renderer) {
  const loader = new THREE.TextureLoader();
  async function set(name) {
    const [color, normal, roughness] = await Promise.all(['diff','nor_gl','rough'].map(kind => loader.loadAsync(`/assets/materials/${name}_${kind}_1k.jpg`)));
    color.colorSpace = THREE.SRGBColorSpace;
    for(const texture of [color, normal, roughness]) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    }
    return {color, normal, roughness};
  }
  const [grass,rock,sand] = await Promise.all([set('leafy_grass'),set('marble_cliff_02'),set('coast_sand_01')]);
  return {grass, rock, sand};
}

function terrainGeometry(island, detail=1) {
  const rings = Math.round(52 * detail), segments = Math.round(128 * detail);
  const vertices=[],uvs=[],indices=[];
  for(let r=0;r<=rings;r++)for(let a=0;a<=segments;a++) {
    const angle=a/segments*Math.PI*2,radius=r/rings;
    const edge=1+.07*Math.sin(angle*5+island.seed)+.035*Math.sin(angle*9);
    const x=island.x+Math.cos(angle)*radius*island.rx*edge,z=island.z+Math.sin(angle)*radius*island.rz*edge;
    const y=islandHeight(island,x,z);
    vertices.push(x,y,z);uvs.push(x*.32,z*.32);
    if(r<rings&&a<segments){const i=r*(segments+1)+a;indices.push(i,i+1,i+segments+1,i+1,i+segments+2,i+segments+1);}
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}

function groundMaterial(maps) {
  const material=new THREE.MeshStandardMaterial({map:maps.grass.color,normalMap:maps.grass.normal,roughnessMap:maps.grass.roughness,roughness:.95,normalScale:new THREE.Vector2(.55,.55)});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{
      groundSand:{value:maps.sand.color},groundRock:{value:maps.rock.color},
      sandNormal:{value:maps.sand.normal},rockNormal:{value:maps.rock.normal},
    });
    shader.vertexShader='varying vec3 terrainPoint; varying vec3 terrainNormal;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nterrainPoint=position;terrainNormal=normal;');
    shader.fragmentShader='varying vec3 terrainPoint; varying vec3 terrainNormal; uniform sampler2D groundSand;uniform sampler2D groundRock;uniform sampler2D sandNormal;uniform sampler2D rockNormal;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      float shoreline=1.-smoothstep(.05,.9,terrainPoint.y);
      float cliff=smoothstep(.28,.64,1.-normalize(terrainNormal).y)*(1.-shoreline);
      vec3 grass=texture2D(map,vMapUv).rgb*vec3(.28,.72,.12);
      vec3 sand=texture2D(groundSand,terrainPoint.xz*.24).rgb;
      vec3 rock=texture2D(groundRock,terrainPoint.xz*.23).rgb;
      diffuseColor.rgb*=mix(mix(grass,sand,shoreline),rock,cliff);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',THREE.ShaderChunk.normal_fragment_maps).replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',`
      vec3 mapN = mix(mix(texture2D(normalMap,vNormalMapUv).xyz,texture2D(sandNormal,terrainPoint.xz*.24).xyz,shoreline),texture2D(rockNormal,terrainPoint.xz*.23).xyz,cliff)*2.-1.;
    `);
  };
  return material;
}

function rockGeometry() {
  let geometry=new THREE.IcosahedronGeometry(1,3);
  geometry.deleteAttribute('normal');geometry.deleteAttribute('uv');geometry=mergeVertices(geometry);
  const positions=geometry.attributes.position,uv=[];
  for(let i=0;i<positions.count;i++) {
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    const shape=1+.13*Math.sin(x*5+z*3)+.08*Math.sin(y*9-z*7)+.035*Math.sin(x*23+y*19+z*17);
    positions.setXYZ(i,x*shape,y*shape*.7,z*shape);
    uv.push(Math.atan2(z,x)/Math.PI*.5+.5,Math.asin(Math.max(-1,Math.min(1,y)))/Math.PI+.5);
  }
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();return geometry;
}

export function createLandscape({scene,maps,random}) {
  const ground=groundMaterial(maps),shoreRocks=[],matrix=new THREE.Object3D();
  for(const island of islands) {
    const terrain=new THREE.Mesh(terrainGeometry(island,island.z < -130?.65:1),ground);
    terrain.receiveShadow=true;scene.add(terrain);
    for(let i=0;i<32;i++) {
      const a=random()*Math.PI*2,r=.72+random()*.3;
      const x=island.x+Math.cos(a)*r*island.rx,z=island.z+Math.sin(a)*r*island.rz;
      const s=.45+Math.pow(random(),2)*2.4;
      shoreRocks.push({x,z,y:Math.max(-.6,islandHeight(island,x,z))-.2,s,angle:random()*Math.PI*2});
    }
  }
  const cliff=new THREE.MeshStandardMaterial({map:maps.rock.color,normalMap:maps.rock.normal,roughnessMap:maps.rock.roughness,roughness:.93,normalScale:new THREE.Vector2(.8,.8),color:0xf4fff5});
  const geometry=rockGeometry();
  const rocks=new THREE.InstancedMesh(geometry,cliff,shoreRocks.length);
  shoreRocks.forEach((r,i)=>{matrix.position.set(r.x,r.y,r.z);matrix.rotation.set(.12,r.angle,.07);matrix.scale.set(r.s,r.s*(.65+random()*.3),r.s*(.8+random()*.5));matrix.updateMatrix();rocks.setMatrixAt(i,matrix.matrix);});
  rocks.castShadow=true;rocks.receiveShadow=true;scene.add(rocks);
  for(const [x,y,z,r,h] of [[-10,13,-84,7.7,2.8],[-19,10,24,3.2,1.6]]) {
    const island={x,z,rx:r,rz:r,h,seed:42};
    const floating=new THREE.Mesh(terrainGeometry(island,.8),ground);floating.position.y=y;floating.castShadow=true;floating.receiveShadow=true;scene.add(floating);
    const foundation=new THREE.Mesh(geometry,cliff);foundation.position.set(x,y-2.4,z);foundation.scale.set(r*.99,4.8,r*.99);foundation.castShadow=true;foundation.receiveShadow=true;scene.add(foundation);
  }
  const sand=maps.sand.color.clone();sand.repeat.set(230,230);sand.needsUpdate=true;
  const bottom=new THREE.Mesh(new THREE.PlaneGeometry(1600,1600),new THREE.MeshStandardMaterial({map:sand,color:0xb3e5d8,roughness:1}));
  bottom.rotation.x=-Math.PI/2;bottom.position.y=-4.5;bottom.receiveShadow=true;scene.add(bottom);
  return {ground,cliff,rocks};
}
