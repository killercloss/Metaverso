import * as THREE from 'three';

export function createMultiplayerSystem(options)
{
    const {
        socket,
        scene,
        avatarSystem,
        onPeerAdded,
        onPeerRemoved
    } = options;

    const remote = new Map();
    const pending = new Map();
    let myId = null;

    function label(text)
    {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        context.fillStyle = 'rgba(0,0,0,.65)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#fff';
        context.font = '42px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text || 'Guest', canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({ map: texture, transparent: true })
        );
        sprite.scale.set(2.5, 0.625, 1);
        sprite.position.y = 2.25;
        return sprite;
    }

    function createPlayer(player)
    {
        if(remote.has(player.id))
        {
            return remote.get(player.id);
        }

        const avatar = avatarSystem.clone(player.color || '#3da5ff');

        if(!avatar)
        {
            pending.set(player.id, player);
            return null;
        }

        const group = new THREE.Group();
        group.userData.playerId = player.id;
        avatar.scale.setScalar(0.01);
        group.add(avatar);
        group.add(label(player.name));
        scene.add(group);
        remote.set(player.id, group);
        apply(player);
        onPeerAdded?.(player.id);
        return group;
    }

    function apply(player)
    {
        if(player.id === myId)
        {
            return;
        }

        const group = remote.get(player.id) || createPlayer(player);

        if(!group)
        {
            return;
        }

        if(player.position)
        {
            group.position.set(
                player.position.x || 0,
                player.position.y || 0,
                player.position.z || 0
            );
        }

        if(typeof player.rotationY === 'number')
        {
            group.rotation.y = player.rotationY;
        }
    }

    avatarSystem.onReady(() =>
    {
        for(const player of pending.values())
        {
            createPlayer(player);
        }
        pending.clear();
    });

    socket.on('connect', () =>
    {
        myId = socket.id;
    });

    socket.on('players', players =>
    {
        for(const player of players || [])
        {
            if(player.id !== myId)
            {
                apply(player);
            }
        }
    });

    socket.on('playerJoined', player =>
    {
        if(player.id !== myId)
        {
            apply(player);
        }
    });

    socket.on('playerMoved', apply);

    socket.on('playerLeft', id =>
    {
        const group = remote.get(id);

        if(group)
        {
            scene.remove(group);
            remote.delete(id);
        }

        pending.delete(id);
        onPeerRemoved?.(id);
    });

    return {
        remote,
        apply,
        getMyId()
        {
            return myId;
        },
        sendState(state)
        {
            socket.emit('move', state);
        }
    };
}
