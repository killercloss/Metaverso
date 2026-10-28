const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const auth = require('./auth');
const authRoutes = require('./auth-routes');

const app = express();
const server = http.createServer(app);

const io = new Server(server);
app.set('io', io);
app.disable('x-powered-by');
app.use(express.json({limit:'12kb'}));
app.use('/api/auth', authRoutes.router);
app.get('/api/votes', (req,res) =>
{
    const user=authRoutes.current(req);
    if(!user) return res.status(401).json({error:'Debes iniciar sesión'});
    res.json(auth.voteSummary(user.id));
});
app.post('/api/votes', (req,res) =>
{
    const user=authRoutes.current(req);
    if(!user) return res.status(401).json({error:'Debes iniciar sesión'});
    const origin=req.get('origin');
    if(origin)
    {
        try
        {
            const url=new URL(origin);
            if(url.host!==req.get('host') || url.protocol!==(req.secure?'https:':'http:')) return res.status(403).json({error:'Origen no autorizado'});
        }
        catch { return res.status(403).json({error:'Origen no autorizado'}); }
    }
    try
    {
        const result=auth.castVote(user.id,req.body?.room);
        io.emit('votesUpdated',auth.voteSummary());
        res.json(result);
    }
    catch(error) { res.status(400).json({error:error.message}); }
});

app.get('/perfil', (req,res) =>
{
    if(!authRoutes.current(req)) return res.redirect('/');
    res.sendFile(path.join(__dirname,'private','profile.html'));
});
app.get('/admin', (req,res) =>
{
    const user = authRoutes.current(req);
    if(!user || user.role !== 'administrador') return res.status(403).send('Acceso restringido');
    res.sendFile(path.join(__dirname,'private','admin.html'));
});
io.use((socket,next) =>
{
    const cookie=String(socket.handshake.headers.cookie||'');
    const match=cookie.match(/(?:^|;\s*)metaverso_session=([a-f0-9]{64})(?:;|$)/);
    const user=auth.sessionUser(match?.[1]);
    if(!user) return next(new Error('Autenticación requerida'));
    socket.data.userId=user.id;
    next();
});

app.use(
    express.static(
        path.join(__dirname, 'public')
    )
);


/* =========================================================
   JUGADORES
========================================================= */

const players = {};

/* Estado compartido de la presentación */
const mediaState =
{
    pdfPage: 1,
    video:
    {
        playing: false,
        time: 0,
        updatedAt: Date.now()
    }
};

function currentVideoState()
{
    const video = mediaState.video;
    return {
        playing: video.playing,
        time: Math.max(0, video.time +
            (video.playing ? (Date.now() - video.updatedAt) / 1000 : 0)),
        updatedAt: Date.now()
    };
}




/* =========================================================
   SOCKET.IO
========================================================= */

io.on('connection', socket => {
    socket.on('refreshProfile', () =>
    {
        const updated=auth.getUser(socket.data.userId);
        const player=players[socket.id];
        if(!updated || !player) return;
        player.name=updated.name;
        player.color=updated.avatar_color || '#3da5ff';
        io.emit('playerLeft',socket.id);
        io.emit('playerJoined',player);
    });

    // El chat se retransmite a todos los participantes conectados.
    let lastChatAt=0;
    socket.on('chatMessage',data =>
    {
        const now=Date.now();
        const message=typeof data?.text==='string' ? data.text.trim() : '';
        if(!message || message.length>300 || now-lastChatAt<350) return;
        const sender=auth.getUser(socket.data.userId);
        if(!sender || !sender.enabled) return;
        lastChatAt=now;
        io.emit('chatMessage',{name:sender.name,text:message,userId:sender.id});
    });

    console.log('Usuario conectado:', socket.id);
    const account = auth.getUser(socket.data.userId);
    if(!account || !account.enabled) return socket.disconnect(true);
    socket.join('user:'+account.id);

    // Se envía también a quienes ingresan después.
    socket.emit('mediaState',
    {
        pdfPage: mediaState.pdfPage,
        video: currentVideoState()
    });

    socket.on('pdfChangePage', page =>
    {
        if(!Number.isSafeInteger(page) || page < 1 || page > 10000)
        {
            return;
        }

        mediaState.pdfPage = page;
        io.emit('pdfPageChanged', { page });
    });

    socket.on('videoControl', data =>
    {
        const action = data?.action;
        if(!['play', 'pause', 'stop', 'seek'].includes(action))
        {
            return;
        }

        const current = currentVideoState();
        let time = current.time;

        if(action === 'seek')
        {
            if(!Number.isFinite(data.time) || data.time < 0)
            {
                return;
            }
            time = data.time;
        }
        else if(action === 'stop')
        {
            time = 0;
        }

        mediaState.video =
        {
            playing: action === 'play' ? true :
                     action === 'pause' || action === 'stop' ? false :
                     mediaState.video.playing,
            time,
            updatedAt: Date.now()
        };

        io.emit('videoState', currentVideoState());
    });



    /* -----------------------------------------------------
       CREAR JUGADOR
    ----------------------------------------------------- */

    players[socket.id] = {

        id: socket.id,

        name: account.name,
        color: account.avatar_color || '#3da5ff',
        userId: account.id,
        role: account.role,

        x: 0,
        y: 1.7,
        z: 5,

        ry: 0,

        micEnabled: false

    };


    /* -----------------------------------------------------
       INICIALIZACIÓN
    ----------------------------------------------------- */

    socket.emit(
        'init',
        {
            id: socket.id,
            players
        }
    );


    socket.broadcast.emit(
        'playerJoined',
        players[socket.id]
    );


    /* =====================================================
       NOMBRE
    ===================================================== */

    // El nombre proviene de la cuenta autenticada; el cliente no puede suplantarlo.

    /* =====================================================
       MOVIMIENTO
    ===================================================== */

    socket.on(
        'move',
        state => {

            const p =
                players[socket.id];

            if (!p)
                return;


            p.x =
                Number(state.x) || 0;

            p.y =
                Number(state.y) || 1.7;

            p.z =
                Number(state.z) || 0;

            p.ry =
                Number(state.ry) || 0;


            socket.broadcast.emit(
                'playerMoved',
                p
            );

        }
    );


    /* =====================================================
       ESTADO DEL MICRÓFONO

       Esto NO transmite audio.
       Solamente informa a los demás jugadores
       si este usuario tiene el micrófono activo.
    ===================================================== */

    socket.on(
        'micState',
        enabled => {

            const p =
                players[socket.id];

            if (!p)
                return;


            p.micEnabled =
                !!enabled;


            socket.broadcast.emit(
                'playerMicState',
                {
                    id: socket.id,
                    enabled: p.micEnabled
                }
            );

        }
    );


    /* =====================================================
       WEBRTC SIGNALING

       El servidor NO recibe el audio.

       Únicamente transporta:
       OFFER
       ANSWER
       ICE CANDIDATES
    ===================================================== */


    /* -----------------------------------------------------
       OFFER
    ----------------------------------------------------- */

    socket.on(
        'webrtc-offer',
        data => {

            if (
                !data ||
                !data.target
            )
                return;


            io.to(
                data.target
            ).emit(
                'webrtc-offer',
                {
                    from: socket.id,
                    offer: data.offer
                }
            );

        }
    );


    /* -----------------------------------------------------
       ANSWER
    ----------------------------------------------------- */

    socket.on(
        'webrtc-answer',
        data => {

            if (
                !data ||
                !data.target
            )
                return;


            io.to(
                data.target
            ).emit(
                'webrtc-answer',
                {
                    from: socket.id,
                    answer: data.answer
                }
            );

        }
    );


    /* -----------------------------------------------------
       ICE
    ----------------------------------------------------- */

    socket.on(
        'webrtc-ice',
        data => {

            if (
                !data ||
                !data.target
            )
                return;


            io.to(
                data.target
            ).emit(
                'webrtc-ice',
                {
                    from: socket.id,
                    candidate: data.candidate
                }
            );

        }
    );


    /* =====================================================
       DESCONEXIÓN
    ===================================================== */

    socket.on(
        'disconnect',
        () => {

            console.log(
                'Usuario desconectado:',
                socket.id
            );


            delete players[
                socket.id
            ];


            io.emit(
                'playerLeft',
                socket.id
            );

        }
    );

});


/* =========================================================
   SERVIDOR
========================================================= */

const PORT =
    process.env.PORT || 3000;


server.listen(
    PORT,
    () => {

        console.log(
            `Frame Lite: http://localhost:${PORT}`
        );

    }
);