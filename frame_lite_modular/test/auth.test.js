const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'metaverso-auth-'));
process.env.DATA_DIR=folder;
const auth=require('../auth');
test('cuenta nueva recibe rol oyente y contraseña protegida',()=>
{
    const user=auth.createUser('Prueba','prueba@example.com','contraseña-segura-123');
    assert.equal(user.role,'oyente');
    assert.notEqual(user.password_hash,'contraseña-segura-123');
    assert.equal(auth.verifyPassword('contraseña-segura-123',user.password_hash),true);
    assert.equal(auth.verifyPassword('incorrecta',user.password_hash),false);
});
test('sesión persistente, revocación y deshabilitación',()=>
{
    const user=auth.byEmail('prueba@example.com');
    const token=auth.createSession(user.id);
    assert.equal(auth.sessionUser(token).id,user.id);
    auth.revoke(token);
    assert.equal(auth.sessionUser(token),null);
    const token2=auth.createSession(user.id);
    auth.updateUser(user.id,'ponente',true);
    assert.equal(auth.sessionUser(token2),null);
    assert.equal(auth.getUser(user.id).role,'ponente');
});
test('protección del último administrador',()=>
{
    const user=auth.byEmail('prueba@example.com');
    auth.db.prepare("UPDATE users SET role='administrador' WHERE id=?").run(user.id);
    assert.throws(()=>auth.updateUser(user.id,'oyente',true),/último administrador/);
    assert.throws(()=>auth.updateUser(user.id,'administrador',false),/último administrador/);
});
test.after(()=>{auth.db.close();fs.rmSync(folder,{recursive:true,force:true});});
test('personalización persistente del nombre y color del avatar',() =>
{
    const user=auth.byEmail('prueba@example.com');
    const updated=auth.updateProfile(user.id,'Avatar Nuevo','#aabbcc');
    assert.equal(updated.name,'Avatar Nuevo');
    assert.equal(auth.publicUser(auth.getUser(user.id)).avatarColor,'#aabbcc');
    assert.throws(()=>auth.updateProfile(user.id,'X','#invalid'),/nombre|Color/);
});
test('cambio de contraseña invalida sesiones existentes',() =>
{
    const user=auth.byEmail('prueba@example.com');
    const token=auth.createSession(user.id);
    auth.changePassword(user.id,'contraseña-segura-123','nueva-contraseña-456');
    assert.equal(auth.sessionUser(token),null);
    assert.equal(auth.verifyPassword('nueva-contraseña-456',auth.getUser(user.id).password_hash),true);
    assert.equal(auth.verifyPassword('contraseña-segura-123',auth.getUser(user.id).password_hash),false);
});
