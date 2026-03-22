/**
 * VideoMeet Server
 * Express + Socket.IO + mediasoup SFU
 * 
 * Architecture:
 *   Client → Socket.IO (signaling) → mediasoup Router → SFU → All participants
 *   Client ←─────────────────────── WebRTC (media) ────────────────────────────
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

const { createWorkers } = require('./mediasoup/roomManager');
const registerSocketHandlers = require('./socket/socketHandler');
const { generateToken, requireAuth } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:3000', 'http://localhost:19006'],
  credentials: true,
}));
app.use(express.json());

// ─── Socket.IO ───────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: [FRONTEND_URL, 'http://localhost:3000', 'http://localhost:19006'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingInterval: 10000,
  pingTimeout: 5000,
});

// ─── REST API Routes ──────────────────────────────────────────────────────────

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Generate a new room ID
 */
app.get('/api/rooms/new', (req, res) => {
  // Generate a human-readable room ID (3 words)
  const adjectives = ['swift', 'bright', 'calm', 'deep', 'fair', 'glad', 'kind', 'lush', 'pure', 'warm'];
  const nouns = ['river', 'stone', 'cloud', 'flame', 'grove', 'light', 'ocean', 'star', 'wave', 'wind'];
  const id = `${adjectives[Math.floor(Math.random() * adjectives.length)]}-${
    nouns[Math.floor(Math.random() * nouns.length)]}-${
    Math.floor(1000 + Math.random() * 9000)}`;

  res.json({ roomId: id });
});

/**
 * Auth: register / login (simplified for demo)
 */
app.post('/api/auth/guest', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const userId = uuidv4();
  const token = generateToken({ userId, name, role: 'guest' });

  res.json({ token, userId, name });
});

/**
 * Get room info (participants, etc.)
 */
app.get('/api/rooms/:roomId', (req, res) => {
  const { getRoom } = require('./mediasoup/roomManager');
  const room = getRoom(req.params.roomId);

  if (!room) {
    return res.json({ exists: false, roomId: req.params.roomId });
  }

  res.json({
    exists: true,
    roomId: room.id,
    participantCount: room.peers.size,
    createdAt: room.createdAt,
  });
});

/**
 * Server stats
 */
app.get('/api/stats', (req, res) => {
  const { rooms } = require('./mediasoup/roomManager');
  // rooms is a Map, not exported directly — this is illustrative
  res.json({
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
  });
});

// ─── MongoDB (Optional) ───────────────────────────────────────────────────────
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('[MongoDB] Connected'))
    .catch(err => console.error('[MongoDB] Connection error:', err.message));
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
async function start() {
  try {
    // Create mediasoup worker pool
    await createWorkers();

    // Register Socket.IO handlers
    registerSocketHandlers(io);

    // Start listening
    server.listen(PORT, () => {
      console.log(`\n🚀 VideoMeet server running on port ${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/health`);
      console.log(`   CORS:   ${FRONTEND_URL}\n`);
    });

  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received — shutting down gracefully');
  server.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});

start();
