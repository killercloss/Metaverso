# Galería UANL: seis salas enfrentadas y dos pisos

- Distribución en planta: salas 1, 2 y 3 al lado izquierdo del pasillo central; salas 4, 5 y 6 al lado derecho. Cada sala dispone de exhibición en PB y P1, sin crear salas adicionales.
- Edificio 132 × 150 unidades, pasillo central de 20 unidades de ancho. Cada sala ocupa aproximadamente 53 × 46 unidades.
- 84 puestos por sala (42 en cada piso), 504 puestos en total.
- Pasarela y entrepisos superiores de cristal; cuatro rampas longitudinales (dos en cada extremo del pasillo), barandales y líneas luminosas.
- Macetas contra paredes, grupos de sillas y cuadros individuales colocados en muros. Se omite `picture_frame_collection.glb`.
- Se preservan los módulos previos de voz, chat, votación, autenticación y medios.

## Validación pendiente

La geometría y las colisiones requieren revisión visual y recorrido manual en navegador, especialmente las rampas y el comportamiento de los entrepisos. Los 504 paneles son posiciones de exhibición, todavía sin conexión al catálogo definitivo. Las decoraciones se muestran sin colisión física. La carga repetida de modelos puede requerir instanciación/LOD para equipos modestos.

Iniciar desde `frame_lite_modular`: `npm install` y `npm start`.
