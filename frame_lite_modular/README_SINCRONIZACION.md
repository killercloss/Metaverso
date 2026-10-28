# Sincronización PDF y video

El servidor mantiene la página del PDF y el estado de reproducción del video.
Cualquier usuario puede pulsar ANTERIOR/SIGUIENTE o PLAY/PAUSE/STOP.
Socket.IO retransmite la acción a todos, incluido quien la inició.
Los usuarios nuevos reciben el estado actual.

Instalación: npm install; npm start.

Prueba con dos navegadores o dispositivos conectados al mismo servidor.
En móviles, la reproducción automática puede requerir interacción inicial.
El archivo de video debe existir en public/videos/demo.mp4 y el PDF en public/pdf/ejemplo.pdf.

El resto de los sistemas originales permanece en app.js para conservar compatibilidad.
No se ha hecho una prueba end-to-end con navegadores reales.
