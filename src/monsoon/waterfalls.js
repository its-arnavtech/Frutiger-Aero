import * as THREE from 'three';
import { drainage, waterfallDrops, channelAt } from './hydrology.js';
import { rng, noise } from './layout.js';

const turbulence = /* glsl */`
float whash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float wnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(whash(i),whash(i+vec2(1,0)),f.x),mix(whash(i+vec2(0,1)),whash(i+vec2(1,1)),f.x),f.y);}
float wfbm(vec2 p){return wnoise(p)*.57+wnoise(p*2.03+vec2(4.1,9.2))*.28+wnoise(p*4.07-vec2(7.3,2.8))*.15;}
`;

// A water parcel follows gravity; the curtain is sampled in height so the
// accelerating lower part keeps the same geometric resolution as the lip.
export function fallingPoint(fall, fraction, across = 0) {
  const age=fall.duration*Math.sqrt(Math.max(0,fraction));
  const distance=fall.speed*age;
  const width=fall.width*(.82+Math.sqrt(fraction)*.55);
  return new THREE.Vector3(
    fall.lip[0]+fall.direction[0]*distance+fall.direction[1]*across*width,
    fall.lip[1]-fall.drop*fraction,
    fall.lip[2]+fall.direction[1]*distance-fall.direction[0]*across*width,
  );
}

export function createCurtainGeometry(fall, layer = 0) {
  const vertices=[],uvs=[],indices=[],rows=112,columns=12;
  for(let row=0;row<=rows;row++)for(let column=0;column<=columns;column++) {
    const t=row/rows,u=column/columns;
    const ragged=.73+noise(t*28+fall.index*7,layer*11+2)*.46;
    const point=fallingPoint(fall,t,(u*2-1)*(layer?.72:1)*ragged);
    // Two separated, irregular sheets have actual depth and different tears.
    const corrugation=(noise(u*11+layer*13,t*61)-.5)*.48+(noise(u*23,t*113+8)-.5)*.19;
    point.x+=fall.direction[0]*(layer*.38+corrugation);
    point.z+=fall.direction[1]*(layer*.38+corrugation);
    vertices.push(...point.toArray());uvs.push(u,t);
    if(row<rows && column<columns){const a=row*(columns+1)+column,b=a+columns+1;indices.push(a,b,a+1,a+1,b,b+1);}
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return geometry;
}

function curtainMaterial(clock,fall,layer) {
  const material=new THREE.MeshPhysicalMaterial({
    color:'#e0ece8',roughness:.22,metalness:0,ior:1.333,
    transparent:true,opacity:1,depthWrite:false,side:THREE.DoubleSide,
    envMapIntensity:.75,
  });
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{flowTime:clock,fallDuration:{value:fall.duration},fallWidth:{value:fall.width},sheetStrength:{value:layer?.28:1},sheetSeed:{value:layer*17.3+fall.index}});
    shader.vertexShader=`varying vec2 vFlow; uniform float flowTime;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        vFlow=uv;transformed.x+=(sin(uv.y*45.-flowTime*3.7+uv.x*11.)*.12+sin(uv.y*79.-flowTime*5.2)*.08)*uv.y;`);
    shader.fragmentShader=`varying vec2 vFlow;uniform float flowTime,fallDuration,fallWidth,sheetStrength,sheetSeed;${turbulence}\n${shader.fragmentShader}`
      .replace('#include <map_fragment>',`
        float age=sqrt(max(vFlow.y,.0001))*fallDuration;
        vec2 flow=vec2(vFlow.x*fallWidth*12.+sheetSeed,(age-flowTime)*18.);
        float ribbons=wfbm(flow*vec2(1.,.23));
        float fine=wnoise(flow*vec2(3.7,1.9));
        float tears=smoothstep(.40,.69,wfbm(flow*vec2(.12,.18)))*smoothstep(.08,.55,vFlow.y);
        float edge=smoothstep(0.,.075+wnoise(flow*.7)*.085,min(vFlow.x,1.-vFlow.x));
        float aeration=clamp(smoothstep(.015,.24,vFlow.y)*.85+ribbons*.30,0.,1.);
        vec3 clearWater=vec3(.17,.31,.30),whiteWater=vec3(.82,.90,.87);
        diffuseColor.rgb*=mix(clearWater,whiteWater,aeration);
        float lace=smoothstep(.34,.66,ribbons+fine*.10-tears*.25);
        diffuseColor.a*=edge*(.035+(1.-vFlow.y)*.065+lace*.88)*sheetStrength;
        float waterRelief=(ribbons*.13+fine*.025)*(1.-vFlow.y*.35);`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor=mix(.13,.48,aeration);`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition),rx=cross(dy,normal),ry=cross(normal,dx);
        float determinant=dot(dx,rx);
        normal=normalize(abs(determinant)*normal-sign(determinant)*(dFdx(waterRelief)*rx+dFdy(waterRelief)*ry));`);
  };
  material.customProgramCacheKey=()=> 'rainmere-gravity-curtain-v1';
  return material;
}

function makeRunGeometry(stream,first,last,surfaceHeight) {
  const vertices=[],uvs=[],indices=[];let row=0,distance=0,previous;
  const startZ=stream.nodes[first][2],endZ=stream.nodes[last][2],steps=Math.ceil((endZ-startZ)/1.5);
  for(let step=0;step<=steps;step++) {
    const z=startZ+(endZ-startZ)*step/steps;
    const at=channelAt(stream,z);if(!at)continue;
    const ahead=channelAt(stream,Math.min(z+.5,stream.nodes.at(-1)[2]));
    const dx=(ahead?.x??at.x)-at.x,dz=.5,length=Math.hypot(dx,dz),nx=dz/length,nz=-dx/length;
    const point=new THREE.Vector3(at.x,at.level,z);
    if(previous)distance+=point.distanceTo(previous);previous=point;
    for(const side of [-1,1]) {
      const x=at.x+nx*stream.width*side,sz=z+nz*stream.width*side;
      // The lip is a shallow flowing film in the carved bed; the pools and
      // airborne curtains are separate meshes rather than painted cliff lines.
      const y=Math.max(surfaceHeight(x,sz)+.08,at.level);
      vertices.push(x,y,sz);uvs.push((side+1)/2,distance*.16);
    }
    if(row){const a=(row-1)*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}row++;
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}

function runMaterial(clock) {
  const material=new THREE.MeshStandardMaterial({color:'#aac5bc',transparent:true,opacity:.83,roughness:.24,envMapIntensity:1,depthWrite:false,side:THREE.DoubleSide});
  material.onBeforeCompile=shader=>{
    shader.uniforms.flowTime=clock;
    shader.vertexShader=`varying vec2 vFlow;\n${shader.vertexShader}`.replace('#include <begin_vertex>','#include <begin_vertex>\nvFlow=uv;');
    shader.fragmentShader=`varying vec2 vFlow;uniform float flowTime;${turbulence}\n${shader.fragmentShader}`
      .replace('#include <map_fragment>',`
        float foam=smoothstep(.49,.76,wfbm(vec2(vFlow.x*6.,vFlow.y-flowTime*.85)));
        diffuseColor.rgb*=mix(vec3(.12,.24,.21),vec3(.77,.84,.79),foam);
        diffuseColor.a*=smoothstep(0.,.13,min(vFlow.x,1.-vFlow.x))*(.72+foam*.28);`);
  };material.customProgramCacheKey=()=> 'rainmere-connected-whitewater-runs-v1';return material;
}

function addPool(scene,clock,fall) {
  const [radiusX,radiusZ]=fall.poolRadii;
  const waterMaterial=new THREE.MeshPhysicalMaterial({color:'#3b6d61',roughness:.17,metalness:0,ior:1.333,envMapIntensity:1.1});
  const pool=new THREE.Mesh(new THREE.CircleGeometry(1,64),waterMaterial);
  pool.rotation.x=-Math.PI/2;pool.scale.set(radiusX,radiusZ,1);pool.position.fromArray(fall.landing);pool.position.y+=.025;
  pool.name='Excavated glacial plunge pool';scene.add(pool);
  const foam=new THREE.Mesh(new THREE.PlaneGeometry(radiusX*2,radiusZ*2),new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:clock},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv;uniform float time;${turbulence}
      void main(){vec2 p=(vUv-.5)*2.;float radius=length(p);
        vec2 flow=p*(2.5-fract(time*.12)) + vec2(time*.13,-time*.31);
        float breakup=wfbm(flow*5.);float centre=exp(-dot(p,p)*10.);
        float ring=sin(radius*31.-time*3.+breakup*4.)*.5+.5;
        float foam=smoothstep(.37,.68,breakup+centre*.5)*(.35+centre*.65+ring*.2);
        float edge=1.-smoothstep(.68,.98+wnoise(p*7.)*.08,radius);
        gl_FragColor=vec4(vec3(.74,.83,.80),foam*edge*.8);}`,
  }));
  foam.rotation.copy(pool.rotation);foam.position.copy(pool.position);foam.position.y+=.045;
  foam.name='Churning impact foam and expanding turbulent rings';scene.add(foam);
}

function addSpray(scene,clock,fall,profile,seed) {
  const random=rng(seed),count=profile.low?70:profile.mobile?150:320;
  const geometry=new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1,1));
  const seeds=new Float32Array(count*4);
  for(let i=0;i<count;i++)seeds.set([random(),random(),random(),random()],i*4);
  geometry.setAttribute('seed',new THREE.InstancedBufferAttribute(seeds,4));geometry.instanceCount=count;
  const spray=new THREE.Mesh(geometry,new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,uniforms:{time:clock,lip:{value:new THREE.Vector3(...fall.lip)},impact:{value:new THREE.Vector3(...fall.landing)},
      direction:{value:new THREE.Vector2(...fall.direction)},duration:{value:fall.duration},speed:{value:fall.speed},width:{value:fall.width}},
    vertexShader:`attribute vec4 seed;uniform float time,duration,speed,width;uniform vec3 lip,impact;uniform vec2 direction;varying vec2 vUv;varying float fade;
      void main(){vUv=uv;vec3 p;float size;
        if(seed.w<.68){float life=1.2+seed.z*.9,age=fract(time/life+seed.x)*life,angle=seed.y*6.2831853;
          float launch=3.3+seed.z*4.;p=impact+vec3(cos(angle)*age*launch,age*(4.+seed.z*5.)-4.905*age*age,sin(angle)*age*launch);
          p.y=max(impact.y+.07,p.y);fade=sin(age/life*3.14159)*.33;size=.22+seed.z*.65;
        }else{float age=fract(time/duration+seed.x)*duration;vec2 forward=direction*speed*age;
          p=lip+vec3(forward.x+direction.y*(seed.y-.5)*width*3.,-4.905*age*age,forward.y-direction.x*(seed.y-.5)*width*3.);
          fade=sin(age/duration*3.14159)*.20;size=.14+seed.z*.45;
        }
        vec4 mv=modelViewMatrix*vec4(p,1.);mv.xy+=position.xy*size;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`varying vec2 vUv;varying float fade;void main(){vec2 p=(vUv-.5)*2.;float a=exp(-dot(p,p)*3.8)*(1.-smoothstep(.65,1.,length(p)));gl_FragColor=vec4(.70,.80,.78,a*fade);}`,
  }));
  spray.frustumCulled=false;spray.layers.set(1);spray.name='Ballistic droplets and rebounding impact spray';scene.add(spray);
  // Several small moving fog lobes retain depth around the impact, without
  // covering the waterfall with one large opaque white billboard.
  const mistMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:clock},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv;uniform float time;${turbulence}void main(){vec2 p=(vUv-.5)*2.;float edge=exp(-dot(p,p)*3.)*(1.-smoothstep(.55,1.,length(p)));float clouds=wfbm(vUv*5.+vec2(time*.13,-time*.17));gl_FragColor=vec4(.77,.84,.82,edge*clouds*.38);}`});
  const lobes=[];
  for(let i=0;i<5;i++) {
    const mist=new THREE.Mesh(new THREE.PlaneGeometry(fall.width*(5+i*.7),fall.width*(3+i*.6)),mistMaterial);
    mist.position.fromArray(fall.landing);mist.position.x+=(random()-.5)*fall.width*3;mist.position.z+=(random()-.5)*fall.width*3;mist.position.y+=fall.width*(.8+i*.65);
    mist.layers.set(1);mist.name='Wind-sheared waterfall mist';scene.add(mist);lobes.push(mist);
  }
  return lobes;
}

export function createWaterfalls(scene,profile,surfaceHeight) {
  const clock={value:0},mist=[];
  const material=runMaterial(clock);
  for(const stream of drainage) {
    let start=0;
    for(const lip of [...stream.lips,stream.nodes.length-1]) {
      const mesh=new THREE.Mesh(makeRunGeometry(stream,start,lip,surfaceHeight),material);
      mesh.name='Connected downhill whitewater channel';scene.add(mesh);start=lip+1;
    }
  }
  for(let i=0;i<waterfallDrops.length;i++) {
    const fall=waterfallDrops[i];
    for(let layer=0;layer<2;layer++) {
      const mesh=new THREE.Mesh(createCurtainGeometry(fall,layer),curtainMaterial(clock,fall,layer));
      mesh.name=`${fall.stream.name}: airborne curtain ${fall.index}/${layer}`;mesh.receiveShadow=true;scene.add(mesh);
    }
    addPool(scene,clock,fall);mist.push(...addSpray(scene,clock,fall,profile,193+i*143));
  }
  return {drops:waterfallDrops,update(time,camera){clock.value=time;for(const lobe of mist)lobe.quaternion.copy(camera.quaternion);}};
}
