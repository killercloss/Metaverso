import * as THREE from 'three';

// Planta simétrica: seis salas de 12 x 16 m y corredor de 14 m.
// Z negativo: salas 1-3. Z positivo: salas 6-4.
export function createConferenceLayout(scene)
{
    const colliders = [];
    const group = new THREE.Group();
    group.name = 'Centro de conferencias - 6 salas';
    scene.add(group);

    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xddd6ca, roughness: 0.85 });
    const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x343d46, roughness: 0.65 });
    const hallMaterial = new THREE.MeshStandardMaterial({ color: 0xb9b7b0, roughness: 0.92 });
    const roomMaterial = new THREE.MeshStandardMaterial({ color: 0xaaa396, roughness: 0.95 });
    const stageMaterial = new THREE.MeshStandardMaterial({ color: 0x576674, roughness: 0.75 });
    const labelMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const wallHeight = 5.8;
    const thickness = 0.35;
    const roomWidth = 14;
    const roomDepth = 19;
    const corridorWidth = 16;
    const buildingWidth = roomWidth * 3;
    const buildingDepth = roomDepth * 2 + corridorWidth;
    const roomCenterZ = corridorWidth / 2 + roomDepth / 2;
    const outerZ = buildingDepth / 2;
    const doorWidth = 5.4;
    const doorHeight = 4.5;

    function block(x, y, z, w, h, d, material, solid = false)
    {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        if(solid)
        {
            colliders.push(new THREE.Box3().setFromObject(mesh));
        }
        return mesh;
    }

    // Planta ampliada: tres salones por lado y corredor central.
    block(0, -0.10, 0, buildingWidth, 0.2, buildingDepth, hallMaterial);
    for(const z of [-roomCenterZ, roomCenterZ])
    {
        block(0, -0.045, z, buildingWidth, 0.03, roomDepth, roomMaterial);
    }

    // Muros exteriores y entrada principal libre al extremo derecho.
    block(-buildingWidth / 2, wallHeight / 2, 0, thickness, wallHeight, buildingDepth, wallMaterial, true);
    block(0, wallHeight / 2, -outerZ, buildingWidth, wallHeight, thickness, wallMaterial, true);
    block(0, wallHeight / 2, outerZ, buildingWidth, wallHeight, thickness, wallMaterial, true);
    for(const z of [-roomCenterZ, roomCenterZ])
    {
        block(buildingWidth / 2, wallHeight / 2, z, thickness, wallHeight, roomDepth, wallMaterial, true);
    }

    // Tabiques separadores entre salones.
    for(const x of [-roomWidth / 2, roomWidth / 2])
    {
        for(const z of [-roomCenterZ, roomCenterZ])
        {
            block(x, wallHeight / 2, z, thickness, wallHeight, roomDepth, wallMaterial, true);
        }
    }

    // Accesos amplios: 5.4 m de ancho y 4.5 m de alto, sin puerta física.
    for(const z of [-corridorWidth / 2, corridorWidth / 2])
    {
        for(const x of [-roomWidth, 0, roomWidth])
        {
            const sideWidth = (roomWidth - doorWidth) / 2;
            const offset = doorWidth / 2 + sideWidth / 2;
            block(x - offset, wallHeight / 2, z, sideWidth, wallHeight, thickness, wallMaterial, true);
            block(x + offset, wallHeight / 2, z, sideWidth, wallHeight, thickness, wallMaterial, true);
            block(x, doorHeight + (wallHeight - doorHeight) / 2, z,
                doorWidth, wallHeight - doorHeight, thickness, wallMaterial, true);
            // Los marcos no tienen colisión y no invaden el vano.
            block(x - doorWidth / 2 - 0.09, doorHeight / 2, z, 0.12, doorHeight, 0.48, trimMaterial);
            block(x + doorWidth / 2 + 0.09, doorHeight / 2, z, 0.12, doorHeight, 0.48, trimMaterial);
        }
    }

    // Techo completo. Se muestra desde fuera y desde dentro, sin bloquear al jugador.
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x626e78, roughness: 0.9, side: THREE.DoubleSide });
    block(0, wallHeight + 0.15, 0, buildingWidth + 0.9, 0.3, buildingDepth + 0.9, roofMaterial);

    const rooms = [
        {name:'SALÓN 1', x:-14, z:-roomCenterZ, front:-1},
        {name:'SALÓN 2', x:0, z:-roomCenterZ, front:-1},
        {name:'SALÓN 3', x:14, z:-roomCenterZ, front:-1},
        {name:'SALÓN 6', x:-14, z:roomCenterZ, front:1},
        {name:'SALÓN 5', x:0, z:roomCenterZ, front:1},
        {name:'SALÓN 4', x:14, z:roomCenterZ, front:1}
    ];

    const voteButtons = [];
    var numRoom = 0;
    for(const room of rooms)
    {
        numRoom++;
        // Botón de votación encima de la puerta, mirando al corredor.
        const voteCanvas=document.createElement('canvas');
        voteCanvas.width=512;
        voteCanvas.height=128;
        const voteContext=voteCanvas.getContext('2d');
        voteContext.fillStyle='#176b55';
        voteContext.fillRect(0,0,512,128);
        voteContext.fillStyle='#ffffff';
        voteContext.font='bold 48px Arial';
        voteContext.textAlign='center';
        voteContext.textBaseline='middle';
        voteContext.fillText('TEMA DE '+room.name.replace('SALÓN','SALA'),256,64);
        const voteMesh=new THREE.Mesh(new THREE.PlaneGeometry(3.8,0.75),
            new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(voteCanvas),side:THREE.DoubleSide}));
        const roomId=Number(room.name.match(/\d+/)[0]);
        voteMesh.userData.voteRoom=roomId;
        voteMesh.position.set(room.x,5.08,room.front<0 ? -corridorWidth/2+0.23 : corridorWidth/2-0.23);
        if(numRoom > 3)
        {
            console.log(numRoom);
            voteMesh.scale.set(-1, 1, 1);
        }
        group.add(voteMesh);
        voteButtons.push(voteMesh);
        // Tarima al fondo de cada salón, opuesta a la puerta.
        block(room.x, 0.12, room.z + room.front * 7.5, 6.8, 0.24, 1.8, stageMaterial);
        // Rótulo horizontal sobre la tarima, legible desde una vista superior.
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ececec';
        ctx.fillRect(0, 0, 512, 128);
        ctx.fillStyle = '#172438';
        ctx.font = 'bold 55px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(room.name, 256, 64);
        const texture = new THREE.CanvasTexture(canvas);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.4),
            new THREE.MeshBasicMaterial({map:texture, side:THREE.DoubleSide}));
        sign.rotation.x = -Math.PI / 2;
        sign.position.set(room.x, 0.035, room.z + room.front * 5.2);
        group.add(sign);
    }

    function collides(position, radius = 0.35)
    {
        for(const box of colliders)
        {
            if(position.y < box.min.y - 1.7 || position.y > box.max.y + 1.7)
            {
                continue;
            }
            const x = Math.max(box.min.x, Math.min(box.max.x, position.x));
            const z = Math.max(box.min.z, Math.min(box.max.z, position.z));
            const dx = position.x - x;
            const dz = position.z - z;
            if(dx * dx + dz * dz < radius * radius)
            {
                return true;
            }
        }
        return false;
    }

    return { group, rooms, collides, colliders, voteButtons };
}
