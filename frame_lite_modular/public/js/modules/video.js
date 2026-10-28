import * as THREE from 'three';

export function createVideoSystem(options)
{
    const {
        scene,
        socket,
        source,
        position,
        registerInteractive
    } = options;

    const video = document.createElement('video');
    video.src = source;
    video.crossOrigin = 'anonymous';
    video.loop = false;
    video.playsInline = true;
    video.preload = 'metadata';

    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;

    const group = new THREE.Group();
    group.position.copy(position);
    scene.add(group);

    const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(6.4, 3.6),
        new THREE.MeshBasicMaterial(
        {
            map: texture,
            side: THREE.DoubleSide,
            toneMapped: false
        })
    );
    group.add(screen);

    function emit(action)
    {
        socket.emit('videoAction',
        {
            action,
            time: video.currentTime
        });
    }

    registerInteractive(screen, () =>
    {
        if(video.paused)
        {
            video.play().then(() => emit('play')).catch(console.error);
        }
        else
        {
            video.pause();
            emit('pause');
        }
    });

    socket.on('videoState', state =>
    {
        if(typeof state?.time === 'number' && Math.abs(video.currentTime - state.time) > 0.5)
        {
            video.currentTime = state.time;
        }

        if(state?.playing)
        {
            video.play().catch(() => {});
        }
        else
        {
            video.pause();
        }
    });

    return { video, texture, group, screen };
}
