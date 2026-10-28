'use strict';
const auth=require('./auth');
const email=String(process.env.ADMIN_EMAIL||'').trim().toLowerCase();
const password=process.env.ADMIN_PASSWORD;
const name=String(process.env.ADMIN_NAME||'Administrador').trim();
if(!email || !password || password.length<12 || !name)
{
    console.error('Define ADMIN_EMAIL, ADMIN_PASSWORD (12+ caracteres) y opcionalmente ADMIN_NAME.');
    process.exit(1);
}
if(auth.byEmail(email))
{
    console.error('El correo ya existe. Por seguridad, no se promueven cuentas existentes con este comando.');
    process.exit(1);
}
const user=auth.createUser(name,email,password);
auth.db.prepare("UPDATE users SET role='administrador' WHERE id=?").run(user.id);
console.log('Administrador creado:',email);
