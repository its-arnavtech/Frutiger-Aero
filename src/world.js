import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { cameraAt, lookAt, islands, islandHeight } from './journey.js';
import { loadSurfaces, createLandscape } from './landscape.js';
import { createVegetation } from './vegetation.js';
import { createArchitecture } from './architecture.js';
import { createCinema } from './cinema.js';

const TAU = Math.PI * 2;

function glassShell(environment) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { sky: { value: environment } },
    vertexShader: `varying vec3 worldNormal;varying vec3 worldPoint;
      void main(){vec4 p=modelMatrix*vec4(position,1.);worldPoint=p.xyz;
      worldNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader: `uniform sampler2D sky;varying vec3 worldNormal;varying vec3 worldPoint;
      void main(){vec3 n=normalize(worldNormal),v=normalize(cameraPosition-worldPoint);
      float f=pow(1.-max(dot(n,v),0.),4.);vec3 r=reflect(-v,n);
      vec2 uv=vec2(atan(r.z,r.x)*.15915494+.5,asin(clamp(r.y,-1.,1.))*.31830989+.5);
      vec3 reflected=texture2D(sky,uv).rgb;
      vec3 film=.72+.28*cos(vec3(0.,2.1,4.2)+f*12.);
      gl_FragColor=vec4(reflected*mix(vec3(1.),film,.32),.025+f*.82);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  });
}

function createWaterfalls(scene) {
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec2 vUv;uniform float time;
      void main(){vUv=uv;vec3 p=position;p.z+=sin(uv.y*18.+time*2.+uv.x*12.)*.065;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `varying vec2 vUv;uniform float time;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      void main(){vec2 uv=vUv;float n=noise(vec2(uv.x*39.,uv.y*6.+time*2.));
      float fine=noise(vec2(uv.x*103.,uv.y*24.+time*7.));
      float edge=smoothstep(0.,.2,uv.x)*smoothstep(1.,.8,uv.x);
      float a=(.09+.4*n+.16*fine)*edge*smoothstep(0.,.12,uv.y);
      gl_FragColor=vec4(mix(vec3(.53,.85,.89),vec3(.95,1.,1.),fine),a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  });
  for (const [x,z] of [[-16,-83],[-4,-84],[-10,-77]]) {
    for(let layer=0;layer<2;layer++) {
      const fall=new THREE.Mesh(new THREE.PlaneGeometry(1.65,13,10,40),material);
      fall.position.set(x+layer*.13,6.6,z+layer*.11);fall.rotation.y=Math.atan2(x+10,z+84)+layer*.3;scene.add(fall);
    }
  }
  return material;
}

export async function createWorld(canvas) {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  let pixelRatio=Math.min(devicePixelRatio,1.75);
  renderer.setPixelRatio(pixelRatio);renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0xb7e4ec,.0017);
  const camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.2,1600);
  const loader=new THREE.TextureLoader();
  const [hdr,sky,waterNormals,maps]=await Promise.all([
    new HDRLoader().loadAsync('/assets/environment/kloofendal_48d_partly_cloudy_puresky_2k.hdr'),
    loader.loadAsync('/assets/environment/kloofendal_48d_partly_cloudy_puresky_4k.jpg'),
    loader.loadAsync('/assets/materials/waternormals.jpg'),loadSurfaces(renderer),
  ]);
  hdr.mapping=THREE.EquirectangularReflectionMapping;
  sky.mapping=THREE.EquirectangularReflectionMapping;sky.colorSpace=THREE.SRGBColorSpace;
  scene.background=hdr;scene.backgroundIntensity=.85;
  const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromEquirectangular(hdr).texture;
  scene.environmentIntensity=.65;pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe5f9ff,0x65733d,.55));
  const sunDirection=new THREE.Vector3(-.5,.8,.6).normalize();
  const sun=new THREE.DirectionalLight(0xfff5e4,2.1);sun.position.set(-50,95,40);sun.target.position.set(0,0,-40);
  sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);
  sun.shadow.camera.left=sun.shadow.camera.bottom=-115;sun.shadow.camera.right=sun.shadow.camera.top=115;
  sun.shadow.camera.far=300;sun.shadow.bias=-.00012;sun.shadow.normalBias=.06;scene.add(sun,sun.target);
  let seed=38174;const random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
  createLandscape({scene,maps,random});
  const vegetation=await createVegetation({scene,islands,islandHeight,renderer});
  createArchitecture({scene,environment:scene.environment,islands,islandHeight});

  const glass=glassShell(hdr),sphere=new THREE.SphereGeometry(1,64,48),bubbles=[];
  for(const [x,y,z,r] of [[-10,24,-84,14],[-19,14,24,5.8]]) {
    const shell=new THREE.Mesh(sphere,glass);shell.position.set(x,y,z);shell.scale.setScalar(r);scene.add(shell);
  }
  for(let i=0;i<15;i++) {
    const orb=new THREE.Mesh(sphere,glass),x=(random()-.5)*85,y=5+random()*29,z=55-random()*190;
    orb.position.set(x,y,z);orb.scale.setScalar(.3+random()*1.7);scene.add(orb);
    bubbles.push({orb,x,y,z,phase:random()*TAU});
  }
  waterNormals.wrapS=waterNormals.wrapT=THREE.RepeatWrapping;
  const water=new Water(new THREE.PlaneGeometry(1600,1600),{
    textureWidth:768,textureHeight:768,waterNormals,sunDirection,sunColor:0xfff9e8,
    waterColor:0x009da5,distortionScale:1.45,fog:true,
  });
  water.rotation.x=-Math.PI/2;water.material.uniforms.size.value=3;
  water.material.fragmentShader=water.material.fragmentShader.replace('float rf0 = 0.3;','float rf0 = 0.065;');
  scene.add(water);
  const reflect=water.onBeforeRender;
  water.onBeforeRender=function(...args){vegetation.reflectionBegin();try{reflect.apply(this,args);}finally{vegetation.reflectionEnd();}};
  const waterfalls=createWaterfalls(scene);
  renderer.shadowMap.needsUpdate=true;
  const cinema=createCinema(renderer,scene,camera),cameraTarget=new THREE.Vector3();
  let liveTime=0,slow=0,frames=0,sampleTime=performance.now();
  renderer.info.autoReset=false;
  function render(progress,pointer,dt,reducedMotion=false) {
    if(!reducedMotion)liveTime+=dt;
    const time=liveTime*.38+progress*55,pos=cameraAt(progress),target=lookAt(progress);
    camera.position.set(pos.x,pos.y,pos.z);cameraTarget.set(target.x+pointer.x*.5,target.y+pointer.y*.3,target.z);camera.lookAt(cameraTarget);
    vegetation.update(time,camera);water.material.uniforms.time.value=time*.27;waterfalls.uniforms.time.value=time;
    for(const b of bubbles)b.orb.position.set(b.x+Math.sin(time*.12+b.phase)*.45,b.y+Math.sin(time*.23+b.phase)*.65,b.z);
    renderer.info.reset();cinema.render(dt);
    frames++;const elapsed=performance.now()-sampleTime;
    if(elapsed>1000){
      canvas.dataset.camera=camera.position.toArray().map(v=>v.toFixed(2)).join(',');
      canvas.dataset.fov=String(camera.fov);canvas.dataset.fps=String(Math.round(frames*1000/elapsed));
      canvas.dataset.triangles=String(renderer.info.render.triangles);canvas.dataset.calls=String(renderer.info.render.calls);
      canvas.dataset.trees=String(vegetation.stats.trees);canvas.dataset.pixelRatio=String(pixelRatio);
      frames=0;sampleTime=performance.now();
    }
    if(dt>.03)slow++;else slow=Math.max(0,slow-2);
    if(slow>100){
      if(pixelRatio>1){pixelRatio=Math.max(1,pixelRatio-.25);renderer.setPixelRatio(pixelRatio);cinema.resize();}
      else cinema.setEconomy();
      slow=0;
    }
  }
  function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);cinema.resize();}
  return {render,resize,renderer,scene,camera};
}
