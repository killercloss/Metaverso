import * as THREE from 'three';

export function createImageGallery(options)
{
    const {
        scene,
        camera,
        paths,
        displays,
        registerInteractive
    } = options;

    const loader = new THREE.TextureLoader();
    const planes = [];
    const viewer = new THREE.Group();
    viewer.visible = false;
    camera.add(viewer);
    scene.add(camera);

    const background = new THREE.Mesh(
        new THREE.PlaneGeometry(8.4, 5.4),
        new THREE.MeshBasicMaterial(
        {
            color: 0x101216,
            transparent: true,
            opacity: 0.96,
            depthTest: false
        })
    );
    background.position.set(0, 0, -4.1);
    viewer.add(background);

    const image = new THREE.Mesh(
        new THREE.PlaneGeometry(7.6, 4.6),
        new THREE.MeshBasicMaterial(
        {
            transparent: true,
            depthTest: false,
            toneMapped: false
        })
    );
    image.position.set(0, 0, -4);
    viewer.add(image);

    function close()
    {
        viewer.visible = false;
    }

    function open(texture)
    {
        image.material.map = texture;
        image.material.needsUpdate = true;
        viewer.visible = true;
    }

    paths.forEach((path, index) =>
    {
        loader.load(path, texture =>
        {
            texture.colorSpace = THREE.SRGBColorSpace;
            const config = displays[index] || displays[0];
            const plane = new THREE.Mesh(
                new THREE.PlaneGeometry(config.width || 4, config.height || 3),
                new THREE.MeshBasicMaterial(
                {
                    map: texture,
                    side: THREE.DoubleSide,
                    toneMapped: false
                })
            );
            plane.position.set(config.x, config.y, config.z);
            plane.rotation.y = config.rotationY || 0;
            scene.add(plane);
            planes.push(plane);
            registerInteractive(plane, () => open(texture));
        });
    });

    return { planes, viewer, open, close };
}
