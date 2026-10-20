import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { terrainHeight } from './layout.js';

export function createRiver(scene, { waterNormals, sunDirection, profile, forest, signal }) {
  const water = new Water(new THREE.PlaneGeometry(2300, 2300), {
    textureWidth: profile.mirrorSize, textureHeight: profile.mirrorSize,
    waterNormals, sunDirection, sunColor: '#fff0d7', fog: true,
  });
  // This chart follows the same river banks and island as the terrain mesh.
  const size = 512, heights = new Uint8Array(size * size);
  for (let z=0;z<size;z++) for (let x=0;x<size;x++) heights[z*size+x]=Math.round(THREE.MathUtils.clamp(-terrainHeight(x/(size-1)*820-410,z/(size-1)*1000-580)/5,0,1)*255);
  const depth = new THREE.DataTexture(heights,size,size,THREE.RedFormat);
  depth.minFilter=depth.magFilter=THREE.LinearFilter; depth.needsUpdate=true;
  Object.assign(water.material.uniforms, { riverDepth:{value:depth} });
  water.material.transparent = true; water.material.depthWrite = false;
  water.material.fragmentShader = /* glsl */`
    uniform sampler2D mirrorSampler,normalSampler,riverDepth;
    uniform float time; uniform vec3 sunColor,sunDirection,eye;
    varying vec4 mirrorCoord,worldPosition;
    #include <common>
    #include <packing>
    #include <bsdfs>
    #include <fog_pars_fragment>
    #include <lights_pars_begin>
    #include <shadowmap_pars_fragment>
    #include <shadowmask_pars_fragment>
    void main(){
      vec2 p=worldPosition.xz;
      vec3 toEye=eye-worldPosition.xyz;float range=length(toEye);vec3 view=toEye/range;
      vec2 broad=texture2D(normalSampler,p*.025+time*vec2(.004,.012)).xy-.5;
      vec2 small=texture2D(normalSampler,p*.14+time*vec2(-.009,.02)).xy-.5;
      vec2 slope=(broad*.06+small*.025)/(1.+range*.003);
      vec3 normal=normalize(vec3(slope.x,1.,slope.y));
      float facing=max(dot(view,normal),0.);
      float fresnel=.025+.975*pow(1.-facing,5.);
      vec3 mirror=texture2D(mirrorSampler,mirrorCoord.xy/mirrorCoord.w+slope*.025).rgb;
      float depth=texture2D(riverDepth,(p+vec2(410.,580.))/vec2(820.,1000.)).r*5.;
      float light=getShadowMask();
      float path=depth/max(facing,.22), absorption=1.-exp(-path*.15);
      float opacity=clamp(fresnel+absorption*(1.-fresnel),.025,.98);
      vec3 body=vec3(.035,.105,.088)*(.7+.3*light);
      vec3 color=(mirror*fresnel+body*absorption*(1.-fresnel))/max(opacity,.001);
      float sun=pow(max(dot(normal,normalize(view+sunDirection)),0.),450.);
      color+=sunColor*sun*.75*light;
      gl_FragColor=vec4(color,opacity);
      #include <fog_fragment>
    }`;
  water.rotation.x=-Math.PI/2;water.receiveShadow=true;water.renderOrder=2;water.name='Clear shallow river over a smooth natural bed';scene.add(water);
  const reflect=water.onBeforeRender;
  water.onBeforeRender=(...args)=>{forest.reflectionBegin();try{reflect(...args);}finally{forest.reflectionEnd();}};
  signal.addEventListener('abort',()=>depth.dispose(),{once:true});
  return water;
}
