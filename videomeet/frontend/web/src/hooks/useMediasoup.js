/**
 * useMediasoup Hook
 * Core WebRTC + mediasoup-client integration
 * 
 * Manages:
 *  - Local media (camera + mic)
 *  - mediasoup device, transports, producers, consumers
 *  - Remote participant streams
 *  - Mute/video toggle
 *  - Active speaker detection (via audio volume analysis)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as mediasoupClient from 'mediasoup-client';
import { v4 as uuidv4 } from 'uuid';

const SPEAKING_THRESHOLD = -50; // dB threshold for "speaking" detection
const SPEAKING_INTERVAL = 300;  // ms between volume checks

export function useMediasoup(socket, roomId, peerName) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [peerId] = useState(() => uuidv4());
  const [peers, setPeers] = useState(new Map());       // peerId → { name, audioStream, videoStream, ... }
  const [localStream, setLocalStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState(null);
  const [connectionState, setConnectionState] = useState('idle'); // idle | joining | joined | error

  // ── Refs ───────────────────────────────────────────────────────────────────
  const deviceRef           = useRef(null);  // mediasoup Device
  const sendTransportRef    = useRef(null);  // WebRTC send transport
  const recvTransportRef    = useRef(null);  // WebRTC receive transport
  const audioProducerRef    = useRef(null);
  const videoProducerRef    = useRef(null);
  const consumersRef        = useRef(new Map()); // consumerId → consumer
  const localStreamRef      = useRef(null);
  const rtpCapabilitiesRef  = useRef(null);
  const speakingIntervalRef = useRef(null);
  const audioContextRef     = useRef(null);
  const analyserRef         = useRef(null);
  const currentRoomId       = useRef(roomId);
  const currentPeerId       = useRef(peerId);

  currentRoomId.current = roomId;
  currentPeerId.current = peerId;

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Emit a socket event and return the callback result as a Promise
   */
  const emitAsync = useCallback((event, data) => {
    return new Promise((resolve, reject) => {
      if (!socket) return reject(new Error('Socket not connected'));
      socket.emit(event, data, (response) => {
        if (response?.success === false) {
          reject(new Error(response.error || 'Unknown error'));
        } else {
          resolve(response);
        }
      });
    });
  }, [socket]);

  /**
   * Update a peer's state immutably
   */
  const updatePeer = useCallback((pid, updater) => {
    setPeers(prev => {
      const next = new Map(prev);
      const existing = next.get(pid) || {};
      next.set(pid, typeof updater === 'function' ? updater(existing) : { ...existing, ...updater });
      return next;
    });
  }, []);

  // ── Active Speaker Detection ───────────────────────────────────────────────

  function startSpeakingDetection(stream) {
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 512;
      source.connect(analyserRef.current);

      const dataArray = new Float32Array(analyserRef.current.frequencyBinCount);
      let speakingState = false;

      speakingIntervalRef.current = setInterval(() => {
        analyserRef.current.getFloatFrequencyData(dataArray);
        const maxVolume = Math.max(...dataArray);
        const nowSpeaking = maxVolume > SPEAKING_THRESHOLD;

        if (nowSpeaking !== speakingState) {
          speakingState = nowSpeaking;
          setIsSpeaking(nowSpeaking);
          socket?.emit('speakingState', {
            roomId: currentRoomId.current,
            peerId: currentPeerId.current,
            isSpeaking: nowSpeaking,
          });
        }
      }, SPEAKING_INTERVAL);

    } catch (err) {
      console.warn('[Speaking] Audio analysis not available:', err.message);
    }
  }

  function stopSpeakingDetection() {
    if (speakingIntervalRef.current) clearInterval(speakingIntervalRef.current);
    audioContextRef.current?.close();
  }

  // ── Get Local Media ────────────────────────────────────────────────────────

  async function getLocalMedia() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30 },
          facingMode: 'user',
        },
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      startSpeakingDetection(stream);
      return stream;
    } catch (err) {
      console.error('[Media] getUserMedia error:', err);
      throw new Error('Camera/microphone access denied. Please allow permissions and try again.');
    }
  }

  // ── mediasoup Device Setup ─────────────────────────────────────────────────

  async function loadDevice(rtpCapabilities) {
    const device = new mediasoupClient.Device();
    await device.load({ routerRtpCapabilities: rtpCapabilities });
    deviceRef.current = device;
    return device;
  }

  // ── Create Transports ──────────────────────────────────────────────────────

  async function createSendTransport(device) {
    const { params } = await emitAsync('createWebRtcTransport', {
      roomId, peerId, direction: 'send',
    });

    const transport = device.createSendTransport({
      ...params,
      iceServers: [], // Provided by server in joinRoom
    });

    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await emitAsync('connectTransport', { roomId, peerId, transportId: transport.id, dtlsParameters });
        callback();
      } catch (err) { errback(err); }
    });

    transport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
      try {
        const { producerId } = await emitAsync('produce', {
          roomId, peerId, transportId: transport.id, kind, rtpParameters, appData,
        });
        callback({ id: producerId });
      } catch (err) { errback(err); }
    });

    transport.on('connectionstatechange', (state) => {
      console.log(`[Send Transport] State: ${state}`);
    });

    sendTransportRef.current = transport;
    return transport;
  }

  async function createRecvTransport(device) {
    const { params } = await emitAsync('createWebRtcTransport', {
      roomId, peerId, direction: 'recv',
    });

    const transport = device.createRecvTransport(params);

    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await emitAsync('connectTransport', { roomId, peerId, transportId: transport.id, dtlsParameters });
        callback();
      } catch (err) { errback(err); }
    });

    transport.on('connectionstatechange', (state) => {
      console.log(`[Recv Transport] State: ${state}`);
    });

    recvTransportRef.current = transport;
    return transport;
  }

  // ── Produce Media ──────────────────────────────────────────────────────────

  async function produceMedia(transport, stream) {
    const audioTrack = stream.getAudioTracks()[0];
    const videoTrack = stream.getVideoTracks()[0];

    if (audioTrack) {
      audioProducerRef.current = await transport.produce({
        track: audioTrack,
        codecOptions: { opusStereo: true, opusDtx: true },
        appData: { kind: 'audio' },
      });

      audioProducerRef.current.on('transportclose', () => {
        audioProducerRef.current = null;
      });
    }

    if (videoTrack) {
      videoProducerRef.current = await transport.produce({
        track: videoTrack,
        encodings: [
          // Simulcast layers for scalability
          { maxBitrate: 100_000, scaleResolutionDownBy: 4 },  // Low  (QVGA)
          { maxBitrate: 300_000, scaleResolutionDownBy: 2 },  // Mid  (VGA)
          { maxBitrate: 900_000, scaleResolutionDownBy: 1 },  // High (720p)
        ],
        codecOptions: { videoGoogleStartBitrate: 1000 },
        appData: { kind: 'video' },
      });

      videoProducerRef.current.on('transportclose', () => {
        videoProducerRef.current = null;
      });
    }
  }

  // ── Consume a Remote Producer ──────────────────────────────────────────────

  const consumeProducer = useCallback(async ({ producerId, remotePeerId, peerName, kind }) => {
    if (!recvTransportRef.current || !deviceRef.current) return;
    if (!deviceRef.current.rtpCapabilities) return;

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

      // Build a MediaStream from the track
      const stream = new MediaStream([consumer.track]);

      // Add stream to the peer entry
      updatePeer(remotePeerId, (existing) => ({
        ...existing,
        name: peerName || existing.name || 'Participant',
        [`${kind}Stream`]: stream,
        [`${kind}ConsumerId`]: consumer.id,
      }));

      // Resume the consumer (it starts paused)
      await emitAsync('resumeConsumer', { roomId, peerId, consumerId: consumer.id });

      consumer.on('transportclose', () => {
        consumersRef.current.delete(consumer.id);
      });

      consumer.track.onended = () => {
        consumersRef.current.delete(consumer.id);
      };

    } catch (err) {
      console.error('[Consume] Error:', err);
    }
  }, [emitAsync, roomId, peerId, updatePeer]);

  // ── Join Room ──────────────────────────────────────────────────────────────

  const joinRoom = useCallback(async () => {
    if (!socket || !roomId || !peerName) return;
    if (connectionState !== 'idle') return;

    setConnectionState('joining');
    setError(null);

    try {
      // 1. Get local media
      const stream = await getLocalMedia();

      // 2. Join room — get RTP capabilities + existing producers
      const joinResult = await emitAsync('joinRoom', { roomId, peerId, peerName });
      const { rtpCapabilities, existingProducers, peers: existingPeers } = joinResult;

      rtpCapabilitiesRef.current = rtpCapabilities;

      // 3. Populate existing peers
      existingPeers?.forEach(p => {
        setPeers(prev => {
          const next = new Map(prev);
          next.set(p.id, { name: p.name, isAudioMuted: p.isAudioMuted, isVideoOff: p.isVideoOff });
          return next;
        });
      });

      // 4. Load mediasoup device
      const device = await loadDevice(rtpCapabilities);

      // 5. Create transports
      const sendTransport = await createSendTransport(device);
      await createRecvTransport(device);

      // 6. Produce local tracks
      await produceMedia(sendTransport, stream);

      // 7. Consume existing producers
      for (const producer of existingProducers || []) {
        await consumeProducer(producer);
      }

      setIsJoined(true);
      setConnectionState('joined');

    } catch (err) {
      console.error('[joinRoom] Error:', err);
      setError(err.message);
      setConnectionState('error');
    }
  }, [socket, roomId, peerName, peerId, connectionState, emitAsync, consumeProducer]);

  // ── Toggle Audio ───────────────────────────────────────────────────────────

  const toggleAudio = useCallback(async () => {
    const producer = audioProducerRef.current;
    if (!producer) return;

    if (isAudioMuted) {
      await producer.resume();
      socket?.emit('resumeProducer', { roomId, peerId, producerId: producer.id });
      setIsAudioMuted(false);
    } else {
      await producer.pause();
      socket?.emit('pauseProducer', { roomId, peerId, producerId: producer.id });
      setIsAudioMuted(true);
    }
  }, [isAudioMuted, roomId, peerId, socket]);

  // ── Toggle Video ───────────────────────────────────────────────────────────

  const toggleVideo = useCallback(async () => {
    const producer = videoProducerRef.current;
    if (!producer) return;

    const track = localStreamRef.current?.getVideoTracks()[0];

    if (isVideoOff) {
      if (track) track.enabled = true;
      await producer.resume();
      socket?.emit('resumeProducer', { roomId, peerId, producerId: producer.id });
      setIsVideoOff(false);
    } else {
      if (track) track.enabled = false;
      await producer.pause();
      socket?.emit('pauseProducer', { roomId, peerId, producerId: producer.id });
      setIsVideoOff(true);
    }
  }, [isVideoOff, roomId, peerId, socket]);

  // ── Leave Room ─────────────────────────────────────────────────────────────

  const leaveRoom = useCallback(() => {
    // Stop local tracks
    localStreamRef.current?.getTracks().forEach(t => t.stop());

    // Close transports
    sendTransportRef.current?.close();
    recvTransportRef.current?.close();

    // Stop speaking detection
    stopSpeakingDetection();

    // Notify server
    socket?.emit('leaveRoom', { roomId, peerId });

    // Reset state
    setLocalStream(null);
    setPeers(new Map());
    setIsJoined(false);
    setConnectionState('idle');
  }, [socket, roomId, peerId]);

  // ── Socket Event Listeners ─────────────────────────────────────────────────

  useEffect(() => {
    if (!socket) return;

    const handlers = {
      // New peer joined the room
      peerJoined: ({ id, name }) => {
        updatePeer(id, { name });
      },

      // Peer left the room
      peerLeft: ({ peerId: pid }) => {
        setPeers(prev => {
          const next = new Map(prev);
          next.delete(pid);
          return next;
        });
      },

      // A new producer became available
      newProducer: async ({ producerId, peerId: remotePeerId, peerName, kind }) => {
        await consumeProducer({ producerId, remotePeerId, peerName, kind });
      },

      // A producer was closed (peer muted/turned off)
      producerClosed: ({ consumerId, producerId }) => {
        const consumer = consumersRef.current.get(consumerId);
        if (consumer) {
          consumer.close();
          consumersRef.current.delete(consumerId);
        }
      },

      // Peer's media state changed
      peerUpdated: ({ peerId: pid, isAudioMuted: am, isVideoOff: vo }) => {
        updatePeer(pid, { isAudioMuted: am, isVideoOff: vo });
      },

      // Speaking state
      speakingState: ({ peerId: pid, isSpeaking: speaking }) => {
        updatePeer(pid, { isSpeaking: speaking });
      },
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };
  }, [socket, consumeProducer, updatePeer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveRoom();
    };
  }, []);

  return {
    peerId,
    peers,
    localStream,
    isAudioMuted,
    isVideoOff,
    isSpeaking,
    isJoined,
    connectionState,
    error,
    joinRoom,
    leaveRoom,
    toggleAudio,
    toggleVideo,
  };
}
