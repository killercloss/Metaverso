# Galería de carteles — sofás y elementos de demostración

- Sofás: `public/models/exhibition/Office sofa.fbx` y tres mapas PBR del mismo directorio.
- Distribución: `public/js/modules/exhibitionModels.js`, lista `sofas`; 72 instancias repartidas entre ambas plantas (36 junto a muros exteriores, 12 en conjuntos en U, 24 contra paredes posteriores).
- Escala: 40 % de una referencia de 5 unidades (máximo 2 unidades), conservando las proporciones del modelo.
- Billboards FBX: carga desactivada en `public/js/app.js`.
- Panel PDF de demostración: `loadPDFPlane()` desactivado; código y eventos conservados.
- Imágenes flotantes de demostración: `IMAGE_DISPLAYS = []`; visor conservado.
- Marquesinas de patrocinadores: sin cambios.
- La decoración no incorpora colisión nueva. Revisar visualmente ubicación/orientación y distancia respecto a carteles y rampas.
