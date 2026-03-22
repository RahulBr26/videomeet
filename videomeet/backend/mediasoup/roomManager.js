/**
 * Room Manager
 * Manages mediasoup Rooms, Peers, Transports, Producers, and Consumers
 * Implements SFU (Selective Forwarding Unit) architecture
 */

const mediasoup = require('mediasoup');
const config = require('../config/mediasoup');
const { v4: uuidv4 } = require('uuid');

// ─── Worker Pool ───────────────────────────────────────────────────────────────
let workers = [];
let workerIndex = 0;

/**
 * Create a pool of mediasoup workers (one per CPU core)
 */
async function createWorkers() {
  const { numWorkers, worker: workerConfig } = config;

  console.log(`[mediasoup] Creating ${numWorkers} workers...`);

  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker(workerConfig);

    worker.on('died', () => {
      console.error(`[mediasoup] Worker ${worker.pid} died — restarting in 2s`);
      setTimeout(() => createWorker(i), 2000);
    });

    workers.push(worker);
    console.log(`[mediasoup] Worker ${i + 1}/${numWorkers} created (pid: ${worker.pid})`);
  }
}

/**
 * Round-robin worker selection for load balancing
 */
function getNextWorker() {
  const worker = workers[workerIndex];
  workerIndex = (workerIndex + 1) % workers.length;
  return worker;
}

// ─── Room Map ─────────────────────────────────────────────────────────────────
const rooms = new Map(); // roomId → Room

/**
 * Get or create a Room
 * @param {string} roomId
 * @returns {Room}
 */
async function getOrCreateRoom(roomId) {
  if (rooms.has(roomId)) {
    return rooms.get(roomId);
  }

  const worker = getNextWorker();
  const router = await worker.createRouter({ mediaCodecs: config.router.mediaCodecs });

  const room = new Room(roomId, router);
  rooms.set(roomId, room);

  console.log(`[Room] Created room: ${roomId}`);
  return room;
}

/**
 * Get an existing room
 */
function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

/**
 * Delete a room if empty
 */
function cleanupRoom(roomId) {
  const room = rooms.get(roomId);
  if (room && room.peers.size === 0) {
    room.router.close();
    rooms.delete(roomId);
    console.log(`[Room] Cleaned up empty room: ${roomId}`);
  }
}

// ─── Room Class ───────────────────────────────────────────────────────────────
class Room {
  constructor(roomId, router) {
    this.id = roomId;
    this.router = router;
    this.peers = new Map();   // peerId → Peer
    this.createdAt = Date.now();
  }

  /**
   * Add a peer to the room
   */
  addPeer(peer) {
    this.peers.set(peer.id, peer);
  }

  /**
   * Remove a peer from the room
   */
  removePeer(peerId) {
    this.peers.delete(peerId);
  }

  /**
   * Get all peers except the requesting one
   */
  getOtherPeers(peerId) {
    return [...this.peers.values()].filter(p => p.id !== peerId);
  }

  /**
   * Get room state for a new participant (existing producers)
   */
  getState() {
    const producerList = [];
    this.peers.forEach(peer => {
      peer.producers.forEach(producer => {
        producerList.push({
          producerId: producer.id,
          peerId: peer.id,
          peerName: peer.name,
          kind: producer.kind,
        });
      });
    });
    return producerList;
  }

  toJSON() {
    return {
      id: this.id,
      peerCount: this.peers.size,
      createdAt: this.createdAt,
    };
  }
}

// ─── Peer Class ───────────────────────────────────────────────────────────────
class Peer {
  constructor(peerId, socketId, name) {
    this.id = peerId;
    this.socketId = socketId;
    this.name = name;
    this.transports = new Map();   // transportId → Transport
    this.producers = new Map();    // producerId → Producer
    this.consumers = new Map();    // consumerId → Consumer
    this.joinedAt = Date.now();
    this.isAudioMuted = false;
    this.isVideoOff = false;
    this.isSpeaking = false;
  }

  addTransport(transport) {
    this.transports.set(transport.id, transport);
  }

  getTransport(transportId) {
    return this.transports.get(transportId);
  }

  addProducer(producer) {
    this.producers.set(producer.id, producer);
  }

  removeProducer(producerId) {
    this.producers.delete(producerId);
  }

  addConsumer(consumer) {
    this.consumers.set(consumer.id, consumer);
  }

  removeConsumer(consumerId) {
    this.consumers.delete(consumerId);
  }

  /**
   * Close all transports (and their producers/consumers) on disconnect
   */
  close() {
    this.transports.forEach(transport => transport.close());
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      isAudioMuted: this.isAudioMuted,
      isVideoOff: this.isVideoOff,
      isSpeaking: this.isSpeaking,
    };
  }
}

// ─── Transport Helpers ────────────────────────────────────────────────────────

/**
 * Create a WebRTC transport for send or receive
 */
async function createWebRtcTransport(router) {
  const transport = await router.createWebRtcTransport(config.webRtcTransport);

  // Set bitrate limits
  if (config.webRtcTransport.maxIncomingBitrate) {
    try {
      await transport.setMaxIncomingBitrate(config.webRtcTransport.maxIncomingBitrate);
    } catch (err) {
      console.warn('[Transport] Could not set max incoming bitrate:', err.message);
    }
  }

  return transport;
}

module.exports = {
  createWorkers,
  getOrCreateRoom,
  getRoom,
  cleanupRoom,
  createWebRtcTransport,
  Room,
  Peer,
};
