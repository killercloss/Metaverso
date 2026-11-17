import * as THREE from 'three';

// Marquesinas de patrocinadores: las imágenes se descubren en el servidor.
// No se necesita editar el código para agregar o quitar patrocinadores.
export function createSponsorBanners(scene) {
  const group = new THREE.Group();
  group.name = 'Marquesinas de patrocinadores';
  scene.add(group);
  const canvases = [];
  let elapsed = 0, refreshElapsed = 0, updating = false;
  const y = 16.05;
  const wallSpecs = [
    {x:-9.79, length:145, facing:1},
    {x: 9.79, length:145, facing:-1},
    {x:-65.78,length:145, facing:1},
    {x: 65.78,length:145, facing:-1}
  ];
  const fallback = ['#0a3970','#075d85','#123b64'];
  function makeCanvas() {
    const canvas=document.createElement('canvas'); canvas.width=4096;canvas.height=256;
    return canvas;
  }
  async function getImages() {
    const response=await fetch('/api/sponsors',{cache:'no-store'});
    if(!response.ok)throw new Error('No se pudo obtener el catálogo de patrocinadores');
    const names=await response.json();
    const images=await Promise.all(names.map(name=>new Promise(resolve=>{
      const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);
      img.src='/sponsors/'+encodeURIComponent(name);
    })));
    return images.filter(Boolean);
  }
  function drawCanvas(canvas,images) {
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#092c45';ctx.fillRect(0,0,canvas.width,canvas.height);
    const slots=images.length || 1, cell=canvas.width/slots;
    for(let i=0;i<slots;i++) {
      const x=i*cell;
      ctx.fillStyle=fallback[i%fallback.length];ctx.fillRect(x,0,cell,canvas.height);
      if(images.length) {
        const img=images[i%images.length];
        // El banner se adapta sin recortar el texto ni los logotipos.
        const scale=Math.min(cell/img.width,canvas.height/img.height);
        const w=img.width*scale,h=img.height*scale;
        ctx.drawImage(img,x+(cell-w)/2,(canvas.height-h)/2,w,h);
      } else {
        ctx.fillStyle='#dbeafe';ctx.font='bold 58px Arial';ctx.textAlign='center';
        ctx.fillText('METAVERSO UANL',x+cell/2,150);
      }
    }
  }
  for(const spec of wallSpecs) {
    const canvas=makeCanvas();
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=THREE.RepeatWrapping;
    texture.repeat.set(spec.length/60,1);
    texture.anisotropy=4;
    const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,depthWrite:false});
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(spec.length,1.35),material);
    mesh.rotation.y=spec.facing*Math.PI/2;
    mesh.position.set(spec.x,y,0);
    mesh.renderOrder=3;
    group.add(mesh);
    canvases.push({canvas,texture,speed:spec.facing*.018});
  }
  async function refresh() {
    if(updating)return;
    updating=true;
    try {
      const images=await getImages();
      for(const item of canvases) {
        drawCanvas(item.canvas,images);
        item.texture.needsUpdate=true;
      }
    } catch(error) {console.warn('Patrocinadores:',error.message);}
    finally {updating=false;}
  }
  refresh();
  return {
    group,
    update(dt) {
      elapsed+=dt;refreshElapsed+=dt;
      for(const item of canvases)item.texture.offset.x=(item.texture.offset.x+item.speed*dt)%1;
      if(refreshElapsed>=60){refreshElapsed=0;refresh();}
    }
  };
}
