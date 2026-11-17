# Landing page de Metaverso UANL

- `/` es la página pública de presentación.
- `/metaverso` abre la experiencia 3D y conserva el login, registro y los demás sistemas.
- `/perfil` y `/admin` conservan sus rutas y permisos.
- El botón fijo de navegación y los CTA conducen a `/metaverso`.
- Captura existente: `public/images/imagen1.png`, correspondiente a una versión anterior del entorno. Los otros dos paneles son representaciones gráficas y se identifican como imágenes pendientes; sustituir por capturas reales cuando estén disponibles.
- Archivos nuevos: `public/index.html`, `public/css/landing.css`, `public/js/landing.js`.
- Archivo trasladado: `private/metaverse.html` (antes `public/index.html`).
- Ruta nueva en `server.js`: GET `/metaverso`.
- Para ejecutar: `npm install`, `npm start`; visitar http://localhost:3000/.
- No sobrescribir una rama que Codex esté modificando sin integrar los cambios.
