// Canales de audio independientes según la posición en el edificio.
export function createAudioZones()
{
    const north = ['salon-1', 'salon-2', 'salon-3'];
    const south = ['salon-6', 'salon-5', 'salon-4'];
    function zoneAt(position, previous = 'pasillo')
    {
        if(!position) return 'pasillo';
        const {x, z} = position;
        if(Math.abs(x) > 21 || Math.abs(z) > 27) return 'pasillo';
        const threshold = previous.startsWith('salon-') ? 7.65 : 8.35;
        if(Math.abs(z) <= threshold) return 'pasillo';
        const column = Math.max(0, Math.min(2, Math.floor((x + 21) / 14)));
        return (z < 0 ? north : south)[column];
    }
    return {zoneAt};
}
