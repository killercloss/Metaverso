# Acceso real y administración de usuarios

Esta versión procede del ZIP `metaversoUANL_login_nombre_corregido(1).zip` (no del árbol de trabajo automatizado de Codex). No sobrescribas el proyecto de Codex sin integrar los cambios.

## Requisitos

- Node.js 22.13 o superior (se usa `node:sqlite`, integrado en Node; en algunas versiones muestra una advertencia experimental).
- `npm install` y `npm start` en `frame_lite_modular`.
- Abrir `http://localhost:3000`. El formulario ofrece registro e inicio de sesión. El mundo y Socket.IO exigen una sesión válida.

## Crear el primer administrador

PowerShell, desde la carpeta del proyecto:

```powershell
$env:ADMIN_EMAIL = 'admin@ejemplo.com'
$env:ADMIN_NAME = 'Administrador UANL'
$env:ADMIN_PASSWORD = 'UNA-CONTRASENA-UNICA-DE-12-O-MAS-CARACTERES'
npm run create-admin
Remove-Item Env:ADMIN_PASSWORD
```

El comando solo crea una cuenta nueva; nunca eleva una cuenta existente. Accede con ella desde la página principal y abre `/admin` para gestionar los roles y habilitar/deshabilitar perfiles.

## Seguridad y limitaciones

- Contraseñas con `scrypt` y salt aleatorio; sesiones persistentes en SQLite con token aleatorio y solo su hash almacenado.
- Cookie `HttpOnly`, `SameSite=Strict`, `Secure` cuando la petición llega por HTTPS. En producción **usa HTTPS**; si se usa un proxy de confianza que termina TLS, configura `TRUST_PROXY=1` y asegura que solo ese proxy pueda enviar `X-Forwarded-Proto`.
- Registro: rol `oyente`. Roles: `oyente`, `ponente`, `auxiliar`, `juez`, `administrador`.
- Solo el administrador puede listar perfiles y cambiar roles/estado. No puede desactivar al último administrador. Los cambios de rol o estado revocan las sesiones y desconectan los sockets del usuario.
- El servidor asigna el nombre y rol del avatar desde la cuenta autenticada; ya no acepta `setName` arbitrario.
- Base de datos: `data/metaverso.sqlite`. No la publiques ni la incluyas en ZIP. Realiza respaldos de la base y su WAL con un procedimiento compatible con SQLite.
- **No hay verificación de correo, recuperación de contraseña, MFA, auditoría de administradores ni identidad civil verificada.** Una cuenta no equivale necesariamente a una persona única; no habilites votación con garantía de una persona/un voto hasta añadir verificación y una restricción por evento.
- Los controles de PDF y video mantienen los permisos originales de esta versión; integrar restricciones por rol es trabajo posterior.
- No se han hecho pruebas manuales en navegador, WebGL, WebRTC, móvil ni HTTPS. Hay pruebas automatizadas básicas en `npm test`.
