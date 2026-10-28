import * as THREE from 'three';

export function createInteractionSystem(camera)
{
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const objects = [];
    let focusedObject = null;

    function register(mesh, callback, maxDistance = 35)
    {
        mesh.userData.interactionCallback = callback;
        mesh.userData.maxInteractionDistance = maxDistance;
        objects.push(mesh);
        return mesh;
    }

    function unregister(mesh)
    {
        const index = objects.indexOf(mesh);
        if(index >= 0)
        {
            objects.splice(index, 1);
        }
    }

    function pick(clientX = null, clientY = null)
    {
        if(clientX === null || clientY === null)
        {
            pointer.set(0, 0);
        }
        else
        {
            pointer.x = (clientX / innerWidth) * 2 - 1;
            pointer.y = -(clientY / innerHeight) * 2 + 1;
        }

        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(objects, true);

        for(const hit of hits)
        {
            let object = hit.object;

            while(object && !object.userData.interactionCallback)
            {
                object = object.parent;
            }

            if(!object)
            {
                continue;
            }

            const maximum = object.userData.maxInteractionDistance ?? 35;

            if(hit.distance <= maximum)
            {
                return object;
            }
        }

        return null;
    }

    function activate(clientX = null, clientY = null)
    {
        const object = pick(clientX, clientY);

        if(object?.userData.interactionCallback)
        {
            object.userData.interactionCallback();
            return true;
        }

        return false;
    }

    function updateFocus()
    {
        focusedObject = pick();
        return focusedObject;
    }

    return {
        register,
        unregister,
        activate,
        updateFocus,
        get focusedObject()
        {
            return focusedObject;
        }
    };
}
