import Phaser from 'phaser';

// Phaser owns the lightweight, transparent 2D atmosphere; all positions are
// sampled from the same scroll clock as Three, so the whole film can rewind.
export function createAtmosphere(){
 let painter,progress=0,pointer={x:0,y:0};
 class Atmosphere extends Phaser.Scene{
   create(){painter=this.add.graphics();this.game.events.on('journey-frame',this.paint,this);}
   paint(){
     if(!painter)return;
     const w=this.scale.width,h=this.scale.height;
     painter.clear();
     for(let i=0;i<40;i++){
       const x=((i*193.73+Math.sin(progress*8+i)*45)%w+w)%w;
       const y=((i*137.21-progress*h*(.5+(i%7)*.08))%h+h)%h;
       const size=i%9===0?1.7:.65;
       painter.fillStyle(0xffffff,(.12+(i%5)*.04)*.4);painter.fillCircle(x,y,size);
       if(i%9===0){painter.fillStyle(0xffffff,.04);painter.fillCircle(x,y,6);}
     }
   }
 }
 const game=new Phaser.Game({type:Phaser.CANVAS,parent:'atmosphere',width:innerWidth,height:innerHeight,transparent:true,banner:false,audio:{noAudio:true},scene:Atmosphere,fps:{target:30,limit:30},input:{mouse:false,touch:false,keyboard:false},scale:{mode:Phaser.Scale.RESIZE}});
 return {render(p,point){progress=p;pointer=point;game.events.emit('journey-frame');},resize(){game.scale.resize(innerWidth,innerHeight);}};
}
