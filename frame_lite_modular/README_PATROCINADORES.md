# Marquesinas animadas de patrocinadores

Las marquesinas están instaladas cerca del techo, sobre las paredes longitudinales del edificio. Se desplazan continuamente en direcciones opuestas según la pared, repitiendo las imágenes en bucle.

## Agregar o retirar un patrocinador

1. Copiar una imagen `.png`, `.jpg`, `.jpeg` o `.webp` a `public/sponsors/`.
2. Los archivos se ordenan alfabéticamente por nombre. Usa `01_`, `02_`, etc. si deseas controlar el orden.
3. El servidor detecta los cambios automáticamente: la galería consulta el catálogo al iniciar y cada 60 segundos. No es necesario cambiar el código ni reiniciar Node.js.
4. Para retirar un patrocinador, elimina su archivo de esa carpeta.

Recomendación: imágenes horizontales de proporción aproximada 4:1 a 5:1, por ejemplo 1000 × 200 px; preferentemente WebP o PNG, hasta 1 MB por imagen. Las imágenes se ajustan completas sin recorte.

Endpoint de catálogo: `/api/sponsors`.

La geometría de los banners es visual y no genera nuevas colisiones. Las marquesinas no sustituyen ni alteran los seis salones o el segundo piso.
