# Chat y votación — Metaverso UANL

## Chat
El servidor recibe `chatMessage`, valida el texto (1–300 caracteres), utiliza el nombre autenticado y retransmite a todos los sockets. Hay un intervalo mínimo de 350 ms entre mensajes por conexión.

## Votación
Hay seis botones 3D situados sobre las entradas de las salas, y botones equivalentes en el HUD para accesibilidad. Para activar un botón 3D hay que hacer clic apuntando al rótulo desde menos de 9 unidades. La sala se puede cambiar cuantas veces sea necesario; se conserva solo el voto más reciente de cada cuenta para el evento `evento-principal`.

`GET /api/votes` devuelve `{eventId,myVote,rooms:[{room,name,total,oyentes,jueces}]}`; `POST /api/votes` con JSON `{ "room": 1 }` cambia el voto del usuario autenticado. La tabla `votes` tiene clave primaria `(event_id,user_id)` y restricción de sala 1–6. El total incluye todos los roles; `oyentes` y `jueces` son subconjuntos separados. El conteo se basa en el rol **actual** de cada usuario.

Para inspeccionar directamente SQLite:
```sql
SELECT v.room_id AS sala, COUNT(*) AS total,
SUM(CASE WHEN u.role='oyente' THEN 1 ELSE 0 END) AS oyentes,
SUM(CASE WHEN u.role='juez' THEN 1 ELSE 0 END) AS jueces
FROM votes v JOIN users u ON u.id=v.user_id
WHERE v.event_id='evento-principal'
GROUP BY v.room_id ORDER BY v.room_id;
```

## Limitaciones
Una cuenta no demuestra una persona única: todavía se necesita verificación de identidad si se requiere impedir cuentas duplicadas. Los botones 3D no se han probado en navegador real. Esta versión parte del ZIP `Metaverso_UANL_Perfil_Avatar.zip` y no incluye cambios independientes posteriores de Codex.
