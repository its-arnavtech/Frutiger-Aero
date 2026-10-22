// Authored water levels descend through the surveyed massif. The same bed
// carves the terrain and positions the water, lips and plunge pools.
export const drainage = [
  { name: 'Rainmere cascade', width: 3.0, nodes: [
    [-118, 497, -850], [-112, 460, -801],
    [-100, 350, -758], [-98, 345, -750],
    [-95, 321, -734], [-88, 190, -649], [-88, 187, -642],
    [-84, 151, -627], [-81, 32, -597], [-80, 31, -591],
    [-80, 9, -572], [-77, .7, -506], [-77, -.5, -456],
  ], lips: [1, 4, 7] },
  { name: 'Eastern cascade', width: 1.9, nodes: [
    [145, 250, -780], [150, 230, -768],
    [148, 140, -700], [145, 138, -692],
    [135, 113, -670], [132, 32, -579], [130, 30, -575],
    [114, 6, -558], [112, .6, -500], [112, -.5, -452],
  ], lips: [1, 4] },
];
const clamp = n => Math.max(0, Math.min(1, n));
const smooth = (a,b,n) => {const t=clamp((n-a)/(b-a));return t*t*(3-2*t);};

export function channelAt(stream, z) {
  const nodes=stream.nodes;
  if(z<nodes[0][2] || z>nodes.at(-1)[2])return null;
  let index=0;
  while(index<nodes.length-2 && nodes[index+1][2]<z)index++;
  const a=nodes[index],b=nodes[index+1],t=clamp((z-a[2])/(b[2]-a[2]));
  return {x:a[0]+(b[0]-a[0])*t,level:a[1]+(b[1]-a[1])*t,index};
}

export function dropAt(stream, lipIndex) {
  const lip=stream.nodes[lipIndex],bottom=stream.nodes[lipIndex+1],drop=lip[1]-bottom[1];
  const duration=Math.sqrt(2*drop/9.81),dx=bottom[0]-lip[0],dz=bottom[2]-lip[2],length=Math.hypot(dx,dz);
  const direction=[dx/length,dz/length],speed=length/duration;
  return {lip,drop,duration,direction,speed,width:stream.width,poolRadii:[stream.width*2.,stream.width*1.8],
    landing:[...bottom],
  };
}

export const waterfallDrops=drainage.flatMap(stream=>stream.lips.map(index=>({...dropAt(stream,index),stream,index})));

export function carveDrainage(x,z,uncarved) {
  let bed=uncarved;
  for(const stream of drainage) {
    const channel=channelAt(stream,z);
    if(!channel)continue;
    const distance=Math.abs(x-channel.x),inner=stream.width*1.6;
    const mix=smooth(inner,inner+12,distance);
    bed=Math.min(bed,(channel.level-.65)*(1-mix)+uncarved*mix);
  }
  for(const fall of waterfallDrops) {
    const [cx,level,cz]=fall.landing,[rx,rz]=fall.poolRadii;
    const radius=Math.hypot((x-cx)/rx,(z-cz)/rz);
    if(radius>1.15)continue;
    const floor=level-3.2+2.9*Math.min(1,radius*radius);
    bed=Math.min(bed,floor*(1-smooth(.95,1.15,radius))+uncarved*smooth(.95,1.15,radius));
  }
  return bed;
}

export function waterExposure(x,y,z) {
  let wet=0;
  for(const stream of drainage) {
    const channel=channelAt(stream,z);
    if(!channel)continue;
    const proximity=1-smooth(stream.width*1.3,stream.width*3.8,Math.abs(x-channel.x));
    wet=Math.max(wet,proximity*(1-smooth(2,20,Math.abs(y-channel.level))));
  }
  return wet;
}
