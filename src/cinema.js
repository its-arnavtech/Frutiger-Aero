import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export function createCinema(renderer,scene,camera) {
  const target=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType,samples:2});
  const composer=new EffectComposer(renderer,target);
  composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.12,.55,1.15);
  composer.addPass(bloom);composer.addPass(new OutputPass());
  const grade=new ShaderPass({
    uniforms:{tDiffuse:{value:null}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform sampler2D tDiffuse;varying vec2 vUv;
      void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;
      float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,1.24);
      float blue=max(0.,c.b-max(c.r,c.g));c.r-=blue*.3;c.g+=blue*.3;
      c=(c-.5)*1.10+.5;gl_FragColor=vec4(clamp(c,0.,1.),1.);}`,
  });
  composer.addPass(grade);
  composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(innerWidth,innerHeight);
  return {
    render(dt){composer.render(dt);},
    resize(){composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(innerWidth,innerHeight);},
    setEconomy(){bloom.enabled=false;},
  };
}
