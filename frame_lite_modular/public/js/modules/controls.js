export function createKeyboardState()
{
    const keys = {};

    addEventListener('keydown', event =>
    {
        keys[event.code] = true;
    });

    addEventListener('keyup', event =>
    {
        keys[event.code] = false;
    });

    return keys;
}

export function bindResize(camera, renderer)
{
    addEventListener('resize', () =>
    {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
    });
}
