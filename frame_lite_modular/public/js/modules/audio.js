import * as THREE from 'three';
import { RTC_CONFIG, VOICE_DISTANCE } from './config.js';

export function createVoiceSystem(options)
{
    const {
        socket,
        remotePlayers,
        camera,
        micButton,
        voiceModeSelect,
        voiceStatus,
        voiceMeterLevel,
        getMyId
    } = options;

    let localStream = null;
    let audioContext = null;
    let voiceMode = 'proximity';
    let analyser = null;
    let analyserData = null;
    let meterSource = null;

    const peers = new Map();
    const remoteAudio = new Map();
    const pendingIce = new Map();

    function log(...args)
    {
        console.log('[VOICE]', ...args);
    }

    async function ensureAudioContext()
    {
        if(!audioContext)
        {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        if(audioContext.state === 'suspended')
        {
            await audioContext.resume().catch(() => {});
        }
    }

    function status()
    {
        const track = localStream?.getAudioTracks()[0];
        const mic = track?.enabled ? 'Micrófono activo' : 'Micrófono silenciado';
        const connected = [...peers.values()].filter(
            peer => peer.connectionState === 'connected'
        ).length;

        voiceStatus.textContent =
            `${mic} | WebRTC: ${connected} | Audio remoto: ${remoteAudio.size}`;
    }

    function setupMeter()
    {
        if(!localStream || !audioContext)
        {
            return;
        }

        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.75;
        analyserData = new Uint8Array(analyser.fftSize);
        meterSource = audioContext.createMediaStreamSource(localStream);
        meterSource.connect(analyser);
    }

    function updateMeter()
    {
        const track = localStream?.getAudioTracks()[0];

        if(!analyser || !analyserData || !track?.enabled)
        {
            voiceMeterLevel.style.width = '0%';
            return;
        }

        analyser.getByteTimeDomainData(analyserData);
        let sum = 0;

        for(const value of analyserData)
        {
            const sample = (value - 128) / 128;
            sum += sample * sample;
        }

        voiceMeterLevel.style.width =
            `${Math.min(100, Math.sqrt(sum / analyserData.length) * 350)}%`;
    }

    function addLocalTrack(peer)
    {
        const track = localStream?.getAudioTracks()[0];

        if(!track)
        {
            return;
        }

        const sender = peer.getSenders().find(
            item => item.track?.kind === 'audio'
        );

        if(sender)
        {
            if(sender.track !== track)
            {
                sender.replaceTrack(track).catch(console.error);
            }
            return;
        }

        peer.addTrack(track, localStream);
    }

    async function negotiate(peerId, peer)
    {
        if(!peer || peer.signalingState !== 'stable' || peer.makingOffer)
        {
            return;
        }

        try
        {
            peer.makingOffer = true;
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            socket.emit('webrtc-offer',
            {
                target: peerId,
                offer: peer.localDescription
            });
            log('Oferta enviada a', peerId);
        }
        finally
        {
            peer.makingOffer = false;
        }
    }

    function createPeer(peerId, initiator = false)
    {
        const myId = getMyId();

        if(!peerId || peerId === myId)
        {
            return null;
        }

        if(peers.has(peerId))
        {
            const peer = peers.get(peerId);
            addLocalTrack(peer);

            if(initiator)
            {
                queueMicrotask(() => negotiate(peerId, peer));
            }

            return peer;
        }

        const peer = new RTCPeerConnection(RTC_CONFIG);
        peer.makingOffer = false;
        peer.ignoreOffer = false;
        peers.set(peerId, peer);
        addLocalTrack(peer);

        peer.ontrack = event =>
        {
            const stream = event.streams[0];
            if(stream)
            {
                setupRemoteAudio(peerId, stream);
            }
        };

        peer.onicecandidate = event =>
        {
            if(event.candidate)
            {
                socket.emit('webrtc-ice',
                {
                    target: peerId,
                    candidate: event.candidate
                });
            }
        };

        peer.onconnectionstatechange = () =>
        {
            log(peerId, peer.connectionState);
            status();

            if(['failed', 'closed'].includes(peer.connectionState))
            {
                closePeer(peerId);
            }
        };

        peer.onnegotiationneeded = () => negotiate(peerId, peer);

        if(initiator)
        {
            queueMicrotask(() => negotiate(peerId, peer));
        }

        return peer;
    }

    async function setupRemoteAudio(peerId, stream)
    {
        let entry = remoteAudio.get(peerId);

        if(!entry)
        {
            const audio = document.createElement('audio');
            audio.autoplay = true;
            audio.playsInline = true;
            audio.style.display = 'none';
            document.body.appendChild(audio);
            entry = { audio, stream };
            remoteAudio.set(peerId, entry);
        }

        entry.stream = stream;
        entry.audio.srcObject = stream;
        updateVolume(peerId);

        try
        {
            await entry.audio.play();
            log('Audio remoto reproduciendo:', peerId);
        }
        catch(error)
        {
            log('Autoplay pendiente:', peerId);
        }

        status();
    }

    function updateVolume(peerId)
    {
        const entry = remoteAudio.get(peerId);

        if(!entry)
        {
            return;
        }

        let volume = 1;

        if(voiceMode === 'proximity')
        {
            const player = remotePlayers.get(peerId);

            if(player)
            {
                const distance = camera.position.distanceTo(player.position);

                if(distance <= VOICE_DISTANCE.full)
                {
                    volume = 1;
                }
                else if(distance < VOICE_DISTANCE.maximum)
                {
                    volume =
                        1 -
                        (distance - VOICE_DISTANCE.full) /
                        (VOICE_DISTANCE.maximum - VOICE_DISTANCE.full);
                    volume *= volume;
                }
                else
                {
                    volume = 0;
                }
            }
        }

        entry.audio.volume = THREE.MathUtils.clamp(volume, 0, 1);
    }

    function updateVolumes()
    {
        remoteAudio.forEach((_, id) => updateVolume(id));
    }

    async function resume()
    {
        await ensureAudioContext();

        for(const entry of remoteAudio.values())
        {
            await entry.audio.play().catch(() => {});
        }
    }

    function closePeer(id)
    {
        const peer = peers.get(id);

        if(peer)
        {
            peer.close();
            peers.delete(id);
        }

        const entry = remoteAudio.get(id);

        if(entry)
        {
            entry.audio.pause();
            entry.audio.srcObject = null;
            entry.audio.remove();
            remoteAudio.delete(id);
        }

        pendingIce.delete(id);
        status();
    }

    async function toggleMicrophone()
    {
        if(!localStream)
        {
            await ensureAudioContext();

            localStream = await navigator.mediaDevices.getUserMedia(
            {
                audio:
                {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            });

            setupMeter();
            micButton.textContent = 'Desactivar';
            socket.emit('micState', true);

            for(const id of remotePlayers.keys())
            {
                createPeer(id, true);
            }

            status();
            return;
        }

        const track = localStream.getAudioTracks()[0];

        if(track)
        {
            track.enabled = !track.enabled;
            micButton.textContent = track.enabled ? 'Desactivar' : 'Activar';
            socket.emit('micState', track.enabled);

            if(track.enabled)
            {
                for(const id of remotePlayers.keys())
                {
                    createPeer(id, true);
                }
            }
        }

        status();
    }

    micButton.addEventListener('click', async event =>
    {
        event.stopPropagation();

        try
        {
            await toggleMicrophone();
        }
        catch(error)
        {
            console.error('[VOICE]', error);
            voiceStatus.textContent = 'No se pudo acceder al micrófono';
        }
    });

    voiceModeSelect.addEventListener('change', event =>
    {
        voiceMode = event.target.value;
        updateVolumes();
    });

    socket.on('webrtc-offer', async data =>
    {
        try
        {
            await ensureAudioContext();
            const peer = createPeer(data.from, false);

            if(!peer)
            {
                return;
            }

            const myId = getMyId();
            const collision = peer.makingOffer || peer.signalingState !== 'stable';
            const polite = String(myId || '') > String(data.from || '');

            if(collision && !polite)
            {
                peer.ignoreOffer = true;
                return;
            }

            peer.ignoreOffer = false;

            if(collision)
            {
                await peer.setLocalDescription({ type: 'rollback' });
            }

            await peer.setRemoteDescription(data.offer);
            addLocalTrack(peer);

            for(const candidate of pendingIce.get(data.from) || [])
            {
                await peer.addIceCandidate(candidate);
            }

            pendingIce.delete(data.from);

            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);

            socket.emit('webrtc-answer',
            {
                target: data.from,
                answer: peer.localDescription
            });
        }
        catch(error)
        {
            console.error('[VOICE] Oferta:', error);
        }
    });

    socket.on('webrtc-answer', async data =>
    {
        const peer = peers.get(data.from);

        if(!peer)
        {
            return;
        }

        try
        {
            await peer.setRemoteDescription(data.answer);

            for(const candidate of pendingIce.get(data.from) || [])
            {
                await peer.addIceCandidate(candidate);
            }

            pendingIce.delete(data.from);
        }
        catch(error)
        {
            console.error('[VOICE] Respuesta:', error);
        }
    });

    socket.on('webrtc-ice', async data =>
    {
        if(!data.candidate)
        {
            return;
        }

        const peer = peers.get(data.from);

        if(!peer?.remoteDescription?.type)
        {
            if(!pendingIce.has(data.from))
            {
                pendingIce.set(data.from, []);
            }

            pendingIce.get(data.from).push(data.candidate);
            return;
        }

        try
        {
            await peer.addIceCandidate(data.candidate);
        }
        catch(error)
        {
            if(!peer.ignoreOffer)
            {
                console.error('[VOICE] ICE:', error);
            }
        }
    });

    return {
        createPeer,
        closePeer,
        updateMeter,
        updateVolumes,
        resume,
        hasMicrophone()
        {
            return Boolean(localStream);
        }
    };
}
