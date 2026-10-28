'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'metaverso-votes-'));
process.env.DATA_DIR=dir;
const auth=require('../auth');
test('un voto por cuenta se sustituye al cambiar de sala y se separa por rol',()=>
{
    const listener=auth.createUser('Oyente Uno','oyente@example.test','password1234');
    const judge=auth.createUser('Juez Uno','juez@example.test','password1234');
    auth.updateUser(judge.id,'juez',true);
    auth.castVote(listener.id,1);
    auth.castVote(judge.id,1);
    let state=auth.voteSummary(listener.id);
    assert.equal(state.rooms[0].total,2);
    assert.equal(state.rooms[0].oyentes,1);
    assert.equal(state.rooms[0].jueces,1);
    auth.castVote(listener.id,3);
    state=auth.voteSummary(listener.id);
    assert.equal(state.myVote,3);
    assert.equal(state.rooms[0].total,1);
    assert.equal(state.rooms[2].total,1);
    assert.equal(auth.db.prepare('SELECT COUNT(*) n FROM votes').get().n,2);
    assert.throws(()=>auth.castVote(listener.id,7));
});
test.after(()=>{auth.db.close();fs.rmSync(dir,{recursive:true,force:true});});
