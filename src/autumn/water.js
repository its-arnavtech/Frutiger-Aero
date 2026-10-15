import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { terrainHeight } from './layout.js';

export function createRiver(scene, { waterNormals, groundMap, sunDirection, profile, forest, signal }) {
  const water = new Water(new THREE.PlaneGeometry(2300, 2300), {
    textureWidth: profile.mirrorSize, textureHeight: profile.mirrorSize,
    waterNormals, sunDirection, sunColor: '#fff0d7', fog: true,
  });
  // This chart follows the same river banks and island as the terrain mesh.
  const size = 512, heights = new Uint8Array(size * size);
  for (let z=0;z<size;z++) for (let x=0;x<size;x++) heights[z*size+x]=Math.round(THREE.MathUtils.clamp(-terrainHeight(x/(size-1)*820-410,z/(size-1)*1000-580)/5,0,1)*255);
  const depth = new THREE.DataTexture(heights,size,size,THREE.RedFormat);
  depth.minFilter=depth.magFilter=THREE.LinearFilter; depth.needsUpdate=true;
  Object.assign(water.material.uniforms, { riverDepth:{value:depth}, groundMap:{value:groundMap} });
  water.material.fragmentShader = /* glsl */`
    uniform sampler2D mirrorSampler,normalSampler,riverDepth,groundMap;
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
      vec2 broad=texture2D(normalSampler,p*.035+time*vec2(.011,.016)).xy;
      vec2 small=texture2D(normalSampler,p*.23+time*vec2(-.015,.027)).xy;
      vec2 fine=texture2D(normalSampler,p*.64+time*vec2(.018,.022)).xy;
      vec2 slope=((broad-.5)*.36+(small-.5)*.22+(fine-.5)*.085)/(1.+range*.004);
      vec3 normal=normalize(vec3(slope.x,1.,slope.y));
      float facing=max(dot(view,normal),0.);
      float fresnel=.025+.975*pow(1.-facing,5.);
      vec3 mirror=texture2D(mirrorSampler,mirrorCoord.xy/mirrorCoord.w+slope*.055).rgb;
      float depth=texture2D(riverDepth,(p+vec2(410.,580.))/vec2(820.,1000.)).r*5.;
      vec3 refracted=refract(-view,normal,.75);
      float path=max(.05,depth)/max(-refracted.y,.18);
      vec2 bed=p+refracted.xz*min(path,7.);
      vec3 gravel=texture2D(groundMap,bed*.32).rgb;
      float lines=pow(1.-smoothstep(0.,.1,abs(broad.x+small.y-1.)),3.);
      float light=getShadowMask();
      vec3 transmission=exp(-path*vec3(.38,.18,.13));
      vec3 body=gravel*(.5+.5*light)*(1.+lines*.35)*transmission+vec3(.035,.095,.10)*(1.-transmission);
      vec3 color=mix(body,mirror,fresnel);
      float sun=pow(max(dot(normal,normalize(view+sunDirection)),0.),650.);
      color+=sunColor*sun*7.*light;
      float shore=(1.-smoothstep(.05,.24,depth))*smoothstep(0.,.035,depth);
      color=mix(color,vec3(.54,.61,.57),shore*smoothstep(.42,.65,fine.x)*.25);
      gl_FragColor=vec4(color,1.);
      #include <fog_fragment>
    }`;
  water.rotation.x=-Math.PI/2;water.receiveShadow=true;water.name='River with shallow gravel bed';scene.add(water);
  const reflect=water.onBeforeRender;
  water.onBeforeRender=(...args)=>{forest.reflectionBegin();try{reflect(...args);}finally{forest.reflectionEnd();}};
  signal.addEventListener('abort',()=>depth.dispose(),{once:true});
  return water;
}
