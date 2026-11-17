import * as THREE from 'three';

// Seis salas (tres a cada lado del pasillo CENTRAL), dos plantas de exhibición.
// Cada sala tiene galerías de carteles en ambos niveles: 84 puestos por sala.
export function createConferenceLayout(scene) {
  const group = new THREE.Group(); group.name = 'Galería UANL · 6 salas · 2 plantas'; scene.add(group);
  const colliders = [], voteButtons = [], posterSlots = [], rooms = [], ramps = [];
  const H=8, W=132, D=150, corridor=20, roomW=53, roomD=46;
  const material=(color,roughness=.78)=>new THREE.MeshStandardMaterial({color,roughness,side:THREE.DoubleSide});
  const wall=material(0xcbd5df), trim=material(0x294b62), floor=material(0x8c9ba7), poster=material(0xe9edf1);
  const line=new THREE.MeshBasicMaterial({color:0x17d8f5});
  const glass=new THREE.MeshPhysicalMaterial({color:0xa3e7f4,transparent:true,opacity:.25,roughness:.12,metalness:0,depthWrite:false,side:THREE.DoubleSide});
  function block(x,y,z,w,h,d,mat,solid=false){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);o.receiveShadow=true;group.add(o);if(solid)colliders.push(new THREE.Box3().setFromObject(o));return o;}
  function label(text,x,y,z,rotation=0){const c=document.createElement('canvas');c.width=512;c.height=128;const p=c.getContext('2d');p.fillStyle='#15364b';p.fillRect(0,0,512,128);p.fillStyle='#fff';p.font='bold 54px Arial';p.textAlign='center';p.textBaseline='middle';p.fillText(text,256,64);const m=new THREE.Mesh(new THREE.PlaneGeometry(6.5,1.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),side:THREE.DoubleSide}));m.position.set(x,y,z);m.rotation.y=rotation;group.add(m);}
  // Planta rectangular compacta. Pasillo central a lo largo de Z; salas 1-3 a la izquierda y 4-6 a la derecha.
  block(0,-.16,0,W,.3,D,floor);
  block(0,17,0,W,.3,D,trim);
  block(0,8.5,-D/2,W,17,.3,wall,true);
  block(-W/2,8.5,0,.3,17,D,wall,true);block(W/2,8.5,0,.3,17,D,wall,true);
  // Entrada principal: abertura de 8 unidades, cerrada con puertas de cristal esmerilado.
  // El acceso queda sellado físicamente; no se modifica el resto de las puertas de salas.
  const entranceWidth=8, entranceZ=D/2;
  const sideWidth=(W-entranceWidth)/2;
  block(-(entranceWidth+sideWidth)/2,8.5,entranceZ,sideWidth,17,.3,wall,true);
  block( (entranceWidth+sideWidth)/2,8.5,entranceZ,sideWidth,17,.3,wall,true);
  block(0,13.5,entranceZ,entranceWidth,7,.3,wall,true);
  const frostedGlass=new THREE.MeshPhysicalMaterial({color:0xaccbd5,transparent:true,opacity:.78,roughness:.92,metalness:0,side:THREE.DoubleSide});
  for(const side of [-1,1]){
    const doorX=side*entranceWidth/4;
    block(doorX,5,entranceZ,entranceWidth/2-.10,10,.22,frostedGlass,true);
    block(doorX,5,entranceZ-.18,.09,10,.12,trim);
    block(doorX-side*.7,5,entranceZ-.34,.09,1.2,.12,trim);
  }
  block(0,10.08,entranceZ,entranceWidth,.18,.42,trim,true);
  // Entrepisos dentro de las seis salas y pasarela central de cristal.
  block(0,H-.12,0,corridor-.4,.24,D-2,glass);
  for(const side of [-1,1]){
    const x=side*(corridor/2-.32);
    // Barandales solamente donde no hay puertas, con tramos interrumpidos frente a cada sala.
    for(const z of [-69,-23,23,69]){
      const length=z===-69||z===69?10:12;
      block(x,H+.9,z,length>0?.13:.13,1.8,length,glass,true);
      block(x,H+1.85,z,.16,.08,length,line);
    }
  }
  for(const side of [-1,1])for(let i=0;i<3;i++){
    const id=side<0?i+1:i+4, z=-47+i*47, x=side*(corridor/2+roomW/2);
    rooms.push({name:`SALA ${id}`,x,z,front:-side,level:'ambas plantas',capacity:84});
    // Muros externos y divisiones entre salas; no se construye un muro central macizo.
    block(x,H-.10,z,roomW-.45,.20,roomD-.45,glass);
    block(side*(corridor/2+roomW),8.5,z,.25,17,roomD,wall,true);
    for(const dz of [-roomD/2,roomD/2])block(x,8.5,z+dz,roomW,17,.25,wall,true);
    // Pared que mira al pasillo: dos puertas alineadas, una por planta.
    const inner=side*corridor/2;
    for(const level of [0,1]){
      const y=level*H, door=9, flank=(roomD-door)/2;
      for(const s of [-1,1])block(inner,y+4,z+s*(door/2+flank/2),.24,8,flank,wall,true);
      block(inner,y+6.9,z,.24,2.2,door,wall,true);
      label(`SALA ${id}`,inner-side*.20,y+6.15,z,side<0?Math.PI/2:-Math.PI/2);
    }
    // 42 carteles por nivel, 84 por sala: 7 filas × 6 puestos.
    for(const level of [0,1])for(let row=0;row<7;row++)for(let col=0;col<6;col++){
      const yy=level*H, px=x-19+(col%3)*13.5, pz=z-17+row*5.6+(col>=3?1.1:0);
      const board=block(px,yy+2.45,pz,3.5,3.3,.13,poster);
      block(px,yy+.7,pz,.13,1.4,.13,trim);
      block(px,yy+2.45,pz+.09,3.7,3.5,.07,trim);
      board.userData.posterSlot={room:id,index:level*42+row*6+col+1};posterSlots.push(board);
    }
    const vote=new THREE.Mesh(new THREE.PlaneGeometry(2.5,.65),new THREE.MeshBasicMaterial({color:0x176b55,side:THREE.DoubleSide}));
    vote.position.set(inner-side*.25,4.5,z);vote.rotation.y=side<0?Math.PI/2:-Math.PI/2;vote.userData.voteRoom=id;group.add(vote);voteButtons.push(vote);
  }
  // Cuatro accesos mediante rampas longitudinales dentro del pasillo central.
  // Dos pares, uno en cada extremo, permiten subir gradualmente desde PB a P1.
  for(const side of [-1,1])for(const end of [-1,1]){
    const x=side*4.5, z0=end*70, z1=end*24, len=Math.abs(z1-z0), center=(z0+z1)/2;
    const angle=Math.atan2(H,len);
    const ramp=new THREE.Mesh(new THREE.BoxGeometry(3.5,.18,len),glass);
    ramp.position.set(x,H/2-.08,center);ramp.rotation.x=end*angle;group.add(ramp);
    for(const dx of [-1.83,1.83]){
      const rail=new THREE.Mesh(new THREE.BoxGeometry(.09,1.3,len),glass);
      rail.position.set(x+dx,H/2+.8,center);rail.rotation.x=end*angle;group.add(rail);
      const accent=new THREE.Mesh(new THREE.BoxGeometry(.10,.07,len),line);
      accent.position.set(x+dx,H/2+.16,center);accent.rotation.x=end*angle;group.add(accent);
    }
    ramps.push({x,z0,z1,width:3.5});
  }
  function groundHeight(position,previousFeetY=0){
    let h=0;
    for(const r of ramps){const t=(position.z-r.z0)/(r.z1-r.z0);if(t>=0&&t<=1&&Math.abs(position.x-r.x)<r.width/2-.15){const rise=H*t;if(Math.abs(rise-previousFeetY)<1.5)h=Math.max(h,rise);}}
    const inBuilding=Math.abs(position.x)<W/2&&Math.abs(position.z)<D/2;
    if(inBuilding&&previousFeetY>H-1.35)h=Math.max(h,H);
    return h;
  }
  function collides(position,radius=.4){const feet=position.y-1.7;for(const b of colliders){if(feet+1.7<=b.min.y+.1||feet>=b.max.y-.1)continue;const x=THREE.MathUtils.clamp(position.x,b.min.x,b.max.x),z=THREE.MathUtils.clamp(position.z,b.min.z,b.max.z);if((position.x-x)**2+(position.z-z)**2<radius*radius)return true;}return false;}
  return {group,rooms,collides,colliders,voteButtons,posterSlots,groundHeight,ramps};
}
