/**
 * Socket.IO Signaling Handler
 * Manages all WebRTC signaling events between clients and the SFU server
 * 
 * Flow:
 *  1. Client connects → joinRoom
 *  2. createWebRtcTransport (send + recv)
 *  3. connectTransport
 *  4. produce (send media)
 *  5. consume (receive others' media)
 *  6. Disconnect → cleanup
 */

const {
  getOrCreateRoom,
  getRoom,
  cleanupRoom,
  createWebRtcTransport,
  Peer,
} = require('../mediasoup/roomManager');
const config = require('../config/mediasoup');
const { v4: uuidv4 } = require('uuid');

// Track socketId → { roomId, peerId }
const socketMap = new Map();

module.exports = function registerSocketHandlers(io) {

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // ── Join Room ────────────────────────────────────────────────────────────
    socket.on('joinRoom', async ({ roomId, peerId, peerName }, callback) => {
      try {
        // Sanitize inputs
        const sanitizedRoomId = String(roomId).trim().slice(0, 50);
        const sanitizedName = String(peerName || 'Anonymous').trim().slice(0, 30);
        const finalPeerId = peerId || uuidv4();

        const room = await getOrCreateRoom(sanitizedRoomId);
        const peer = new Peer(finalPeerId, socket.id, sanitizedName);

        room.addPeer(peer);
        socket.join(sanitizedRoomId);
        socketMap.set(socket.id, { roomId: sanitizedRoomId, peerId: finalPeerId });

        console.log(`[Room:${sanitizedRoomId}] Peer joined: ${sanitizedName} (${finalPeerId})`);

        // Notify others in the room
        socket.to(sanitizedRoomId).emit('peerJoined', peer.toJSON());

        // Return router RTP capabilities + existing producers + ICE servers
        callback({
          success: true,
          rtpCapabilities: room.router.rtpCapabilities,
          existingProducers: room.getState(),
          iceServers: config.iceServers,
          peerId: finalPeerId,
          peers: [...room.peers.values()]
            .filter(p => p.id !== finalPeerId)
            .map(p => p.toJSON()),
        });

      } catch (err) {
        console.error('[joinRoom] Error:', err);
        callback({ success: false, error: err.message });
      }
    });

    // ── Create WebRTC Transport ───────────────────────────────────────────────
    socket.on('createWebRtcTransport', async ({ roomId, peerId, direction }, callback) => {
      try {
        const room = getRoom(roomId);
        if (!room) throw new Error(`Room not found: ${roomId}`);

        const peer = room.peers.get(peerId);
        if (!peer) throw new Error(`Peer not found: ${peerId}`);

        const transport = await createWebRtcTransport(room.router);
        peer.addTransport(transport);

        console.log(`[Transport] Created ${direction} transport for peer ${peerId}`);

        // Handle DTLS state changes
        transport.on('dtlsstatechange', (dtlsState) => {
          if (dtlsState === 'closed') {
            console.log(`[Transport] DTLS closed for ${peerId}`);
            transport.close();
          }
        });

        transport.on('close', () => {
          console.log(`[Transport] Transport closed for peer ${peerId}`);
        });

        callback({
          success: true,
          params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
          },
        });

      } catch (err) {
        console.error('[createWebRtcTransport] Error:', err);
        callback({ success: false, error: err.message });
      }
    });

    // ── Connect Transport ─────────────────────────────────────────────────────
    socket.on('connectTransport', async ({ roomId, peerId, transportId, dtlsParameters }, callback) => {
      try {
        const room = getRoom(roomId);
        if (!room) throw new Error(`Room not found: ${roomId}`);

        const peer = room.peers.get(peerId);
        if (!peer) throw new Error(`Peer not found: ${peerId}`);

        const transport = peer.getTransport(transportId);
        if (!transport) throw new Error(`Transport not found: ${transportId}`);

        await transport.connect({ dtlsParameters });

        console.log(`[Transport] Connected transport ${transportId} for peer ${peerId}`);
        callback({ success: true });

      } catch (err) {
        console.error('[connectTransport] Error:', err);
        callback({ success: false, error: err.message });
      }
    });

    // ── Produce (send media) ──────────────────────────────────────────────────
    socket.on('produce', async ({ roomId, peerId, transportId, kind, rtpParameters, appData }, callback) => {
      try {
        const room = getRoom(roomId);
        if (!room) throw new Error(`Room not found: ${roomId}`);

        const peer = room.peers.get(peerId);
        if (!peer) throw new Error(`Peer not found: ${peerId}`);

        const transport = peer.getTransport(transportId);
        if (!transport) throw new Error(`Transport not found: ${transportId}`);

        const producer = await transport.produce({ kind, rtpParameters, appData });
        peer.addProducer(producer);

        console.log(`[Producer] ${kind} producer created for peer ${peerId}: ${producer.id}`);

        // Handle producer events
        producer.on('transportclose', () => {
          console.log(`[Producer] Transport closed for producer ${producer.id}`);
          peer.removeProducer(producer.id);
        });

        producer.on('score', (score) => {
          // Optionally relay score to the producer's socket for diagnostics
        });

        // Notify all other peers about the new producer
        socket.to(roomId).emit('newProducer', {
          producerId: producer.id,
          peerId,
          peerName: peer.name,
          kind,
        });

        callback({ success: true, producerId: producer.id });

      } catch (err) {
        console.error('[produce] Error:', err);
        callback({ success: false, error: err.message });
      }
    });

    // ── Consume (receive media) ───────────────────────────────────────────────
    socket.on('consume', async ({ roomId, peerId, transportId, producerId, rtpCapabilities }, callback) => {
      try {
        const room = getRoom(roomId);
        if (!room) throw new Error(`Room not found: ${roomId}`);

        // Check if consumer can consume this producer
        if (!room.router.canConsume({ producerId, rtpCapabilities })) {
          throw new Error(`Cannot consume producer ${producerId} (incompatible RTP capabilities)`);
        }

        const peer = room.peers.get(peerId);
        if (!peer) throw new Error(`Peer not found: ${peerId}`);

        const transport = peer.getTransport(transportId);
        if (!transport) throw new Error(`Transport not found: ${transportId}`);

        const consumer = await transport.consume({
          producerId,
          rtpCapabilities,
          paused: true, // Start paused, resume after client-side setup
        });

        peer.addConsumer(consumer);

        console.log(`[Consumer] Created consumer ${consumer.id} for peer ${peerId} → producer ${producerId}`);

        // Handle consumer events
        consumer.on('transportclose', () => {
          console.log(`[Consumer] Transport closed for consumer ${consumer.id}`);
          peer.removeConsumer(consumer.id);
        });

        consumer.on('producerclose', () => {
          console.log(`[Consumer] Producer closed for consumer ${consumer.id}`);
          peer.removeConsumer(consumer.id);
          socket.emit('producerClosed', { consumerId: consumer.id, producerId });
        });

        consumer.on('producerpause', () => {
          socket.emit('consumerPaused', { consumerId: consumer.id });
        });

        consumer.on('producerresume', () => {
          socket.emit('consumerResumed', { consumerId: consumer.id });
        });

        callback({
          success: true,
          params: {
            consumerId: consumer.id,
            producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
            type: consumer.type,
            producerPaused: consumer.producerPaused,
          },
        });

      } catch (err) {
        console.error('[consume] Error:', err);
        callback({ success: false, error: err.message });
      }
    });

    // ── Resume Consumer ───────────────────────────────────────────────────────
    socket.on('resumeConsumer', async ({ roomId, peerId, consumerId }, callback) => {
      try {
        const room = getRoom(roomId);
        if (!room) throw new Error(`Room not found: ${roomId}`);

        const peer = room.peers.get(peerId);
        if (!peer) throw new Error(`Peer not found: ${peerId}`);

        const consumer = peer.consumers.get(consumerId);
        if (!consumer) throw new Error(`Consumer not found: ${consumerId}`);

        await consumer.resume();
        callback({ success: true });

      } catch (err) {
        console.error('[resumeConsumer] Error:', err);
        callback({ success: false, error: err.message });
      }
    });

    // ── Pause/Resume Producer ─────────────────────────────────────────────────
    socket.on('pauseProducer', async ({ roomId, peerId, producerId }, callback) => {
      try {
        const peer = getRoom(roomId)?.peers.get(peerId);
        const producer = peer?.producers.get(producerId);
        if (!producer) throw new Error('Producer not found');

        await producer.pause();

        // Update peer state
        if (producer.kind === 'audio') peer.isAudioMuted = true;
        if (producer.kind === 'video') peer.isVideoOff = true;

        // Notify others
        socket.to(roomId).emit('peerUpdated', {
          peerId,
          isAudioMuted: peer.isAudioMuted,
          isVideoOff: peer.isVideoOff,
        });

        callback({ success: true });
      } catch (err) {
        callback({ success: false, error: err.message });
      }
    });

    socket.on('resumeProducer', async ({ roomId, peerId, producerId }, callback) => {
      try {
        const peer = getRoom(roomId)?.peers.get(peerId);
        const producer = peer?.producers.get(producerId);
        if (!producer) throw new Error('Producer not found');

        await producer.resume();

        if (producer.kind === 'audio') peer.isAudioMuted = false;
        if (producer.kind === 'video') peer.isVideoOff = false;

        socket.to(roomId).emit('peerUpdated', {
          peerId,
          isAudioMuted: peer.isAudioMuted,
          isVideoOff: peer.isVideoOff,
        });

        callback({ success: true });
      } catch (err) {
        callback({ success: false, error: err.message });
      }
    });

    // ── Chat Messages ─────────────────────────────────────────────────────────
    socket.on('chatMessage', ({ roomId, peerId, peerName, message, timestamp }) => {
      // Broadcast to all in room including sender
      io.to(roomId).emit('chatMessage', {
        id: uuidv4(),
        peerId,
        peerName,
        message: String(message).slice(0, 1000), // Limit message length
        timestamp: timestamp || Date.now(),
      });
    });

    // ── Active Speaker Detection ──────────────────────────────────────────────
    socket.on('speakingState', ({ roomId, peerId, isSpeaking }) => {
      const room = getRoom(roomId);
      if (!room) return;

      const peer = room.peers.get(peerId);
      if (!peer) return;

      peer.isSpeaking = isSpeaking;
      socket.to(roomId).emit('speakingState', { peerId, isSpeaking });
    });

    // ── Get Router RTP Capabilities ───────────────────────────────────────────
    socket.on('getRouterRtpCapabilities', ({ roomId }, callback) => {
      const room = getRoom(roomId);
      if (!room) return callback({ success: false, error: 'Room not found' });
      callback({ success: true, rtpCapabilities: room.router.rtpCapabilities });
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);

      const meta = socketMap.get(socket.id);
      if (!meta) return;

      const { roomId, peerId } = meta;
      socketMap.delete(socket.id);

      const room = getRoom(roomId);
      if (!room) return;

      const peer = room.peers.get(peerId);
      if (peer) {
        peer.close(); // Close all transports
        room.removePeer(peerId);
        // Notify others
        io.to(roomId).emit('peerLeft', { peerId, peerName: peer.name });
        console.log(`[Room:${roomId}] Peer left: ${peer.name} (${peerId})`);
      }

      cleanupRoom(roomId);
    });

    // ── Leave Room (explicit) ─────────────────────────────────────────────────
    socket.on('leaveRoom', ({ roomId, peerId }) => {
      const room = getRoom(roomId);
      if (!room) return;

      const peer = room.peers.get(peerId);
      if (peer) {
        peer.close();
        room.removePeer(peerId);
        socket.leave(roomId);
        io.to(roomId).emit('peerLeft', { peerId, peerName: peer.name });
      }

      socketMap.delete(socket.id);
      cleanupRoom(roomId);
    });
  });
};
