'use strict';
const express = require('express');
const auth = require('./auth');
const router = express.Router();
const COOKIE = 'metaverso_session';
function cookies(req)
{
    const result={};
    for(const part of String(req.headers.cookie || '').split(';'))
    {
        const idx=part.indexOf('=');
        if(idx>0) result[part.slice(0,idx).trim()]=part.slice(idx+1).trim();
    }
    return result;
}
function token(req) { return cookies(req)[COOKIE]; }
function current(req) { return auth.sessionUser(token(req)); }
function secure(req) { return req.secure || (process.env.TRUST_PROXY === '1' && req.headers['x-forwarded-proto'] === 'https'); }
function cookieOptions(req) { return { httpOnly:true, sameSite:'strict', secure:secure(req), path:'/', maxAge:7*86400000 }; }
function issue(req,res,user)
{
    const old=token(req);
    if(old) auth.revoke(old);
    res.cookie(COOKIE,auth.createSession(user.id),cookieOptions(req));
    res.json({ user:auth.publicUser(user) });
}
function guard(req,res,next)
{
    req.user=current(req);
    if(!req.user) return res.status(401).json({ error:'Debes iniciar sesión' });
    next();
}
function admin(req,res,next)
{
    if(req.user.role!=='administrador') return res.status(403).json({error:'Acceso reservado a administradores'});
    next();
}
router.use((req,res,next) =>
{
    if(['POST','PUT','PATCH','DELETE'].includes(req.method))
    {
        const origin=req.get('origin');
        if(origin)
        {
            try { if(new URL(origin).host !== req.get('host') || new URL(origin).protocol !== (secure(req)?'https:':'http:')) return res.status(403).json({error:'Origen no autorizado'}); }
            catch { return res.status(403).json({error:'Origen no autorizado'}); }
        }
    }
    next();
});
router.post('/signup',(req,res) =>
{
    const name=String(req.body?.name||'').trim();
    const email=String(req.body?.email||'').trim().toLowerCase();
    const password=req.body?.password;
    if(name.length<2 || name.length>40 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || typeof password!=='string' || password.length<10 || Buffer.byteLength(password)>256) return res.status(400).json({error:'Nombre de 2 a 40 caracteres, correo válido y contraseña de al menos 10 caracteres'});
    if(!auth.rateLimit('signup:'+req.ip,5,3600000)) return res.status(429).json({error:'Demasiados registros. Intenta más tarde'});
    if(auth.byEmail(email)) return res.status(409).json({error:'Este correo ya está registrado'});
    try { const user=auth.createUser(name,email,password);
        if(/^#[0-9a-fA-F]{6}$/.test(req.body?.avatarColor||'')) auth.updateProfile(user.id,name,req.body.avatarColor);
        issue(req,res,auth.getUser(user.id)); }
    catch(e) { console.error(e); res.status(500).json({error:'No se pudo crear la cuenta'}); }
});
router.post('/login',(req,res) =>
{
    const email=String(req.body?.email||'').trim().toLowerCase();
    const password=req.body?.password;
    if(typeof password!=='string' || password.length>256) return res.status(400).json({error:'Credenciales inválidas'});
    const key='login:'+req.ip+':'+email;
    if(!auth.rateLimit(key)) return res.status(429).json({error:'Demasiados intentos. Intenta más tarde'});
    const user=auth.byEmail(email);
    if(!user || !user.enabled || !auth.verifyPassword(password,user.password_hash)) return res.status(401).json({error:'Correo o contraseña incorrectos'});
    auth.clearAttempts(key);
    issue(req,res,user);
});
router.get('/me',(req,res) =>
{
    const user=current(req);
    if(!user) return res.status(401).json({error:'Sin sesión'});
    res.json({user:auth.publicUser(user)});
});
router.post('/logout',(req,res) =>
{
    const user=current(req);
    auth.revoke(token(req));
    res.clearCookie(COOKIE,{httpOnly:true,sameSite:'strict',secure:secure(req),path:'/'});
    if(user) req.app.get('io').in('user:'+user.id).disconnectSockets(true);
    res.json({ok:true});
});
router.patch('/profile',guard,(req,res) =>
{
    try
    {
        const user=auth.updateProfile(req.user.id,req.body?.name,req.body?.avatarColor);
        const io=req.app.get('io');
        io.in('user:'+user.id).emit('profileUpdated',auth.publicUser(user));
        res.json({user:auth.publicUser(user)});
    }
    catch(error) { res.status(400).json({error:error.message}); }
});
router.post('/change-password',guard,(req,res) =>
{
    if(!auth.rateLimit('password:'+req.user.id,5,3600000)) return res.status(429).json({error:'Demasiados intentos. Intenta más tarde'});
    try
    {
        auth.changePassword(req.user.id,req.body?.currentPassword,req.body?.newPassword);
        req.app.get('io').in('user:'+req.user.id).disconnectSockets(true);
        res.clearCookie(COOKIE,{httpOnly:true,sameSite:'strict',secure:secure(req),path:'/'});
        res.json({ok:true,message:'Contraseña actualizada. Inicia sesión nuevamente.'});
    }
    catch(error) { res.status(400).json({error:error.message}); }
});
router.get('/users',guard,admin,(req,res) => res.json({users:auth.listUsers()}));
router.patch('/users/:id',guard,admin,(req,res) =>
{
    try
    {
        const {role,enabled}=req.body||{};
        const user=auth.updateUser(req.params.id,role,enabled);
        if(!user) return res.status(404).json({error:'Usuario no encontrado'});
        req.app.get('io').in('user:'+user.id).disconnectSockets(true);
        res.json({user:auth.publicUser(user)});
    }
    catch(e) { res.status(400).json({error:e.message}); }
});
module.exports={router,current,token};
