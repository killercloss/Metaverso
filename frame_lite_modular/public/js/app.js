// Frame Lite - entrada principal
// La versión funcional actual se conserva aquí mientras los sistemas se migran
// gradualmente a los módulos de /js/modules sin romper el proyecto.

import { PATHS, RTC_CONFIG, VOICE_DISTANCE, PLAYER } from './modules/config.js';
import { createInteractionSystem } from './modules/interaction.js';
import { createVoiceSystem } from './modules/audio.js';
import { createChatSystem } from './modules/chat.js';
import { createPDFViewer } from './modules/pdf.js';
import { createAvatarSystem } from './modules/avatar.js';
import { loadFBX, createHouseCollisionSystem } from './modules/models.js';
import { createImageGallery } from './modules/images.js';
import { createVideoSystem } from './modules/video.js';
import { createMultiplayerSystem } from './modules/multiplayer.js';
import { createKeyboardState, bindResize } from './modules/controls.js';
import { createConferenceLayout } from './modules/conferenceLayout.js';
import { createAudioZones } from './modules/audioZones.js';

window.FrameLiteModules =
{
    PATHS,
    RTC_CONFIG,
    VOICE_DISTANCE,
    PLAYER,
    createInteractionSystem,
    createVoiceSystem,
    createChatSystem,
    createPDFViewer,
    createAvatarSystem,
    loadFBX,
    createHouseCollisionSystem,
    createImageGallery,
    createVideoSystem,
    createMultiplayerSystem,
    createKeyboardState,
    bindResize
};


   import * as THREE from 'three'; import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
   import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

    const socket = io({autoConnect:false});
    const app = document.getElementById('app');
    const enterScreen = document.getElementById('enterScreen');
    const enterWorld = document.getElementById('enterWorld');
    const crosshair = document.getElementById('crosshair');
    const help = document.getElementById('help');
    const micButton = document.getElementById('micButton');
    const voiceModeSelect = document.getElementById('voiceMode');
    const voiceStatus = document.getElementById('voiceStatus');
    const voiceMeterLevel = document.getElementById('voiceMeterLevel');
    const countEl = document.getElementById('count');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const chatSend = document.getElementById('chatSend');
    const mobileControls = document.getElementById('mobileControls');
    const joystick = document.getElementById('joystick');
    const joystickKnob = document.getElementById('joystickKnob');
    const lookArea = document.getElementById('lookArea');

    const isTouchDevice =
    /Android|iPhone|iPad|iPod/i.test(
        navigator.userAgent
    );
    /*const isTouchDevice = window.matchMedia('(pointer: coarse)').matches ||
        navigator.maxTouchPoints > 0;*/

    let joystickX = 0;
    let joystickY = 0;
    let joystickPointerId = null;
    let lookPointerId = null;
    let lastLookX = 0;
    let lastLookY = 0;
    let touchYaw = 0;
    let touchPitch = 0;
    let hasEnteredWorld = false;
    const scene = new THREE.Scene();

    scene.background = new THREE.Color(0x20242b);
    scene.fog = new THREE.Fog(0x20242b,18,70);
    const camera = new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.1,200);
    camera.position.set(0,1.7,5);
    const renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(innerWidth,innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.shadowMap.enabled = true;
    app.appendChild(renderer.domElement);
    const controls = new PointerLockControls(camera,document.body);

    renderer.domElement.addEventListener(
        'click',
        () =>
        {
            if(!isTouchDevice && hasEnteredWorld && !controls.isLocked)
            {
                controls.lock();
            }
        }
    );

    const loginForm = document.getElementById('loginForm');
    const authError = document.getElementById('authError');
    let authMode = 'login';
    let currentAccount = null;
    const tabLogin = document.getElementById('tabLogin');
    const tabSignup = document.getElementById('tabSignup');
    function setAuthMode(mode)
    {
        authMode = mode;
        document.getElementById('signupName').hidden = mode !== 'signup';
        document.getElementById('signupColor').hidden = mode !== 'signup';
        document.getElementById('name').required = mode === 'signup';
        document.getElementById('password').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
        enterWorld.textContent = mode === 'signup' ? 'Crear cuenta y entrar' : 'Iniciar sesión';
        tabLogin.classList.toggle('selected',mode==='login');
        tabSignup.classList.toggle('selected',mode==='signup');
        authError.textContent = '';
    }
    tabLogin.addEventListener('click',() => setAuthMode('login'));
    tabSignup.addEventListener('click',() => setAuthMode('signup'));
    function applyAccount(user)
    {
        currentAccount = user;
        document.getElementById('accountInfo').textContent = `${user.name} · ${user.role}`;
        document.getElementById('adminLink').hidden = user.role !== 'administrador';
    }
    async function authRequest(url, options={})
    {
        const response = await fetch(url,{credentials:'same-origin',...options});
        const body = await response.json().catch(() => ({}));
        if(!response.ok) throw new Error(body.error || 'Error de conexión');
        return body;
    }
    function beginWorld(user)
    {
        applyAccount(user);
        refreshVotes();
        if(!socket.connected) socket.connect();
        if(!hasEnteredWorld)
        {
            enterMetaverse();
            resumeRemoteAudio();
        }
    }
    loginForm.addEventListener('submit',async event =>
    {
        event.preventDefault();
        if(!loginForm.reportValidity()) return;
        enterWorld.disabled = true;
        authError.textContent = '';
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const data = authMode === 'signup' ? {name:document.getElementById('name').value.trim(),email,password,avatarColor:document.getElementById('playerColor').value} : {email,password};
        try
        {
            const result = await authRequest('/api/auth/'+authMode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
            document.getElementById('password').value = '';
            beginWorld(result.user);
        }
        catch(error) { authError.textContent = error.message; }
        finally { enterWorld.disabled = false; }
    });
    document.getElementById('logoutButton').addEventListener('click',async () =>
    {
        try { await authRequest('/api/auth/logout',{method:'POST'}); }
        catch(error) { console.error(error); }
        socket.disconnect();
        location.reload();
    });
    socket.on('connect_error',error =>
    {
        authError.textContent = error.message;
        if(error.message.includes('Autenticación')) location.reload();
    });
    authRequest('/api/auth/me').then(({user}) =>
    {
        // Una sesión existente permite volver a entrar sin contraseña.
        applyAccount(user);
        refreshVotes();
        document.getElementById('enterWorld').textContent = 'Continuar al mundo';
        loginForm.addEventListener('submit',()=>{}, {once:true});
        const continueButton = document.createElement('button');
        continueButton.type = 'button';
        continueButton.textContent = `Continuar como ${user.name}`;
        continueButton.addEventListener('click',() => beginWorld(user));
        loginForm.prepend(continueButton);
    }).catch(() => {});

    function enterMetaverse()
    {
            hasEnteredWorld = true;
            enterScreen.style.display = 'none';
            crosshair.style.display = 'block';

            if(isTouchDevice)
            {
                help.textContent = 'Joystick: mover - Deslizar a la derecha: mirar';

                const euler = new THREE.Euler().setFromQuaternion(
                    camera.quaternion,
                    'YXZ'
                );

                touchPitch = euler.x;
                touchYaw = euler.y;
            }
            else
            {
                controls.lock();
            }
    }

    controls.addEventListener(
        'lock',
        () =>
        {
            enterScreen.style.display = 'none';
            crosshair.style.display = 'block';
        }
    );

    controls.addEventListener(
        'unlock',
        () =>
        {
            if(!isTouchDevice)
            {
                crosshair.style.display = 'none';
            }

            for(const code in keys)
            {
                keys[code] = false;
            }
        }
    );

    function resetJoystick()
    {
        joystickX = 0;
        joystickY = 0;
        joystickPointerId = null;

        joystickKnob.style.transform = 'translate(0px, 0px)';
    }

    function updateJoystick(event)
    {
        const rect = joystick.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const maxDistance = rect.width * 0.32;

        let dx = event.clientX - centerX;
        let dy = event.clientY - centerY;

        const distance = Math.sqrt(dx * dx + dy * dy);

        if(distance > maxDistance)
        {
            dx = dx / distance * maxDistance;
            dy = dy / distance * maxDistance;
        }

        joystickX = dx / maxDistance;
        joystickY = dy / maxDistance;

        joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    }

    joystick.addEventListener(
        'pointerdown',
        event =>
        {
            if(!isTouchDevice || !hasEnteredWorld)
            {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            joystickPointerId = event.pointerId;
            joystick.setPointerCapture(event.pointerId);

            updateJoystick(event);
        }
    );

    joystick.addEventListener(
        'pointermove',
        event =>
        {
            if(event.pointerId !== joystickPointerId)
            {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            updateJoystick(event);
        }
    );

    joystick.addEventListener(
        'pointerup',
        event =>
        {
            if(event.pointerId !== joystickPointerId)
            {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            resetJoystick();
        }
    );

    joystick.addEventListener(
        'pointercancel',
        event =>
        {
            if(event.pointerId === joystickPointerId)
            {
                resetJoystick();
            }
        }
    );

    lookArea.addEventListener(
        'pointerdown',
        event =>
        {
            if(!isTouchDevice || !hasEnteredWorld)
            {
                return;
            }

            event.preventDefault();

            lookPointerId = event.pointerId;
            lastLookX = event.clientX;
            lastLookY = event.clientY;

            lookArea.setPointerCapture(event.pointerId);
        }
    );

    lookArea.addEventListener(
        'pointermove',
        event =>
        {
            if(event.pointerId !== lookPointerId)
            {
                return;
            }

            event.preventDefault();

            const dx = event.clientX - lastLookX;
            const dy = event.clientY - lastLookY;
            const sensitivity = 0.004;

            lastLookX = event.clientX;
            lastLookY = event.clientY;

            touchYaw -= dx * sensitivity;
            touchPitch -= dy * sensitivity;

            const limit = Math.PI / 2 - 0.05;

            touchPitch = Math.max(
                -limit,
                Math.min(
                    limit,
                    touchPitch
                )
            );

            camera.rotation.order = 'YXZ';
            camera.rotation.y = touchYaw;
            camera.rotation.x = touchPitch;
        }
    );

    function stopLooking(event)
    {
        if(event.pointerId === lookPointerId)
        {
            lookPointerId = null;
        }
    }

    lookArea.addEventListener(
        'pointerup',
        stopLooking
    );

    lookArea.addEventListener(
        'pointercancel',
        stopLooking
    );

    scene.add(new THREE.HemisphereLight(0xffffff,0x444444,2.2));

    const sun = new THREE.DirectionalLight(0xffffff,2.3);
    sun.position.set(8,12,5);
    sun.castShadow = true;
    scene.add(sun);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshStandardMaterial({color:0x6b7480,roughness:.95}));
    floor.rotation.x = -Math.PI/2;
    floor.receiveShadow = true;
    scene.add(floor);

    // El edificio reemplaza la cuadrícula exterior.
    const conferenceLayout = createConferenceLayout(scene);
    const voteStatus=document.getElementById('voteStatus');
    const voteChoices=document.getElementById('voteChoices');
    let currentVote=null;
    async function refreshVotes()
    {
        if(!currentAccount) return;
        try
        {
            const response=await fetch('/api/votes',{credentials:'same-origin'});
            if(!response.ok) throw new Error('No se pudieron consultar los votos');
            const data=await response.json();
            currentVote=data.myVote;
            voteChoices.replaceChildren();
            for(const room of data.rooms)
            {
                const button=document.createElement('button');
                button.type='button';
                button.textContent=`${room.name}${room.room===currentVote?' ✓':''} (${room.total})`;
                button.title=`Oyentes: ${room.oyentes} · Jueces: ${room.jueces} · Total: ${room.total}`;
                button.addEventListener('click',()=>submitVote(room.room));
                voteChoices.appendChild(button);
            }
            voteStatus.textContent=currentVote ? `Tu voto: Sala ${currentVote}` : 'Aún no has votado';
        }
        catch(error) { voteStatus.textContent=error.message; }
    }
    async function submitVote(room)
    {
        if(!currentAccount) return;
        voteStatus.textContent=`Registrando voto por Sala ${room}...`;
        try
        {
            const response=await fetch('/api/votes',
            {
                method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
                body:JSON.stringify({room})
            });
            const data=await response.json();
            if(!response.ok) throw new Error(data.error||'No se pudo registrar el voto');
            await refreshVotes();
        }
        catch(error) { voteStatus.textContent=error.message; }
    }
    socket.on('votesUpdated',()=>refreshVotes());
    const voteRaycaster=new THREE.Raycaster();
    renderer.domElement.addEventListener('click',event=>
    {
        if(!hasEnteredWorld || !currentAccount) return;
        const bounds=renderer.domElement.getBoundingClientRect();
        const pointer=controls.isLocked ? new THREE.Vector2(0,0) :
            new THREE.Vector2((event.clientX-bounds.left)/bounds.width*2-1,
                -(event.clientY-bounds.top)/bounds.height*2+1);
        voteRaycaster.setFromCamera(pointer,camera);
        const hit=voteRaycaster.intersectObjects(conferenceLayout.voteButtons,false)[0];
        if(hit && hit.distance<=9) submitVote(hit.object.userData.voteRoom);
    });
    /*for(let i = 0;i<18;i++)
        {
            const m = new THREE.Mesh(new THREE.BoxGeometry(1.5,1.5,1.5),new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL((i%6)/12,.35,.62)}));
            m.position.set((i%6)*3-7.5,.75,Math.floor(i/6)*-4-5);
            m.castShadow = m.receiveShadow = true;
            scene.add(m);
        }*/
    
    const BILLBOARDS =
    [
        { x: -14, y: 0, z: -17.5, rotationY: 0 },
        { x: 0, y: 0, z: -17.5, rotationY: 0 },
        { x: 14, y: 0, z: -17.5, rotationY: 0 }
    ];

    const VIDEO_BILLBOARD_INDEX = 1;
    const BILLBOARD_WIDTH = 8;

    const VIDEO_OFFSET =
    {
        x: 0.9,
        y: 1.7,
        z: -1
    };

    const VIDEO_SOURCE = '/videos/demo.mp4';
    const videoElement = document.createElement('video');

    videoElement.src = VIDEO_SOURCE;
    videoElement.preload = 'metadata';
    videoElement.playsInline = true;
    videoElement.loop = false;

    const videoTexture = new THREE.VideoTexture(videoElement);
    videoTexture.colorSpace = THREE.SRGBColorSpace;

    const videoScreen = new THREE.Group();

    videoScreen.position.set(0, 0, 0);

    const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(6.4, 3.6),
        new THREE.MeshBasicMaterial(
            {
                map: videoTexture,
                side: THREE.DoubleSide,
                toneMapped: false
            }
        )
    );

    const frame = new THREE.Mesh(
        new THREE.BoxGeometry(6.7, 4.4, 0.12),
        new THREE.MeshBasicMaterial(
            {
                color: 0x151515
            }
        )
    );

    frame.position.z = -0.09;
    videoScreen.add(frame);
    videoScreen.add(screen);

    const videoButtons = [];
    const buttonLabels =
    [
        { label: 'PLAY', action: 'play', x: -1.6 },
        { label: 'PAUSA', action: 'pause', x: 0 },
        { label: 'STOP', action: 'stop', x: 1.6 }
    ];

    function createVideoButton(item)
    {
        const canvas = document.createElement('canvas');

        canvas.width = 256;
        canvas.height = 80;

        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#20252c';
        ctx.fillRect(0, 0, 256, 80);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, 252, 76);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.label, 128, 40);

        const texture = new THREE.CanvasTexture(canvas);

        const button = new THREE.Mesh(
            new THREE.PlaneGeometry(1.4, 0.44),
            new THREE.MeshBasicMaterial(
                {
                    map: texture,
                    transparent: true,
                    side: THREE.DoubleSide,
                    depthWrite: false
                }
            )
        );

        button.position.set(item.x, -2.02, 0.06);
        button.userData.videoAction = item.action;

        videoScreen.add(button);
        videoButtons.push(button);
    }

    buttonLabels.forEach(createVideoButton);
    const billboardLoader = new FBXLoader();
    const billboardGroups = [];

    function installBillboards(template)
    {
        const initialBox = new THREE.Box3().setFromObject(template);
        const initialSize = initialBox.getSize(new THREE.Vector3());

        if(initialSize.x <= 0 || !Number.isFinite(initialSize.x))
        {
            console.error('El letrero FBX no tiene un ancho válido.');
            return;
        }

        const scale = BILLBOARD_WIDTH / initialSize.x;
        template.scale.multiplyScalar(scale);
        template.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(template);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        BILLBOARDS.forEach(
            (location, index) =>
            {
                const group = new THREE.Group();
                const model = template.clone(true);

                model.position.set(-center.x, -box.min.y, -center.z);
                model.traverse(
                    child =>
                    {
                        if(child.isMesh)
                        {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    }
                );

                group.add(model);
                group.position.set(location.x, location.y, location.z);
                group.rotation.y = location.rotationY;
                scene.add(group);
                billboardGroups.push(group);

                if(index === VIDEO_BILLBOARD_INDEX)
                {
                    videoScreen.position.set(
                        VIDEO_OFFSET.x,
                        size.y * 0.62 + VIDEO_OFFSET.y,
                        size.z / 2 + VIDEO_OFFSET.z
                    );
                    videoScreen.scale.set(
                        0.85,0.85,1
                    );

                    group.add(videoScreen);
                }
            }
        );
    }

    billboardLoader.load(
        '/models/objetos/billboard/billdoard.fbx',
        installBillboards,
        undefined,
        error =>
        {
            console.error('No se pudo cargar billdoard.fbx:', error);
            videoScreen.position.set(-0.5, 2.5, -12);
            scene.add(videoScreen);
        }
    );

    const HOUSE_PATH = '/models/objetos/house/house.fbx';
    const HOUSE_WIDTH = 15;
    const HOUSE_STEP_HEIGHT = 0.28;
    const HOUSE_PLAYER_RADIUS = 0.35;
    const HOUSE_PLAYER_HEIGHT = 1.7;
    const HOUSE_POSITIONS =
    [
        { x: -17, z: -4, rotationY: Math.PI / 2 },
        { x: -17, z: -23, rotationY: Math.PI / 2 },
        { x: 17, z: -4, rotationY: -Math.PI / 2 },
        { x: 17, z: -23, rotationY: -Math.PI / 2 }
    ];

    const houseGroups = [];
    const houseColliders = [];
    const houseRaycaster = new THREE.Raycaster();
    const HOUSE_COLLISION_MARGIN = 0.5;
    const houseDirections =
    [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, -1)
    ];

    const houseLoader = new FBXLoader();

    // Se conserva el cargador FBX para otros objetos, pero se retiran
    // las cuatro casas antiguas para usar las seis salas del edificio.

    function nearbyHouseColliders(position)
    {
        const nearby = [];
        const margin = HOUSE_PLAYER_RADIUS + HOUSE_COLLISION_MARGIN;

        for(const house of houseColliders)
        {
            if(position.x < house.bounds.min.x - margin ||
                position.x > house.bounds.max.x + margin ||
                position.z < house.bounds.min.z - margin ||
                position.z > house.bounds.max.z + margin)
            {
                continue;
            }

            for(const collider of house.colliders)
            {
                if(position.x >= collider.box.min.x - margin &&
                    position.x <= collider.box.max.x + margin &&
                    position.z >= collider.box.min.z - margin &&
                    position.z <= collider.box.max.z + margin)
                {
                    nearby.push(collider);
                }
            }
        }

        return nearby;
    }

    function houseWallAt(position, feetY, candidates)
    {
        for(const collider of candidates)
        {
            if(collider.floorLike ||
                collider.box.max.y < feetY + 0.32 ||
                collider.box.min.y > feetY + HOUSE_PLAYER_HEIGHT)
            {
                continue;
            }

            if(collider.simpleWall)
            {
                const nearestX = THREE.MathUtils.clamp(
                    position.x, collider.box.min.x, collider.box.max.x
                );
                const nearestZ = THREE.MathUtils.clamp(
                    position.z, collider.box.min.z, collider.box.max.z
                );
                const dx = position.x - nearestX;
                const dz = position.z - nearestZ;

                if(dx * dx + dz * dz < HOUSE_PLAYER_RADIUS * HOUSE_PLAYER_RADIUS)
                {
                    return true;
                }

                continue;
            }

            for(const height of [0.45, 1.35])
            {
                const origin = new THREE.Vector3(
                    position.x, feetY + height, position.z
                );

                for(const direction of houseDirections)
                {
                    houseRaycaster.set(origin, direction);
                    houseRaycaster.far = HOUSE_PLAYER_RADIUS;

                    const hits = houseRaycaster.intersectObject(collider.mesh, false);

                    for(const hit of hits)
                    {
                        if(!hit.face)
                        {
                            continue;
                        }

                        const normal = hit.face.normal.clone()
                            .transformDirection(hit.object.matrixWorld);

                        if(Math.abs(normal.y) < 0.65)
                        {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }

    function houseGroundAt(position, previousFeetY, candidates)
    {
        let ground = 0;
        const maxRise = HOUSE_STEP_HEIGHT + 0.02;

        for(const collider of candidates)
        {
            if(position.x < collider.box.min.x ||
                position.x > collider.box.max.x ||
                position.z < collider.box.min.z ||
                position.z > collider.box.max.z ||
                collider.box.min.y > previousFeetY + maxRise ||
                collider.box.max.y < previousFeetY - 0.12)
            {
                continue;
            }

            if(collider.floorLike)
            {
                const top = collider.box.max.y;

                if(top >= previousFeetY - 0.1 && top <= previousFeetY + maxRise)
                {
                    ground = Math.max(ground, top);
                }

                continue;
            }

            const origin = new THREE.Vector3(
                position.x,
                previousFeetY + HOUSE_STEP_HEIGHT + 0.08,
                position.z
            );

            houseRaycaster.set(origin, new THREE.Vector3(0, -1, 0));
            houseRaycaster.far = HOUSE_STEP_HEIGHT + 0.2;
            const hits = houseRaycaster.intersectObject(collider.mesh, false);

            for(const hit of hits)
            {
                if(!hit.face)
                {
                    continue;
                }

                const normal = hit.face.normal.clone()
                    .transformDirection(hit.object.matrixWorld);
                const rise = hit.point.y - previousFeetY;

                if(normal.y > 0.65 && rise >= -0.1 && rise <= HOUSE_STEP_HEIGHT)
                {
                    ground = Math.max(ground, hit.point.y);
                    break;
                }
            }
        }

        return ground;
    }

    function moveWithHouseCollision(moveForward, moveRight)
    {
        const previous = camera.position.clone();
        const previousFeetY = previous.y - HOUSE_PLAYER_HEIGHT;

        if(moveForward !== 0)
        {
            controls.moveForward(moveForward);
        }

        if(moveRight !== 0)
        {
            controls.moveRight(moveRight);
        }

        if(houseColliders.length === 0)
        {
            const attempted = camera.position.clone();
            if(conferenceLayout.collides(camera.position))
            {
                camera.position.set(attempted.x, previous.y, previous.z);
                if(conferenceLayout.collides(camera.position))
                {
                    camera.position.x = previous.x;
                }
                camera.position.z = attempted.z;
                if(conferenceLayout.collides(camera.position))
                {
                    camera.position.z = previous.z;
                }
            }
            camera.position.y = HOUSE_PLAYER_HEIGHT;
            return;
        }

        const attempted = camera.position.clone();
        let candidates = nearbyHouseColliders(camera.position);
        let ground = houseGroundAt(camera.position, previousFeetY, candidates);

        if(houseWallAt(camera.position, ground, candidates))
        {
            camera.position.set(attempted.x, previous.y, previous.z);
            candidates = nearbyHouseColliders(camera.position);
            ground = houseGroundAt(camera.position, previousFeetY, candidates);

            if(houseWallAt(camera.position, ground, candidates))
            {
                camera.position.x = previous.x;
            }

            camera.position.z = attempted.z;
            candidates = nearbyHouseColliders(camera.position);
            ground = houseGroundAt(camera.position, previousFeetY, candidates);

            if(houseWallAt(camera.position, ground, candidates))
            {
                camera.position.z = previous.z;
            }
        }

        candidates = nearbyHouseColliders(camera.position);
        camera.position.y = houseGroundAt(camera.position, previousFeetY, candidates)
            + HOUSE_PLAYER_HEIGHT;
    }

    const interactionRaycaster = new THREE.Raycaster();
    const interactionPointer = new THREE.Vector2();
    const interactiveObjects = [];
    const MAX_INTERACTION_DISTANCE = 35;

    let focusedObject = null;
    let sharedVideoState = null;

    function registerInteractiveObject(mesh, callback)
    {
        mesh.userData.interact = callback;
        interactiveObjects.push(mesh);

        return mesh;
    }

    for(const button of videoButtons)
    {
        registerInteractiveObject(
            button,
            () =>
            {
                sendVideoAction(button.userData.videoAction);
            }
        );
    }

    const PDF_SOURCE = '/pdf/ejemplo.pdf';
    const PDF_PANEL =
    {
        x: 0,
        y: 8,
        z: 10,
        rotationY: 135,
        maxWidth: 6.4,
        maxHeight: 8.8
    };

    const pdfPanel = new THREE.Group();
    pdfPanel.position.set(PDF_PANEL.x, PDF_PANEL.y, PDF_PANEL.z);
    pdfPanel.rotation.y = PDF_PANEL.rotationY;
    scene.add(pdfPanel);

    let pdfDocument = null;
    let pdfCurrentPage = 1;
    let pdfPlane = null;
    let pdfFrame = null;
    let pdfPageLabel = null;
    let pdfRendering = false;
    let pdfPendingPage = null;
    let sharedPDFPage = 1;
    const pdfButtons = [];

    function makePDFControl(label, action, x)
    {
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 90;
        const context = canvas.getContext('2d');

        context.fillStyle = '#20252c';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.strokeStyle = '#ffffff';
        context.lineWidth = 4;
        context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
        context.fillStyle = '#ffffff';
        context.font = 'bold 30px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(label, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;

        const button = new THREE.Mesh(
            new THREE.PlaneGeometry(1.75, 0.52),
            new THREE.MeshBasicMaterial(
                {
                    map: texture,
                    transparent: true,
                    side: THREE.DoubleSide,
                    toneMapped: false
                }
            )
        );

        button.position.set(x, -4.75, 0.08);
        button.userData.pdfAction = action;
        pdfPanel.add(button);
        pdfButtons.push(button);

        registerInteractiveObject(
            button,
            () =>
            {
                changePDFPage(action === 'next' ? 1 : -1);
            }
        );
    }

    function makePDFPageLabel()
    {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 90;
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;

        pdfPageLabel = new THREE.Mesh(
            new THREE.PlaneGeometry(1.9, 0.52),
            new THREE.MeshBasicMaterial(
                {
                    map: texture,
                    transparent: true,
                    side: THREE.DoubleSide,
                    toneMapped: false
                }
            )
        );

        pdfPageLabel.position.set(0, -4.75, 0.08);
        pdfPageLabel.userData.canvas = canvas;
        pdfPageLabel.userData.texture = texture;
        pdfPanel.add(pdfPageLabel);
        updatePDFPageLabel();
    }

    function updatePDFPageLabel()
    {
        if(!pdfPageLabel)
        {
            return;
        }

        const canvas = pdfPageLabel.userData.canvas;
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#15191f';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.strokeStyle = '#ffffff';
        context.lineWidth = 4;
        context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
        context.fillStyle = '#ffffff';
        context.font = 'bold 30px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        const total = pdfDocument ? pdfDocument.numPages : 0;
        context.fillText(
            total ? `${pdfCurrentPage} / ${total}` : 'Cargando...',
            canvas.width / 2,
            canvas.height / 2
        );

        pdfPageLabel.userData.texture.needsUpdate = true;
    }

    async function renderPDFPage(pageNumber)
    {
        if(!pdfDocument)
        {
            return;
        }

        const safePage = Math.max(
            1,
            Math.min(pageNumber, pdfDocument.numPages)
        );

        if(pdfRendering)
        {
            pdfPendingPage = safePage;
            return;
        }

        pdfRendering = true;

        try
        {
            const page = await pdfDocument.getPage(safePage);
            const initial = page.getViewport({ scale: 1 });
            const renderScale = Math.min(
                2,
                1800 / Math.max(initial.width, initial.height)
            );
            const viewport = page.getViewport({ scale: renderScale });

            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);

            await page.render(
                {
                    canvasContext: canvas.getContext('2d', { alpha: false }),
                    viewport: viewport
                }
            ).promise;

            const ratio = viewport.width / viewport.height;
            const width = Math.min(
                PDF_PANEL.maxWidth,
                PDF_PANEL.maxHeight * ratio
            );
            const height = width / ratio;

            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

            if(pdfPlane)
            {
                pdfPlane.material.map.dispose();
                pdfPlane.material.dispose();
                pdfPlane.geometry.dispose();
                pdfPanel.remove(pdfPlane);
            }

            if(pdfFrame)
            {
                pdfFrame.material.dispose();
                pdfFrame.geometry.dispose();
                pdfPanel.remove(pdfFrame);
            }

            pdfFrame = new THREE.Mesh(
                new THREE.BoxGeometry(width + 0.12, height + 0.12, 0.08),
                new THREE.MeshBasicMaterial({ color: 0x252a30 })
            );
            pdfFrame.position.z = -0.055;
            pdfPanel.add(pdfFrame);

            pdfPlane = new THREE.Mesh(
                new THREE.PlaneGeometry(width, height),
                new THREE.MeshBasicMaterial(
                    {
                        map: texture,
                        side: THREE.DoubleSide,
                        toneMapped: false
                    }
                )
            );
            pdfPlane.position.z = 0.01;
            pdfPanel.add(pdfPlane);

            pdfCurrentPage = safePage;
            updatePDFPageLabel();

            const controlsY = -(height / 2) - 0.45;
            pdfButtons.forEach(button => button.position.y = controlsY);

            if(pdfPageLabel)
            {
                pdfPageLabel.position.y = controlsY;
            }
        }
        finally
        {
            pdfRendering = false;

            if(pdfPendingPage !== null)
            {
                const pending = pdfPendingPage;
                pdfPendingPage = null;

                if(pending !== pdfCurrentPage)
                {
                    renderPDFPage(pending);
                }
            }
        }
    }

    function changePDFPage(delta)
    {
        if(!pdfDocument)
        {
            return;
        }

        const target = Math.max(
            1,
            Math.min(pdfCurrentPage + delta, pdfDocument.numPages)
        );

        if(target !== pdfCurrentPage)
        {
            // El servidor decide la página y la retransmite a todos.
            socket.emit('pdfChangePage', target);
        }
    }

    async function loadPDFPlane()
    {
        try
        {
            const pdfjs = await import(
                'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs'
            );

            pdfjs.GlobalWorkerOptions.workerSrc =
                'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';

            pdfDocument = await pdfjs.getDocument(PDF_SOURCE).promise;

            makePDFPageLabel();
            makePDFControl('ANTERIOR', 'previous', -2.1);
            makePDFControl('SIGUIENTE', 'next', 2.1);

            await renderPDFPage(sharedPDFPage);

            console.info(
                'PDF cargado:',
                PDF_SOURCE,
                'Páginas:',
                pdfDocument.numPages
            );
        }
        catch(error)
        {
            console.error('No se pudo cargar el PDF:', PDF_SOURCE, error);
        }
    }

    loadPDFPlane();

    const IMAGE_DISPLAYS =
    [
        { src: '/images/imagen1.png', x: -11.1, y: 7.7, z: -13.8, width: 5.2, height: 3.7, rotationY: 0 },
        { src: '/images/imagen2.png', x: 12.8, y: 7.7, z: -13.8, width: 5.2, height: 3.7, rotationY: 0 }
    ];

    const imageLoader = new THREE.TextureLoader();
    const imagePlanes = [];
    const imageViewer = new THREE.Group();

    imageViewer.visible = false;
    camera.add(imageViewer);
    scene.add(camera);

    const viewerBackground = new THREE.Mesh(
        new THREE.PlaneGeometry(7.8, 5.4),
        new THREE.MeshBasicMaterial(
            {
                color: 0x10151c,
                depthTest: false,
                depthWrite: false,
                side: THREE.DoubleSide
            }
        )
    );

    viewerBackground.position.set(0, 0, -5.05);
    viewerBackground.renderOrder = 100;
    imageViewer.add(viewerBackground);

    const viewerImage = new THREE.Mesh(
        new THREE.PlaneGeometry(6.7, 4.2),
        new THREE.MeshBasicMaterial(
            {
                color: 0xffffff,
                side: THREE.DoubleSide,
                depthTest: false,
                depthWrite: false
            }
        )
    );

    viewerImage.position.set(0, -0.15, -5);
    viewerImage.renderOrder = 101;
    imageViewer.add(viewerImage);

    function makeCloseButton()
    {
        const canvas = document.createElement('canvas');

        canvas.width = 128;
        canvas.height = 128;

        const context = canvas.getContext('2d');

        context.fillStyle = '#aa3030';
        context.fillRect(0, 0, 128, 128);
        context.fillStyle = '#ffffff';
        context.font = 'bold 88px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('X', 64, 66);

        const button = new THREE.Mesh(
            new THREE.PlaneGeometry(0.65, 0.65),
            new THREE.MeshBasicMaterial(
                {
                    map: new THREE.CanvasTexture(canvas),
                    transparent: true,
                    depthTest: false,
                    depthWrite: false,
                    side: THREE.DoubleSide
                }
            )
        );

        button.position.set(3.48, 2.12, -4.95);
        button.renderOrder = 102;

        

        return button;
    }

    const closeImageButton = makeCloseButton();

    imageViewer.add(closeImageButton);

    let imageViewerOpen = false;

    function closeImageViewer()
    {
        imageViewerOpen = false;
        imageViewer.visible = false;

        if(focusedObject)
        {
            focusedObject.material.color.set(0xffffff);
            focusedObject = null;
        }

        crosshair.style.borderColor = '#ffffff';

        if(!controls.isLocked)
                {
                    controls.lock();
                }
    }

    function openImageViewer(texture)
    {
        viewerImage.material.map = texture;
        viewerImage.material.needsUpdate = true;

        const image = texture.image;
        const ratio = image && image.width && image.height
            ? image.width / image.height
            : 1.5;
        const maxWidth = 6.7;
        const maxHeight = 4.2;

        const width = Math.min(maxWidth, maxHeight * ratio);
        const height = width / ratio;

        viewerImage.geometry.dispose();
        viewerImage.geometry = new THREE.PlaneGeometry(width, height);

        imageViewerOpen = true;
        imageViewer.visible = true;

        if(controls.isLocked)
                {
                    controls.unlock();
                }
    }

    registerInteractiveObject(closeImageButton, closeImageViewer);

    IMAGE_DISPLAYS.forEach(
        item =>
        {
            imageLoader.load(
                item.src,
                texture =>
                {
                    texture.colorSpace = THREE.SRGBColorSpace;

                    const group = new THREE.Group();

                    group.position.set(item.x, item.y, item.z);
                    group.rotation.y = item.rotationY;

                    const border = new THREE.Mesh(
                        new THREE.BoxGeometry(item.width + 0.18, item.height + 0.18, 0.12),
                        new THREE.MeshBasicMaterial({ color: 0x1b2028 })
                    );

                    border.position.z = -0.07;
                    group.add(border);

                    const plane = new THREE.Mesh(
                        new THREE.PlaneGeometry(item.width, item.height),
                        new THREE.MeshBasicMaterial(
                            {
                                map: texture,
                                side: THREE.DoubleSide
                            }
                        )
                    );

                    group.add(plane);
                    scene.add(group);
                    imagePlanes.push(plane);

                    registerInteractiveObject(
                        plane,
                        () =>
                        {
                            openImageViewer(texture);
                        }
                    );
                },
                undefined,
                error =>
                {
                    console.error('Error al cargar imagen:', item.src, error);
                }
            );
        }
    );

    function getInteractiveObject(event = null)
    {
        if(!hasEnteredWorld)
        {
            return null;
        }

        if(controls.isLocked || !event)
        {
            interactionPointer.set(0, 0);
        }
        else
        {
            const rect = renderer.domElement.getBoundingClientRect();

            interactionPointer.set(
                (event.clientX - rect.left) / rect.width * 2 - 1,
                -(event.clientY - rect.top) / rect.height * 2 + 1
            );
        }

        camera.updateMatrixWorld(true);
        interactionRaycaster.setFromCamera(interactionPointer, camera);
        interactionRaycaster.far = MAX_INTERACTION_DISTANCE;

        const hits = interactionRaycaster.intersectObjects(
            imageViewerOpen ? [closeImageButton] : interactiveObjects,
            false
        );

        return hits.length > 0 ? hits[0].object : null;
    }

    function updateInteractionFocus()
    {
        const target = controls.isLocked
            ? getInteractiveObject()
            : null;

        if(target === focusedObject)
        {
            return;
        }

        if(focusedObject)
        {
            focusedObject.material.color.set(0xffffff);
        }

        focusedObject = target;

        if(focusedObject)
        {
            focusedObject.material.color.set(0x89d5ff);
        }

        crosshair.style.borderColor = focusedObject ? '#89d5ff' : '#ffffff';
        crosshair.style.transform = focusedObject ? 'scale(1.5)' : 'scale(1)';
    }

    function sendVideoAction(action)
    {
        if(!hasEnteredWorld)
        {
            return;
        }

        socket.emit('videoControl',
        {
            action,
            time: videoElement.currentTime
        });
    }

    document.addEventListener(
        'click',
        event =>
        {
            if(!hasEnteredWorld)
            {
                return;
            }

            if(!controls.isLocked && event.target !== renderer.domElement)
            {
                return;
            }

            const target = getInteractiveObject(event);

            if(!target)
            {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            console.info('Interacción 3D:', target.userData.videoAction);
            target.userData.interact();
        },
        true
    );

    async function applyVideoState(state)
    {
        if(!state)
        {
            return;
        }

        sharedVideoState = state;

        const elapsed = state.playing
            ? Math.max(0, (Date.now() - state.updatedAt) / 1000)
            : 0;

        const targetTime = state.time + elapsed;

        function synchronizeVideo()
        {
            if(Number.isFinite(videoElement.duration))
            {
                const safeTime = Math.min(
                    targetTime,
                    Math.max(0, videoElement.duration - 0.1)
                );

                if(Math.abs(videoElement.currentTime - safeTime) > 0.5)
                {
                    videoElement.currentTime = safeTime;
                }
            }

            if(state.playing)
            {
                videoElement.play().catch(
                    () =>
                    {
                        console.info('Haz clic en PLAY para habilitar la reproducción.');
                    }
                );
            }
            else
            {
                videoElement.pause();
            }
        }

        if(videoElement.readyState >= 1)
        {
            synchronizeVideo();
        }
        else
        {
            videoElement.addEventListener(
                'loadedmetadata',
                synchronizeVideo,
                { once: true }
            );
        }
    }

    socket.on('videoState', applyVideoState);

    socket.on('pdfPageChanged', data =>
    {
        const page = data?.page;
        if(!Number.isSafeInteger(page) || page < 1)
        {
            return;
        }
        sharedPDFPage = page;
        if(pdfDocument)
        {
            renderPDFPage(page).catch(console.error);
        }
    });

    socket.on('mediaState', state =>
    {
        if(Number.isSafeInteger(state?.pdfPage) && state.pdfPage >= 1)
        {
            sharedPDFPage = state.pdfPage;
            if(pdfDocument)
            {
                renderPDFPage(sharedPDFPage).catch(console.error);
            }
        }
        if(state?.video)
        {
            applyVideoState(state.video);
        }
    });



    videoElement.addEventListener(
        'error',
        () =>
        {
            console.error('No se pudo abrir:', VIDEO_SOURCE);
        }
    );

    enterWorld.addEventListener(
        'click',
        () =>
        {
            if(sharedVideoState && sharedVideoState.playing)
            {
                videoElement.play().catch(() => {});
            }
        }
    );

    const remote = new Map();
    let myId = null;

    function updateCount()
    {
        countEl.textContent = `Participantes: ${remote.size+1}`
    }

    function label(text)
    {
        const c = document.createElement('canvas');
        c.width = 256;
        c.height = 64;
        const x = c.getContext('2d'),s = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true}));
        s.scale.set(2.2,.55,1);
        s.userData = {c, x};
        drawLabel(s, text);

        return s
    }

    function drawLabel(s,text)
    {
        const{c, x} = s.userData;
        x.clearRect(0,0,c.width,c.height);
        x.fillStyle = 'rgba(0,0,0,.55)';
        x.fillRect(0,0,256,64);
        x.fillStyle = '#fff';
        x.font = '28px Arial';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText(text,128,32);
        s.material.map.needsUpdate = true
    }

const fbxLoader = new FBXLoader();

let avatarTemplate = null;
let avatarLoaded = false;

const pendingPlayers = new Map();

fbxLoader.load(
    '/models/avatar/robot.fbx',
    object =>
    {
        avatarTemplate = object;

        avatarTemplate.scale.set(
            0.0007,
            0.0007,
            0.0007
        );

        avatarTemplate.traverse(
            child =>
            {
                if(child.isMesh)
                {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            }
        );

        avatarLoaded = true;

        console.log('Avatar FBX cargado');

        pendingPlayers.forEach(
            p =>
            {
                createPlayer(
                    p
                );
            }
        );

        pendingPlayers.clear();
    },
    undefined,
    error =>
    {
        console.error(
            'Error cargando avatar:',
            error
        );
    }
);


    function createAvatar(color)
    {
        if(!avatarTemplate)
        {
            return null;
        }

        const avatar = avatarTemplate.clone(
            true
        );

        avatar.traverse(
            child =>
            {
                if(!child.isMesh)
                {
                    return;
                }

                child.castShadow = true;
                child.receiveShadow = true;

                if(Array.isArray(child.material))
                {
                    child.material = child.material.map(
                        originalMaterial =>
                        {
                            const material = originalMaterial.clone();

                            material.color = new THREE.Color(
                                color
                            );

                            return material;
                        }
                    );
                }
                else if(child.material)
                {
                    const material = child.material.clone();

                    material.color = new THREE.Color(
                        color
                    );

                    child.material = material;
                }
            }
        );

        return avatar;
    }


function setAvatarColor(avatar, color)
{
    if(!avatar)
    {
        return;
    }

    avatar.traverse(
        child =>
        {
            if(!child.isMesh)
            {
                return;
            }

            if(Array.isArray(child.material))
            {
                child.material.forEach(
                    material =>
                    {
                        material.color = new THREE.Color(
                            color
                        );
                    }
                );
            }
            else if(child.material)
            {
                child.material.color = new THREE.Color(
                    color
                );
            }
        }
    );
}


function createPlayer(p)
{


    if(p.id === myId || remote.has(p.id))
    {
        return;
    }

    if(!avatarLoaded)
    {
        pendingPlayers.set(
            p.id,
            p
        );

        return;
    }

    const g = new THREE.Group();

    const avatarColor = p.color || '#3da5ff';

    const avatar = createAvatar(
        avatarColor
    );

    if(avatar)
    {
        avatar.position.y = 0;

        g.add(
            avatar
        );
    }

    const l = label(
        p.name || 'Guest'
    );

    l.position.y = 2.05;

    g.add(
        l
    );

    g.position.set(
        p.x,
        0,
        p.z
    );

    g.rotation.y = p.ry;

    g.userData.label = l;
    g.userData.avatar = avatar;
    g.userData.color = avatarColor;

    scene.add(
        g
    );

    remote.set(
        p.id,
        g
    );

    updateCount();

    if(localStream)
    {
        createPeer(
            p.id,
            true
        );
    }
    console.log(
        'Jugador recibido:',
        p
    );

    console.log(
        'Color recibido:',
        p.color
    );
}


function apply(p)
{
    if(p.id === myId)
    {
        return;
    }

    if(!remote.has(p.id))
    {
        createPlayer(
            p
        );
    }

    const g = remote.get(
        p.id
    );

    if(!g)
    {
        return;
    }

    g.position.lerp(
        new THREE.Vector3(
            p.x,
            0,
            p.z
        ),
        .55
    );

    g.rotation.y = p.ry;

    drawLabel(
        g.userData.label,
        p.name || 'Guest'
    );

    const newColor = p.color || '#3da5ff';

    if(g.userData.color !== newColor)
    {
        setAvatarColor(
            g.userData.avatar,
            newColor
        );

        g.userData.color = newColor;
    }
}


socket.on(
    'init',
    d =>
    {
        myId = d.id;

        Object.values(
            d.players
        ).forEach(
            createPlayer
        );

        updateCount();
    }
);


socket.on(
    'playerJoined',
    createPlayer
);


socket.on(
    'playerMoved',
    apply
);


socket.on(
    'playerUpdated',
    apply
);


    let localStream = null;
    let audioContext = null;
    const audioZones = createAudioZones();
    let localAudioZone = 'pasillo';
    const remoteAudioZones = new Map();
    let microphoneAnalyser = null;
    let microphoneSource = null;
    let microphoneData = null;

    const peers = new Map();
    const remoteAudio = new Map();
    const pendingIce = new Map();

    const rtcConfig =
    {
        iceServers:
        [
            {
                urls: 'stun:stun.l.google.com:19302'
            },
            {
                urls: 'stun:stun1.l.google.com:19302'
            }
        ]
    };

    function voiceLog(...args)
    {
        console.log('[VOICE]', ...args);
    }

    function refreshVoiceStatus()
    {
        const localTrack = localStream?.getAudioTracks()[0];
        const micText = localTrack?.enabled ? 'Micrófono activo' : 'Micrófono silenciado';
        const connected = [...peers.values()].filter(
            pc => pc.connectionState === 'connected'
        ).length;
        const receiving = remoteAudio.size;

        voiceStatus.textContent =
            `${micText} | WebRTC: ${connected} | Audio remoto: ${receiving}`;
    }

    async function ensureAudioContext()
    {
        if(!audioContext)
        {
            audioContext = new (
                window.AudioContext ||
                window.webkitAudioContext
            )();
        }

        if(audioContext.state === 'suspended')
        {
            try
            {
                await audioContext.resume();
            }
            catch(error)
            {
                console.warn('[VOICE] No se pudo reanudar AudioContext:', error);
            }
        }
    }

    function setupMicrophoneMeter()
    {
        if(!localStream || !audioContext)
        {
            return;
        }

        if(microphoneSource)
        {
            try
            {
                microphoneSource.disconnect();
            }
            catch(error)
            {
            }
        }

        microphoneAnalyser = audioContext.createAnalyser();
        microphoneAnalyser.fftSize = 256;
        microphoneAnalyser.smoothingTimeConstant = 0.75;

        microphoneData = new Uint8Array(microphoneAnalyser.fftSize);
        microphoneSource = audioContext.createMediaStreamSource(localStream);
        microphoneSource.connect(microphoneAnalyser);

        voiceLog('Medidor de micrófono conectado.');
    }

    function updateMicrophoneMeter()
    {
        if(!microphoneAnalyser || !microphoneData || !localStream)
        {
            voiceMeterLevel.style.width = '0%';
            return;
        }

        const track = localStream.getAudioTracks()[0];

        if(!track || !track.enabled)
        {
            voiceMeterLevel.style.width = '0%';
            return;
        }

        microphoneAnalyser.getByteTimeDomainData(microphoneData);

        let sum = 0;

        for(let i = 0; i < microphoneData.length; i++)
        {
            const sample = (microphoneData[i] - 128) / 128;
            sum += sample * sample;
        }

        const rms = Math.sqrt(sum / microphoneData.length);
        const level = Math.min(100, rms * 350);

        voiceMeterLevel.style.width = `${level}%`;
    }

    function addLocalTracks(pc)
    {
        if(!localStream)
        {
            return;
        }

        const existingAudioSender = pc.getSenders().find(
            sender => sender.track?.kind === 'audio'
        );

        const track = localStream.getAudioTracks()[0];

        if(!track)
        {
            return;
        }

        if(existingAudioSender)
        {
            if(existingAudioSender.track !== track)
            {
                existingAudioSender.replaceTrack(track).catch(
                    error => console.error('[VOICE] replaceTrack:', error)
                );
            }

            return;
        }

        pc.addTrack(track, localStream);
        voiceLog('Track local añadido al peer.');
    }

    async function negotiatePeer(peerId, pc)
    {
        if(!pc || pc.signalingState !== 'stable')
        {
            return;
        }

        if(pc.userDataMakingOffer)
        {
            return;
        }

        try
        {
            pc.userDataMakingOffer = true;

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            socket.emit(
                'webrtc-offer',
                {
                    target: peerId,
                    offer: pc.localDescription
                }
            );

            voiceLog('Oferta enviada a', peerId);
        }
        catch(error)
        {
            console.error('[VOICE] Error creando oferta:', error);
        }
        finally
        {
            pc.userDataMakingOffer = false;
        }
    }

    function createPeer(peerId, initiator = false)
    {
        if(!peerId || peerId === myId)
        {
            return null;
        }

        if(peers.has(peerId))
        {
            const existing = peers.get(peerId);
            addLocalTracks(existing);

            if(initiator)
            {
                queueMicrotask(
                    () => negotiatePeer(peerId, existing)
                );
            }

            return existing;
        }

        const pc = new RTCPeerConnection(rtcConfig);
        pc.userDataMakingOffer = false;
        pc.userDataIgnoreOffer = false;

        peers.set(peerId, pc);
        addLocalTracks(pc);

        pc.ontrack =
            event =>
            {
                const stream = event.streams[0];

                voiceLog(
                    'Track remoto recibido de',
                    peerId,
                    event.track.kind,
                    event.track.readyState
                );

                if(stream)
                {
                    setupRemoteAudio(peerId, stream);
                }
            };

        pc.onicecandidate =
            event =>
            {
                if(event.candidate)
                {
                    socket.emit(
                        'webrtc-ice',
                        {
                            target: peerId,
                            candidate: event.candidate
                        }
                    );
                }
            };

        pc.oniceconnectionstatechange =
            () =>
            {
                voiceLog(
                    'ICE',
                    peerId,
                    pc.iceConnectionState
                );

                refreshVoiceStatus();
            };

        pc.onconnectionstatechange =
            () =>
            {
                voiceLog(
                    'Conexión',
                    peerId,
                    pc.connectionState
                );

                refreshVoiceStatus();

                if(['failed', 'closed'].includes(pc.connectionState))
                {
                    closePeer(peerId);
                }
            };

        pc.onnegotiationneeded =
            async () =>
            {
                voiceLog('Renegociación necesaria con', peerId);
                await negotiatePeer(peerId, pc);
            };

        if(initiator)
        {
            queueMicrotask(
                () => negotiatePeer(peerId, pc)
            );
        }

        return pc;
    }

    async function setupRemoteAudio(peerId, stream)
    {
        if(!stream)
        {
            return;
        }

        let entry = remoteAudio.get(peerId);

        if(!entry)
        {
            const audio = document.createElement('audio');
            audio.autoplay = true;
            audio.playsInline = true;
            audio.muted = false;
            audio.style.display = 'none';
            audio.dataset.peerId = peerId;

            document.body.appendChild(audio);

            entry =
            {
                audio: audio,
                stream: stream
            };

            remoteAudio.set(peerId, entry);
        }

        entry.stream = stream;
        entry.audio.srcObject = stream;

        updateAudioVolume(peerId);

        try
        {
            await entry.audio.play();
            voiceLog('Audio remoto reproduciendo:', peerId);
        }
        catch(error)
        {
            voiceLog(
                'Autoplay pendiente para',
                peerId,
                '- se reintentará al interactuar.'
            );
        }

        refreshVoiceStatus();
    }

    function updateAudioVolume(peerId)
    {
        const entry = remoteAudio.get(peerId);
        if(!entry) return;
        const player = remote.get(peerId);
        if(!player)
        {
            entry.audio.volume = 0;
            return;
        }
        const previous = remoteAudioZones.get(peerId) || 'pasillo';
        const remoteZone = audioZones.zoneAt(player.position, previous);
        remoteAudioZones.set(peerId, remoteZone);
        entry.audio.volume = remoteZone === localAudioZone ? 1 : 0;
    }

    function updateAllAudioVolumes()
    {
        localAudioZone = audioZones.zoneAt(camera.position, localAudioZone);
        remoteAudio.forEach(
            (_, id) => updateAudioVolume(id)
        );
    }

    async function resumeRemoteAudio()
    {
        await ensureAudioContext();

        for(const entry of remoteAudio.values())
        {
            try
            {
                await entry.audio.play();
            }
            catch(error)
            {
            }
        }
    }

    function closePeer(id)
    {
        const pc = peers.get(id);

        if(pc)
        {
            try
            {
                pc.ontrack = null;
                pc.onicecandidate = null;
                pc.onnegotiationneeded = null;
                pc.close();
            }
            catch(error)
            {
            }

            peers.delete(id);
        }

        const entry = remoteAudio.get(id);

        if(entry)
        {
            try
            {
                entry.audio.pause();
                entry.audio.srcObject = null;
                entry.audio.remove();
            }
            catch(error)
            {
            }

            remoteAudio.delete(id);
        }

        pendingIce.delete(id);
        refreshVoiceStatus();
    }

    enterWorld.addEventListener(
        'click',
        () =>
        {
            resumeRemoteAudio();
        }
    );

    document.addEventListener(
        'pointerdown',
        () =>
        {
            resumeRemoteAudio();
        },
        {
            passive: true
        }
    );

    micButton.onclick =
        async event =>
        {
            event.stopPropagation();

            if(!localStream)
            {
                try
                {
                    await ensureAudioContext();

                    localStream = await navigator.mediaDevices.getUserMedia(
                        {
                            audio:
                            {
                                echoCancellation: true,
                                noiseSuppression: true,
                                autoGainControl: true
                            },
                            video: false
                        }
                    );

                    setupMicrophoneMeter();

                    micButton.textContent = 'Desactivar';
                    socket.emit('micState', true);

                    voiceLog(
                        'Micrófono obtenido:',
                        localStream.getAudioTracks()[0]?.label || 'audio'
                    );

                    for(const id of remote.keys())
                    {
                        createPeer(id, true);
                    }

                    refreshVoiceStatus();
                }
                catch(error)
                {
                    console.error('[VOICE] getUserMedia:', error);
                    voiceStatus.textContent = 'No se pudo acceder al micrófono';
                }

                return;
            }

            const track = localStream.getAudioTracks()[0];

            if(!track)
            {
                return;
            }

            track.enabled = !track.enabled;

            micButton.textContent =
                track.enabled ? 'Desactivar' : 'Activar';

            socket.emit('micState', track.enabled);

            if(track.enabled)
            {
                for(const id of remote.keys())
                {
                    createPeer(id, true);
                }
            }

            refreshVoiceStatus();
        };

    // La voz se asigna automáticamente según el salón.
    voiceModeSelect.disabled = true;
    voiceModeSelect.title = 'Audio automático por salón y pasillo';

    socket.on(
        'webrtc-offer',
        async data =>
        {
            try
            {
                await ensureAudioContext();

                const pc = createPeer(data.from, false);

                if(!pc)
                {
                    return;
                }

                const offerCollision =
                    pc.userDataMakingOffer ||
                    pc.signalingState !== 'stable';

                const polite = myId && data.from
                    ? String(myId) > String(data.from)
                    : true;

                if(offerCollision && !polite)
                {
                    pc.userDataIgnoreOffer = true;
                    voiceLog('Oferta simultánea ignorada de', data.from);
                    return;
                }

                pc.userDataIgnoreOffer = false;

                if(offerCollision)
                {
                    await pc.setLocalDescription(
                        {
                            type: 'rollback'
                        }
                    );
                }

                await pc.setRemoteDescription(
                    new RTCSessionDescription(data.offer)
                );

                addLocalTracks(pc);

                for(const candidate of pendingIce.get(data.from) || [])
                {
                    await pc.addIceCandidate(candidate);
                }

                pendingIce.delete(data.from);

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                socket.emit(
                    'webrtc-answer',
                    {
                        target: data.from,
                        answer: pc.localDescription
                    }
                );

                voiceLog('Respuesta enviada a', data.from);
            }
            catch(error)
            {
                console.error('[VOICE] Error procesando oferta:', error);
            }
        }
    );

    socket.on(
        'webrtc-answer',
        async data =>
        {
            const pc = peers.get(data.from);

            if(!pc)
            {
                return;
            }

            try
            {
                await pc.setRemoteDescription(
                    new RTCSessionDescription(data.answer)
                );

                for(const candidate of pendingIce.get(data.from) || [])
                {
                    await pc.addIceCandidate(candidate);
                }

                pendingIce.delete(data.from);

                voiceLog('Respuesta recibida de', data.from);
            }
            catch(error)
            {
                console.error('[VOICE] Error procesando respuesta:', error);
            }
        }
    );

    socket.on(
        'webrtc-ice',
        async data =>
        {
            if(!data.candidate)
            {
                return;
            }

            const pc = peers.get(data.from);

            if(
                !pc ||
                !pc.remoteDescription ||
                !pc.remoteDescription.type
            )
            {
                if(!pendingIce.has(data.from))
                {
                    pendingIce.set(data.from, []);
                }

                pendingIce.get(data.from).push(data.candidate);
                return;
            }

            try
            {
                await pc.addIceCandidate(data.candidate);
            }
            catch(error)
            {
                if(!pc.userDataIgnoreOffer)
                {
                    console.error('[VOICE] Error ICE:', error);
                }
            }
        }
    );


function addChatMessage(data)
{
    const message = document.createElement('div');
    const name = document.createElement('span');
    const text = document.createElement('span');

    message.className = 'chatMessage';
    name.className = 'chatName';

    name.textContent = `${data.name || 'Guest'}: `;
    text.textContent = data.text || '';

    message.appendChild(name);
    message.appendChild(text);

    chatMessages.appendChild(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}


function sendChatMessage()
{
    const text = chatInput.value.trim();

    if(!text)
    {
        return;
    }

    socket.emit(
        'chatMessage',
        {
            text: text
        }
    );

    chatInput.value = '';
}


chatSend.addEventListener(
    'click',
    event =>
    {
        event.stopPropagation();

        sendChatMessage();
    }
);


chatInput.addEventListener(
    'keydown',
    event =>
    {
        event.stopPropagation();

        if(event.key === 'Enter')
        {
            event.preventDefault();

            sendChatMessage();

            chatInput.blur();

            if(!isTouchDevice)
            {
                controls.lock();
            }
        }
    }
);


chatInput.addEventListener(
    'keyup',
    event =>
    {
        event.stopPropagation();
    }
);


chatInput.addEventListener(
    'click',
    event =>
    {
        event.stopPropagation();
    }
);


socket.on(
    'chatMessage',
    data =>
    {
        addChatMessage(data);
    }
);


socket.on('playerLeft',id=>
    {
        const g = remote.get(id);
        if(g)
            {
                scene.remove(g);
                remote.delete(id)
            }
            closePeer(id);
            remoteAudioZones.delete(id);
            updateCount()
        });
const keys = {};

addEventListener(
    'keydown',
    event =>
    {
        if(event.code === 'Enter')
        {
            if(document.activeElement !== chatInput)
            {
                event.preventDefault();

                if(controls.isLocked)
                {
                    controls.unlock();
                }

                chatInput.focus();

                return;
            }
        }

        if(document.activeElement === chatInput)
        {
            return;
        }

        keys[event.code] = true;
    }
);

addEventListener(
    'keyup',
    event =>
    {
        keys[event.code] = false;
    }
);

const clock = new THREE.Clock();
let lastSend = 0;const SPEED = 5;

function loop(){requestAnimationFrame(loop);

    const dt = Math.min(clock.getDelta(), .05);
    const d = SPEED * dt;
    let forward = 0;
    let right = 0;

    if(controls.isLocked && !imageViewerOpen)
    {
        forward += (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
        right += (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    }

    if(isTouchDevice && hasEnteredWorld && !imageViewerOpen)
    {
        const deadZone = 0.08;
        const moveX = Math.abs(joystickX) > deadZone ? joystickX : 0;
        const moveY = Math.abs(joystickY) > deadZone ? joystickY : 0;

        forward -= moveY;
        right += moveX;
    }

    const length = Math.hypot(forward, right);

    if(length > 1)
    {
        forward /= length;
        right /= length;
    }

    if(length > 0)
    {
        moveWithHouseCollision(forward * d, right * d);
    }

    const now = performance.now();
    if(myId&&now-lastSend>50)
        {
            lastSend = now;
            const e = new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');
            socket.emit('move',
                {
                    x:camera.position.x,y:camera.position.y,z:camera.position.z,ry:e.y
                })
        }
        updateAllAudioVolumes();
        updateMicrophoneMeter();
        updateInteractionFocus();
        renderer.render(scene,camera)
    }loop();
    addEventListener('resize',()=>
        {
            camera.aspect = innerWidth/innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(innerWidth,innerHeight)
        });
  