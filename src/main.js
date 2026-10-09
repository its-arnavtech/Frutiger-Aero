import './style.css';
import { createWorld } from './world';
import { createAmbience } from './audio';
import { clamp } from './journey';

const $=s=>document.querySelector(s);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const scrubber=$('#scrubber'),playButton=$('#play'),soundButton=$('#sound');
let progress=0,target=0,playing=false,last=performance.now(),world,atmosphere,frameId;
let pointer={x:0,y:0},pointerTarget={x:0,y:0};
const ambience=createAmbience();
const scrollRange=()=>document.documentElement.scrollHeight-innerHeight;
function seek(value){target=clamp(value);window.scrollTo({top:target*scrollRange(),behavior:'instant'});}
function setPlaying(value){playing=value;playButton.setAttribute('aria-pressed',String(value));playButton.setAttribute('aria-label',value?'Pause journey':'Play journey');}
function notice(message){$('#notice').textContent=message;$('#notice').classList.add('visible');setTimeout(()=>$('#notice').classList.remove('visible'),4500);}
addEventListener('scroll',()=>{if(!playing)target=clamp(scrollY/scrollRange());},{passive:true});
addEventListener('wheel',()=>setPlaying(false),{passive:true});
addEventListener('touchstart',event=>{if(!event.target.closest('.transport'))setPlaying(false);},{passive:true});
addEventListener('pointermove',event=>{pointerTarget={x:event.clientX/innerWidth*2-1,y:1-event.clientY/innerHeight*2};},{passive:true});
scrubber.addEventListener('input',()=>{setPlaying(false);seek(Number(scrubber.value)/1000);});
playButton.addEventListener('click',()=>{if(progress>.999)seek(0);setPlaying(!playing);});
$('#replay').addEventListener('click',()=>{setPlaying(false);seek(0);});
$('#home').addEventListener('click',()=>{setPlaying(false);seek(0);});
document.querySelectorAll('.waypoint').forEach(button=>button.addEventListener('click',()=>{setPlaying(false);seek(Number(button.dataset.progress));}));
soundButton.addEventListener('click',async()=>{try{const enabled=await ambience.toggle();soundButton.setAttribute('aria-pressed',String(enabled));soundButton.setAttribute('aria-label',enabled?'Mute ambient sound':'Enable ambient sound');}catch{notice('Ambient sound is unavailable in this browser.');}});
$('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notice('Fullscreen is unavailable in this browser.');}});
addEventListener('fullscreenchange',()=>$('#fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit fullscreen':'Enter fullscreen'));
addEventListener('keydown',event=>{
 if(event.target.matches('input,button'))return;
 if(event.code==='Space'){event.preventDefault();if(progress>.999)seek(0);setPlaying(!playing);}
 if(event.code==='Home'){event.preventDefault();setPlaying(false);seek(0);}
 if(event.code==='End'){event.preventDefault();setPlaying(false);seek(1);}
 if(['ArrowDown','ArrowUp','PageDown','PageUp'].includes(event.code))setPlaying(false);
});
addEventListener('resize',()=>{world?.resize();atmosphere?.resize();seek(target);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frameId);ambience.suspend();}else{last=performance.now();ambience.resume();frameId=requestAnimationFrame(frame);}});

function frame(now){
 const dt=Math.min((now-last)/1000,.05);last=now;
 if(playing){seek(target+dt/95);if(target>=1)setPlaying(false);}
 const ease=reducedMotion.matches?1:1-Math.exp(-dt*7.5);
 progress+=(target-progress)*ease;
 if(Math.abs(progress-target)<.000005)progress=target;
 pointer.x+=(pointerTarget.x-pointer.x)*ease;pointer.y+=(pointerTarget.y-pointer.y)*ease;
 if(reducedMotion.matches)pointer={x:0,y:0};
 world?.render(progress,pointer,dt,reducedMotion.matches);atmosphere?.render(progress,pointer);
 ambience.update(0);
 scrubber.value=String(Math.round(progress*1000));scrubber.style.setProperty('--progress',`${progress*100}%`);
 $('#scroll-hint').style.opacity=progress<.025?'0.9':'0';
 document.querySelectorAll('.waypoint').forEach((button,index)=>{const active=index===(progress<.32?0:progress<.73?1:2);button.classList.toggle('active',active);button.setAttribute('aria-current',active?'step':'false');});
 frameId=requestAnimationFrame(frame);
}

async function init(){
 target=clamp(scrollY/scrollRange());progress=target;
 try{world=await createWorld($('#world'));}catch(error){console.error('World renderer unavailable:',error);$('#world').style.display='none';$('#fallback').textContent='This 3D world needs WebGL. Please enable hardware acceleration or open it in another browser.';}
 try{const {createAtmosphere}=await import('./atmosphere');atmosphere=createAtmosphere();}catch(error){console.warn('Optional atmosphere unavailable:',error);}
 $('#loading').classList.add('loaded');last=performance.now();frameId=requestAnimationFrame(frame);
}
init();
