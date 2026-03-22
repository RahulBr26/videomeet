/**
 * useMediasoup Hook (React Native)
 * WebRTC + mediasoup-client for mobile using react-native-webrtc
 *
 * Key difference from web: uses react-native-webrtc's
 * mediaDevices.getUserMedia instead of browser API
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { mediaDevices } from 'react-native-webrtc';
import * as mediasoupClient from 'mediasoup-client';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

const SERVER_URL = 'http://localhost:5000'; // Change to your server IP/domain

export function useMediasoupMobile(roomId, peerName) {
  const [peerId] = useState(() => uuidv4());
  const [peers, setPeers] = useState(new Map());
  const [localStream, setLocalStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [connectionState, setConnectionState] = useState('idle');
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);

  const socketRef        = useRef(null);
  const deviceRef        = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const audioProducerRef = useRef(null);
  const videoProducerRef = useRef(null);
  const consumersRef     = useRef(new Map());
  const localStreamRef   = useRef(null);

  // ── Socket helpers ──────────────────────────────────────────────────────────

  const emitAsync = useCallback((event, data) => {
    return new Promise((resolve, reject) => {
      const sock = socketRef.current;
      if (!sock) return reject(new Error('Not connected'));
      sock.emit(event, data, (res) => {
        if (res?.success === false) reject(new Error(res.error || 'Error'));
        else resolve(res);
      });
    });
  }, []);

  const updatePeer = useCallback((pid, updater) => {
    setPeers(prev => {
      const next = new Map(prev);
      const existing = next.get(pid) || {};
      next.set(pid, typeof updater === 'function' ? updater(existing) : { ...existing, ...updater });
      return next;
    });
  }, []);

  // ── Consume a remote producer ───────────────────────────────────────────────

  const consumeProducer = useCallback(async ({ producerId, remotePeerId, peerName: rName, kind }) => {
    if (!recvTransportRef.current || !deviceRef.current) return;

    try {
      const { params } = await emitAsync('consume', {
        roomId,
        peerId,
        transportId: recvTransportRef.current.id,
        producerId,
        rtpCapabilities: deviceRef.current.rtpCapabilities,
      });

      const consumer = await recvTransportRef.current.consume({
        id: params.consumerId,
        producerId: params.producerId,
        kind: params.kind,
        rtpParameters: params.rtpParameters,
      });

      consumersRef.current.set(consumer.id, consumer);

      const stream = new MediaStream([consumer.track]);

      updatePeer(remotePeerId, (existing) => ({
        ...existing,
        name: rName || existing.name || 'Participant',
        [`${kind}Stream`]: stream,
      }));

      await emitAsync('resumeConsumer', { roomId, peerId, consumerId: consumer.id });

    } catch (err) {
      console.error('[Mobile Consume] Error:', err);
    }
  }, [emitAsync, roomId, peerId, updatePeer]);

  // ── Join room ───────────────────────────────────────────────────────────────

  const joinRoom = useCallback(async () => {
    setConnectionState('joining');
    setError(null);

    try {
      // 1. Connect socket
      const socket = io(SERVER_URL, {
        transports: ['websocket'],
        reconnection: true,
      });
      socketRef.current = socket;

      await new Promise((resolve, reject) => {
        socket.on('connect', resolve);
        socket.on('connect_error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 8000);
      });

      // 2. Get local media
      const stream = await mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode: 'user',
        },
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      // 3. Join room
      const joinResult = await emitAsync('joinRoom', { roomId, peerId, peerName });
      const { rtpCapabilities, existingProducers, peers: existingPeers } = joinResult;

      existingPeers?.forEach(p => {
        setPeers(prev => {
          const next = new Map(prev);
          next.set(p.id, { name: p.name });
          return next;
        });
      });

      // 4. Load device
      const device = new mediasoupClient.Device();
      await device.load({ routerRtpCapabilities: rtpCapabilities });
      deviceRef.current = device;

      // 5. Send transport
      const { params: sendParams } = await emitAsync('createWebRtcTransport', {
        roomId, peerId, direction: 'send',
      });

      const sendTransport = device.createSendTransport(sendParams);

      sendTransport.on('connect', async ({ dtlsParameters }, cb, eb) => {
        try {
          await emitAsync('connectTransport', {
            roomId, peerId, transportId: sendTransport.id, dtlsParameters,
          });
          cb();
        } catch (err) { eb(err); }
      });

      sendTransport.on('produce', async ({ kind, rtpParameters, appData }, cb, eb) => {
        try {
          const { producerId } = await emitAsync('produce', {
            roomId, peerId, transportId: sendTransport.id, kind, rtpParameters, appData,
          });
          cb({ id: producerId });
        } catch (err) { eb(err); }
      });

      sendTransportRef.current = sendTransport;

      // 6. Recv transport
      const { params: recvParams } = await emitAsync('createWebRtcTransport', {
        roomId, peerId, direction: 'recv',
      });

      const recvTransport = device.createRecvTransport(recvParams);

      recvTransport.on('connect', async ({ dtlsParameters }, cb, eb) => {
        try {
          await emitAsync('connectTransport', {
            roomId, peerId, transportId: recvTransport.id, dtlsParameters,
          });
          cb();
        } catch (err) { eb(err); }
      });

      recvTransportRef.current = recvTransport;

      // 7. Produce media
      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];

      if (audioTrack) {
        audioProducerRef.current = await sendTransport.produce({ track: audioTrack });
      }
      if (videoTrack) {
        videoProducerRef.current = await sendTransport.produce({ track: videoTrack });
      }

      // 8. Consume existing producers
      for (const prod of existingProducers || []) {
        await consumeProducer(prod);
      }

      // 9. Register socket event handlers
      socket.on('peerJoined', ({ id, name }) => updatePeer(id, { name }));

      socket.on('peerLeft', ({ peerId: pid }) => {
        setPeers(prev => {
          const next = new Map(prev);
          next.delete(pid);
          return next;
        });
      });

      socket.on('newProducer', async ({ producerId, peerId: remotePeerId, peerName: rName, kind }) => {
        await consumeProducer({ producerId, remotePeerId, peerName: rName, kind });
      });

      socket.on('peerUpdated', ({ peerId: pid, isAudioMuted: am, isVideoOff: vo }) => {
        updatePeer(pid, { isAudioMuted: am, isVideoOff: vo });
      });

      socket.on('chatMessage', (msg) => {
        setMessages(prev => [...prev, msg]);
      });

      setConnectionState('joined');

    } catch (err) {
      console.error('[Mobile joinRoom] Error:', err);
      setError(err.message);
      setConnectionState('error');
    }
  }, [roomId, peerId, peerName, emitAsync, consumeProducer, updatePeer]);

  // ── Toggle audio ────────────────────────────────────────────────────────────

  const toggleAudio = useCallback(async () => {
    const producer = audioProducerRef.current;
    if (!producer) return;

    if (isAudioMuted) {
      await producer.resume();
      setIsAudioMuted(false);
    } else {
      await producer.pause();
      setIsAudioMuted(true);
    }
  }, [isAudioMuted]);

  // ── Toggle video ────────────────────────────────────────────────────────────

  const toggleVideo = useCallback(async () => {
    const producer = videoProducerRef.current;
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!producer || !track) return;

    if (isVideoOff) {
      track.enabled = true;
      await producer.resume();
      setIsVideoOff(false);
    } else {
      track.enabled = false;
      await producer.pause();
      setIsVideoOff(true);
    }
  }, [isVideoOff]);

  // ── Switch camera ───────────────────────────────────────────────────────────

  const switchCamera = useCallback(async () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;

    try {
      // react-native-webrtc specific
      await track._switchCamera?.();
      setIsFrontCamera(v => !v);
    } catch (err) {
      console.warn('[Camera] Switch failed:', err);
    }
  }, []);

  // ── Send chat message ───────────────────────────────────────────────────────

  const sendMessage = useCallback((message) => {
    socketRef.current?.emit('chatMessage', {
      roomId,
      peerId,
      peerName,
      message,
      timestamp: Date.now(),
    });
  }, [roomId, peerId, peerName]);

  // ── Leave room ──────────────────────────────────────────────────────────────

  const leaveRoom = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    sendTransportRef.current?.close();
    recvTransportRef.current?.close();
    socketRef.current?.emit('leaveRoom', { roomId, peerId });
    socketRef.current?.disconnect();

    setLocalStream(null);
    setPeers(new Map());
    setConnectionState('idle');
  }, [roomId, peerId]);

  useEffect(() => {
    return () => { leaveRoom(); };
  }, []);

  return {
    peerId,
    peers,
    localStream,
    isAudioMuted,
    isVideoOff,
    isFrontCamera,
    connectionState,
    error,
    messages,
    joinRoom,
    leaveRoom,
    toggleAudio,
    toggleVideo,
    switchCamera,
    sendMessage,
  };
}
