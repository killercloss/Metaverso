import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export function createAvatarSystem(path)
{
    const loader = new FBXLoader();
    let template = null;
    let loaded = false;
    const waiting = [];

    function recolor(avatar, color)
    {
        avatar.traverse(child =>
        {
            if(!child.isMesh)
            {
                return;
            }

            const materials = Array.isArray(child.material)
                ? child.material
                : [child.material];

            for(const material of materials)
            {
                if(material?.color)
                {
                    material.color.set(color);
                }
            }
        });
    }

    function clone(color = '#3da5ff')
    {
        if(!template)
        {
            return null;
        }

        const avatar = template.clone(true);
        recolor(avatar, color);
        return avatar;
    }

    function onReady(callback)
    {
        if(loaded)
        {
            callback();
        }
        else
        {
            waiting.push(callback);
        }
    }

    loader.load(
        path,
        object =>
        {
            template = object;
            loaded = true;
            waiting.splice(0).forEach(callback => callback());
        },
        undefined,
        error => console.error('Avatar FBX:', error)
    );

    return {
        clone,
        recolor,
        onReady,
        get loaded()
        {
            return loaded;
        }
    };
}
