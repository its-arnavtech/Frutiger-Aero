export function createAmbience(){
 let context,gain,filter,enabled=false;
 async function toggle(){
   if(!context){
     context=new AudioContext();gain=context.createGain();gain.gain.value=0;gain.connect(context.destination);
     // Generated pinkish air and a quiet, open fifth; no remote audio files.
     const length=context.sampleRate*6,buffer=context.createBuffer(2,length,context.sampleRate);
     for(let c=0;c<2;c++){const data=buffer.getChannelData(c);let previous=0;for(let i=0;i<length;i++){previous=(previous+Math.random()*.035-.0175)*.985;data[i]=previous;}}
     const noise=context.createBufferSource();noise.buffer=buffer;noise.loop=true;
     filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1200;noise.connect(filter);filter.connect(gain);noise.start();
     for(const frequency of[130.81,196,261.63]){const oscillator=context.createOscillator(),voice=context.createGain();oscillator.type='sine';oscillator.frequency.value=frequency;voice.gain.value=.017;oscillator.connect(voice);voice.connect(gain);oscillator.start();}
   }
   await context.resume();enabled=!enabled;gain.gain.setTargetAtTime(enabled?.65:0,context.currentTime,.5);return enabled;
 }
 function update(water){if(filter)filter.frequency.setTargetAtTime(1200-water*920,context.currentTime,.2);}
 function suspend(){if(context?.state==='running')context.suspend();}
 function resume(){if(enabled)context?.resume();}
 return{toggle,update,suspend,resume};
}
