import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// Decoración del edificio: macetas contra muros, sillas agrupadas y cuadros en pared.
// Se omite intencionalmente la colección de varios cuadros.
export function placeExhibitionModels(scene) {
  const gltf=new GLTFLoader(), fbx=new FBXLoader(), mixers=[];
  const plants=[], chairs=[], pictures=[], sofas=[];
  // Pasillo central: macetas junto a muros, lejos del centro de las puertas (z=-47,0,47).
  for(const x of [-9.15,9.15])for(const z of [-68,-61,-34,-27,-16,16,27,34,61,68])plants.push({x,z,y:0});
  // Macetas también en las esquinas de las seis salas, en ambas plantas.
  for(const x of [-59,-17,17,59])for(const z of [-67,-26,-20,20,27,67])plants.push({x,z,y:0});
  for(const x of [-9.15,9.15])for(const z of [-68,-34,-16,16,34,68])plants.push({x,z,y:8});
  // Conjuntos de sillas en pequeñas zonas de descanso, sin ocupar el eje central de circulación.
  for(const baseZ of [-66,-20,25,66])for(const side of [-1,1]){
    const bx=side*5.4;
    for(const [dx,dz,rot] of [[0,0,0],[1.25,.2,.35],[-.8,1.1,-.45],[.55,1.4,Math.PI]])chairs.push({x:bx+dx,z:baseZ+dz,y:0,rot});
  }
  for(const baseZ of [-62,62])for(const side of [-1,1])for(const [dx,dz] of [[0,0],[1.3,.2],[-.6,1.3]])chairs.push({x:side*5.2+dx,z:baseZ+dz,y:8,rot:side*.5});
  // Cuadros individuales sobre los muros exteriores de las salas, nunca en el suelo.
  for(const x of [-64.9,64.9])for(const z of [-62,-50,-38,-15,-3,9,32,44,56])for(const y of [3.2,11.2])pictures.push({x,z,y,rot:x<0?Math.PI/2:-Math.PI/2});
  // Sofás exclusivamente en el pasillo central, contra las paredes interiores.
  // Se evitan las puertas (z=-47,0,47), el eje central y las rampas (x≈±4.5).
  // Las macetas permanecen junto a los muros; los sofás se intercalan entre ellas.
  const sofaPositions=[-64,-55,-37,-29,-18,18,29,37,55,64];
  for(const level of [0,8])for(const side of [-1,1])for(const z of sofaPositions){
    sofas.push({x:side*7.7,y:level,z,rot:side<0?Math.PI/2:-Math.PI/2});
  }
  const assets=[
    {url:'/models/exhibition/Sketchfab_Ready_Monstera.fbx',type:'fbx',spots:plants,kind:'floor'},
    {url:'/models/exhibition/02.fbx',type:'fbx',spots:chairs,kind:'floor'},
    {url:'/models/exhibition/photoframe-10.glb',type:'glb',spots:pictures,kind:'wall'},
    {url:'/models/exhibition/Office sofa.fbx',type:'fbx',spots:sofas,kind:'floor',sofa:true}
  ];
  for(const asset of assets){
    const loader=asset.type==='glb'?gltf:fbx;
    loader.load(asset.url,result=>{
      const source=asset.type==='glb'?result.scene:result, animations=result.animations||[];
      if(asset.sofa){
        // Mapas PBR entregados con el sofá; materiales compartidos entre clones.
        const textureLoader=new THREE.TextureLoader();
        const base=textureLoader.load('/models/exhibition/Office_sofa_DefaultMaterial_BaseColor.png');
        const normal=textureLoader.load('/models/exhibition/Office_sofa_DefaultMaterial_Normal.png');
        const rough=textureLoader.load('/models/exhibition/Office_sofa_DefaultMaterial_Roughness.png');
        base.colorSpace=THREE.SRGBColorSpace;
        source.traverse(child=>{
          if(!child.isMesh)return;
          child.material=new THREE.MeshStandardMaterial({map:base,normalMap:normal,roughnessMap:rough,roughness:1,metalness:0});
          child.castShadow=false;child.receiveShadow=true;
        });
      }
      source.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3());
      if(!Number.isFinite(size.length())||size.length()<.0001)return;
      // Misma escala visual de la revisión anterior (máximo 3 unidades = 60 % de 5).
      const scale=(asset.sofa ? 5*0.6 : 2)/Math.max(size.x,size.y,size.z);
      asset.spots.forEach((spot,index)=>{
        const model=source.clone(true);model.scale.multiplyScalar(scale);
        model.rotation.y=spot.rot??((index%4)*Math.PI/2);
        model.updateMatrixWorld(true);
        const b=new THREE.Box3().setFromObject(model);
        if(asset.kind==='wall'){
          model.position.set(spot.x-(b.min.x+b.max.x)/2,spot.y-(b.min.y+b.max.y)/2,spot.z-(b.min.z+b.max.z)/2);
        }else{
          model.position.set(spot.x-(b.min.x+b.max.x)/2,spot.y-b.min.y,spot.z-(b.min.z+b.max.z)/2);
        }
        scene.add(model);
        if(animations.length){const mixer=new THREE.AnimationMixer(model);mixer.clipAction(animations[0]).play();mixers.push(mixer);}
      });
    },undefined,error=>console.warn('No se pudo cargar el adorno',asset.url,error));
  }
  const clock=new THREE.Clock();
  function animate(){requestAnimationFrame(animate);const dt=clock.getDelta();for(const mixer of mixers)mixer.update(dt);}animate();
}
