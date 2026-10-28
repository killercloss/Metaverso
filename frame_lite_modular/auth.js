'use strict';
const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'metaverso.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'oyente', enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);`);
db.exec(`CREATE TABLE IF NOT EXISTS votes (
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id INTEGER NOT NULL CHECK(room_id BETWEEN 1 AND 6),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(event_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_votes_room ON votes(event_id,room_id);`);
const ACTIVE_EVENT = 'evento-principal';
function castVote(userId, roomId)
{
    if(!Number.isInteger(roomId) || roomId < 1 || roomId > 6) throw new Error('Sala inválida');
    const user = getUser(userId);
    if(!user || !user.enabled) throw new Error('Cuenta inactiva');
    db.prepare(`INSERT INTO votes(event_id,user_id,room_id,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(event_id,user_id) DO UPDATE SET room_id=excluded.room_id,updated_at=CURRENT_TIMESTAMP`).run(ACTIVE_EVENT,userId,roomId);
    return voteSummary(userId);
}
function voteSummary(userId)
{
    const rows = db.prepare(`SELECT v.room_id AS room, COUNT(*) AS total,
        SUM(CASE WHEN u.role='oyente' THEN 1 ELSE 0 END) AS oyentes,
        SUM(CASE WHEN u.role='juez' THEN 1 ELSE 0 END) AS jueces
        FROM votes v JOIN users u ON u.id=v.user_id
        WHERE v.event_id=? GROUP BY v.room_id`).all(ACTIVE_EVENT);
    const own = userId ? db.prepare('SELECT room_id FROM votes WHERE event_id=? AND user_id=?').get(ACTIVE_EVENT,userId) : null;
    return {eventId:ACTIVE_EVENT, myVote:own?.room_id || null, rooms:Array.from({length:6},(_,i)=>
    {
        const row=rows.find(r=>r.room===i+1);
        return {room:i+1,name:`Sala ${i+1}`,total:row?.total||0,oyentes:row?.oyentes||0,jueces:row?.jueces||0};
    })};
}
const columns = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
if(!columns.includes('avatar_color')) db.exec("ALTER TABLE users ADD COLUMN avatar_color TEXT NOT NULL DEFAULT '#3da5ff'");
const roles = ['oyente', 'ponente', 'auxiliar', 'juez', 'administrador'];
const publicUser = user => user && ({ id: user.id, name: user.name, email: user.email, role: user.role, enabled: !!user.enabled, createdAt: user.created_at, avatarColor: user.avatar_color || '#3da5ff' });
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const passHash = password => { const salt = crypto.randomBytes(16); return `scrypt:${salt.toString('hex')}:${crypto.scryptSync(password, salt, 64).toString('hex')}`; };
function verifyPassword(password, stored)
{
    const parts = String(stored).split(':');
    if(parts.length !== 3 || parts[0] !== 'scrypt') return false;
    const expected = Buffer.from(parts[2], 'hex');
    const actual = crypto.scryptSync(password, Buffer.from(parts[1], 'hex'), expected.length);
    return crypto.timingSafeEqual(actual, expected);
}
function createUser(name, email, password)
{
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO users(id,name,email,password_hash) VALUES(?,?,?,?)').run(id, name, email, passHash(password));
    return getUser(id);
}
function getUser(id) { return db.prepare('SELECT * FROM users WHERE id=?').get(id); }
function byEmail(email) { return db.prepare('SELECT * FROM users WHERE email=?').get(email); }
function createSession(id)
{
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hash(token), id, Date.now() + 7 * 86400000);
    return token;
}
function sessionUser(token)
{
    if(!token || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
    const user = db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.enabled=1').get(hash(token), Date.now());
    return user || null;
}
function revoke(token) { if(token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token)); }
function revokeUser(id) { db.prepare('DELETE FROM sessions WHERE user_id=?').run(id); }
function listUsers() { return db.prepare('SELECT id,name,email,role,enabled,created_at FROM users ORDER BY created_at DESC, email').all().map(publicUser); }
function countAdmins() { return db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='administrador' AND enabled=1").get().n; }
function updateUser(id, role, enabled)
{
    if(!roles.includes(role) || typeof enabled !== 'boolean') throw new Error('Datos inválidos');
    const target = getUser(id);
    if(!target) return null;
    if(target.role === 'administrador' && target.enabled && (role !== 'administrador' || !enabled) && countAdmins() <= 1) throw new Error('No puedes desactivar o degradar al último administrador');
    db.prepare('UPDATE users SET role=?,enabled=? WHERE id=?').run(role, Number(enabled), id);
    if(!enabled || target.role !== role) revokeUser(id);
    return getUser(id);
}
function updateProfile(id, name, color)
{
    if(typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 40) throw new Error('El nombre debe tener entre 2 y 40 caracteres');
    if(typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error('Color de avatar inválido');
    db.prepare('UPDATE users SET name=?, avatar_color=? WHERE id=?').run(name.trim(), color.toLowerCase(), id);
    return getUser(id);
}
function changePassword(id, currentPassword, nextPassword)
{
    const user=getUser(id);
    if(!user || typeof currentPassword !== 'string' || !verifyPassword(currentPassword,user.password_hash)) throw new Error('La contraseña actual es incorrecta');
    if(typeof nextPassword !== 'string' || nextPassword.length < 10 || Buffer.byteLength(nextPassword) > 256) throw new Error('La contraseña nueva debe tener al menos 10 caracteres');
    if(currentPassword === nextPassword) throw new Error('La nueva contraseña debe ser diferente');
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(passHash(nextPassword),id);
    revokeUser(id);
}
function rateLimit(key, limit=10, windowMs=15*60000)
{
    const now=Date.now();
    const item=db.prepare('SELECT count,reset_at FROM login_attempts WHERE key=?').get(key);
    if(!item || item.reset_at<now) { db.prepare('INSERT INTO login_attempts(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=1,reset_at=excluded.reset_at').run(key,now+windowMs); return true; }
    if(item.count>=limit) return false;
    db.prepare('UPDATE login_attempts SET count=count+1 WHERE key=?').run(key);
    return true;
}
function clearAttempts(key) { db.prepare('DELETE FROM login_attempts WHERE key=?').run(key); }
module.exports={db,castVote,voteSummary,roles,publicUser,createUser,getUser,byEmail,verifyPassword,createSession,sessionUser,revoke,revokeUser,listUsers,updateUser,updateProfile,changePassword,rateLimit,clearAttempts};
