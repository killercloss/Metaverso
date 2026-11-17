# Frame Lite / Metaverso UANL - estructura modular

## Ejecutar
1. Instala Node.js.
2. En esta carpeta ejecuta `npm install`.
3. Coloca `demo.mp4` en `public/videos/`.
4. Coloca `ejemplo.pdf` en `public/pdf/`.
5. Ejecuta `npm start`.
6. Abre la URL que muestre el servidor.

Para micrófono en móvil necesitas HTTPS (salvo localhost). Para una prueba pública despliega el proyecto Node completo en un servicio con HTTPS.

## Estructura
- `server.js`: Express, Socket.IO, estado multijugador y señalización.
- `public/index.html`: interfaz; carga únicamente CSS y `/js/app.js`.
- `public/css/styles.css`: estilos.
- `public/js/app.js`: entrada/orquestación compatible con la versión funcional actual.
- `public/js/modules/config.js`: rutas y configuración.
- `public/js/modules/models.js`: FBX y sistema de colisiones.
- `public/js/modules/audio.js`: micrófono, WebRTC, audio remoto y proximidad.
- `public/js/modules/images.js`: galería y visor.
- `public/js/modules/video.js`: video 3D y sincronización.
- `public/js/modules/avatar.js`: carga, clonación y color del avatar.
- `public/js/modules/controls.js`: teclado y resize.
- `public/js/modules/interaction.js`: raycasting e interacción.
- `public/js/modules/chat.js`: chat de texto.
- `public/js/modules/pdf.js`: PDF.js, render y cambio de páginas.
- `public/js/modules/multiplayer.js`: jugadores remotos y sincronización.

## Nota de compatibilidad
`app.js` conserva el código funcional completo de la última versión para no romper características durante la separación. Los módulos ya están creados como APIs independientes y centralizan la arquitectura para la siguiente fase de migración. Esto permite mover sistema por sistema fuera de `app.js` y probar cada cambio sin rehacer el proyecto completo de una vez.

## Medios
Los modelos FBX disponibles fueron incluidos. El video `demo.mp4` y el PDF `ejemplo.pdf` no estaban disponibles como archivos en la sesión, por lo que se dejaron archivos de instrucciones en sus carpetas.
