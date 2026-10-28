import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export function loadFBX(path)
{
    return new Promise((resolve, reject) =>
    {
        new FBXLoader().load(path, resolve, undefined, reject);
    });
}

export function createHouseCollisionSystem(options)
{
    const {
        scene,
        housePath,
        positions,
        width = 15,
        playerRadius = 0.35,
        playerHeight = 1.7,
        stepHeight = 0.28
    } = options;

    const groups = [];
    const colliders = [];
    const raycaster = new THREE.Raycaster();
    const margin = 0.5;
    const directions =
    [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, -1),
        new THREE.Vector3(1, 0, 1).normalize(),
        new THREE.Vector3(-1, 0, 1).normalize(),
        new THREE.Vector3(1, 0, -1).normalize(),
        new THREE.Vector3(-1, 0, -1).normalize()
    ];

    function nearby(position)
    {
        return colliders.filter(item =>
        {
            const center = item.group.position;
            return Math.abs(position.x - center.x) <= width + 4 &&
                   Math.abs(position.z - center.z) <= width + 4;
        });
    }

    function wallAt(position, feetY, candidates = nearby(position))
    {
        const heights =
        [
            feetY + 0.25,
            feetY + playerHeight * 0.55,
            feetY + playerHeight - 0.1
        ];

        for(const item of candidates)
        {
            for(const y of heights)
            {
                for(const direction of directions)
                {
                    raycaster.set(
                        new THREE.Vector3(position.x, y, position.z),
                        direction
                    );
                    raycaster.far = playerRadius + margin;

                    const hits = raycaster.intersectObject(item.group, true);

                    if(hits.length && hits[0].distance <= playerRadius + 0.08)
                    {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    function groundAt(position, previousFeetY, candidates = nearby(position))
    {
        const origin = new THREE.Vector3(
            position.x,
            previousFeetY + stepHeight + 1,
            position.z
        );

        raycaster.set(origin, new THREE.Vector3(0, -1, 0));
        raycaster.far = playerHeight + 3;

        let best = null;

        for(const item of candidates)
        {
            const hits = raycaster.intersectObject(item.group, true);

            if(hits.length)
            {
                const y = hits[0].point.y;

                if(y <= previousFeetY + stepHeight + 0.05 && (best === null || y > best))
                {
                    best = y;
                }
            }
        }

        return best;
    }

    loadFBX(housePath).then(template =>
    {
        positions.forEach(config =>
        {
            const house = template.clone(true);
            house.position.set(config.x, config.y || 0, config.z);
            house.rotation.y = config.rotationY || 0;
            scene.add(house);
            groups.push(house);
            colliders.push({ group: house });
        });
    }).catch(error => console.error('Casas FBX:', error));

    return { groups, colliders, nearby, wallAt, groundAt };
}
