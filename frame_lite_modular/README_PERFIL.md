# Perfil y avatar — Metaverso UANL

Abre `/perfil` tras iniciar sesión. Cada usuario puede modificar su nombre visible, escoger un color hexadecimal para su avatar FBX y cambiar su contraseña.

- `PATCH /api/auth/profile`: `{ "name": "Nombre", "avatarColor": "#3da5ff" }` (sesión requerida).
- `POST /api/auth/change-password`: `{ "currentPassword": "...", "newPassword": "..." }` (sesión requerida). Revoca todas las sesiones del usuario.
- El color se guarda en la columna `users.avatar_color`, agregada automáticamente a bases SQLite existentes.
- El nombre y color nuevos se aplican a la próxima entrada al mundo virtual. Las sesiones actuales reciben un aviso `profileUpdated`, pero la escena existente no se vuelve a cargar automáticamente.
- Se conserva el modelo `robot.fbx` original: esta personalización permite nombre y color, no edición de geometría, ropa ni accesorios.
- La página `/perfil` se sirve únicamente a usuarios autenticados. La página `/admin` mantiene sus restricciones administrativas.
- Usa Node.js >=22.13 y `npm install`, luego `npm start`. Pruebas: `npm test`.

**Importante:** este ZIP parte de `Metaverso_UANL_Login_Real_Admin.zip`, no de la versión autónoma más reciente de Codex. No sobrescribas el proyecto que Codex está modificando sin integrar antes las diferencias.
