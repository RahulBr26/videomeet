# 📹 VideoMeet — Scalable Video Conferencing

A production-ready, full-stack video conferencing system built with **mediasoup SFU**, **WebRTC**, **Socket.IO**, **React.js**, and **React Native**. Supports 10–50+ participants per room.

---

## Architecture Overview

```
                        ┌─────────────────────────────────┐
                        │         mediasoup SFU            │
                        │                                  │
  Client A ──Produce──▶ │  Router ──Consume──▶ Client B   │
  Client B ──Produce──▶ │  Router ──Consume──▶ Client A   │
  Client C ──Produce──▶ │  Router ──Consume──▶ Client A,B │
                        └─────────────────────────────────┘
                                    ▲
                              Socket.IO (signaling)
                                    ▲
                           Express.js REST API
```

**SFU (Selective Forwarding Unit):** Each client sends **one** stream to the server. The server forwards it to all others — no full mesh, scales efficiently.

---

## Folder Structure

```
videomeet/
├── backend/
│   ├── server.js              # Express + Socket.IO entrypoint
│   ├── config/
│   │   └── mediasoup.js       # Codec, transport, ICE config
│   ├── mediasoup/
│   │   └── roomManager.js     # Room, Peer, Worker management
│   ├── socket/
│   │   └── socketHandler.js   # All signaling events
│   ├── middleware/
│   │   └── auth.js            # JWT auth middleware
│   └── .env.example
│
├── frontend/
│   ├── web/                   # React.js (browser)
│   │   └── src/
│   │       ├── App.jsx
│   │       ├── contexts/      # SocketContext
│   │       ├── hooks/         # useMediasoup (core WebRTC logic)
│   │       ├── components/    # VideoGrid, VideoTile, Controls, Chat
│   │       └── styles/        # CSS modules
│   │
│   └── mobile/                # React Native (iOS + Android)
│       └── src/
│           ├── screens/       # HomeScreen, RoomScreen
│           └── hooks/         # useMediasoupMobile
│
└── README.md
```

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 18.0 | Required for mediasoup |
| npm / yarn | latest | |
| Python 3 | ≥ 3.8 | mediasoup native build |
| C++ build tools | — | `build-essential` on Linux, Xcode CLT on Mac |

### Install build tools

**macOS:**
```bash
xcode-select --install
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y build-essential python3
```

**Windows:**
```bash
npm install -g windows-build-tools   # Run as Administrator
```

---

## Quick Start (Local Development)

### 1. Clone and configure backend

```bash
cd videomeet/backend
cp .env.example .env

# Edit .env:
# MEDIASOUP_ANNOUNCED_IP=127.0.0.1   # For local dev
# FRONTEND_URL=http://localhost:3000
```

### 2. Install backend dependencies

```bash
cd videomeet/backend
npm install
# mediasoup compiles native bindings — takes 1–3 minutes
```

### 3. Start the backend

```bash
npm run dev
# ✅ Server running on http://localhost:5000
```

### 4. Start the web frontend

```bash
cd videomeet/frontend/web
npm install
npm start
# ✅ App running on http://localhost:3000
```

### 5. Test locally

1. Open `http://localhost:3000` in two browser tabs
2. Enter your name → **New meeting** in Tab 1
3. Copy the room link → paste in Tab 2 → **Join**
4. Both tabs should see each other's video ✅

---

## Mobile Setup (React Native)

```bash
cd videomeet/frontend/mobile
npm install
```

### Update server URL

In `src/hooks/useMediasoupMobile.js`, change:
```js
const SERVER_URL = 'http://YOUR_LOCAL_IP:5000';
// e.g., 'http://192.168.1.42:5000'
```

Find your local IP:
- macOS/Linux: `ifconfig | grep inet`
- Windows: `ipconfig | findstr IPv4`

### Run on iOS

```bash
npm run ios
# Requires macOS + Xcode
```

### Run on Android

```bash
npm run android
# Requires Android Studio + connected device/emulator
```

---

## Environment Variables

### Backend `.env`

```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB (optional — for meeting history)
MONGODB_URI=mongodb://localhost:27017/videomeet

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=7d

# mediasoup — CRITICAL for production
MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_ANNOUNCED_IP=YOUR_PUBLIC_IP   # ← Change this!

# TURN server (optional, improves connectivity behind NAT)
TURN_SERVER_URL=turn:your-turn-server.com:3478
TURN_USERNAME=user
TURN_PASSWORD=password

# CORS
FRONTEND_URL=http://localhost:3000
```

### Web frontend `.env`

```env
REACT_APP_SERVER_URL=http://localhost:5000
```

---

## Production Deployment

### Option A: VPS (DigitalOcean / Linode / Hetzner)

```bash
# 1. Provision Ubuntu 22.04 server (≥2 CPU cores recommended)

# 2. Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential python3

# 3. Clone and install
git clone <your-repo> videomeet
cd videomeet/backend && npm install

# 4. Configure .env
MEDIASOUP_ANNOUNCED_IP=<your-server-public-ip>
FRONTEND_URL=https://yourdomain.com

# 5. Start with PM2
npm install -g pm2
pm2 start server.js --name videomeet-server
pm2 save && pm2 startup

# 6. Build and serve frontend
cd ../frontend/web
npm install && npm run build
# Serve with nginx or vercel
```

### Option B: Docker

```dockerfile
# backend/Dockerfile
FROM node:18-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 5000 10000-10999/udp
CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "5000:5000"
      - "10000-10999:10000-10999/udp"  # RTC ports — critical!
    environment:
      - MEDIASOUP_ANNOUNCED_IP=${PUBLIC_IP}
      - FRONTEND_URL=${FRONTEND_URL}
    restart: unless-stopped

  mongodb:
    image: mongo:7
    volumes:
      - mongo_data:/data/db
    restart: unless-stopped

volumes:
  mongo_data:
```

### Option C: Fly.io

```bash
cd backend
fly launch
fly scale vm dedicated-cpu-2x
fly secrets set MEDIASOUP_ANNOUNCED_IP=$(fly ips list --json | jq -r '.[0].Address')
fly deploy
```

**⚠️ Important for production:**
- Open UDP ports `10000–10999` in your firewall
- Set `MEDIASOUP_ANNOUNCED_IP` to your **public IP** (not 127.0.0.1)
- HTTPS is required for camera/mic access (`getUserMedia`)

---

## TURN Server (For Production NAT Traversal)

Without TURN, users behind strict NAT/firewalls can't connect. Options:

### Self-hosted (Coturn)

```bash
sudo apt-get install coturn
sudo nano /etc/turnserver.conf
```

```conf
listening-port=3478
tls-listening-port=5349
fingerprint
lt-cred-mech
realm=yourdomain.com
user=videomeet:yourpassword
total-quota=100
stale-nonce
cert=/path/to/cert.pem
pkey=/path/to/privkey.pem
```

### Cloud TURN (Metered.ca / Twilio TURN)

```env
TURN_SERVER_URL=turn:your.turn.server.com:3478
TURN_USERNAME=your_username
TURN_PASSWORD=your_credential
```

---

## Signaling Protocol Reference

All events go through Socket.IO. Responses use callbacks.

### Client → Server

| Event | Payload | Response |
|-------|---------|----------|
| `joinRoom` | `{ roomId, peerId, peerName }` | `{ rtpCapabilities, existingProducers, peers, iceServers }` |
| `createWebRtcTransport` | `{ roomId, peerId, direction }` | `{ params: { id, iceParameters, iceCandidates, dtlsParameters } }` |
| `connectTransport` | `{ roomId, peerId, transportId, dtlsParameters }` | `{ success }` |
| `produce` | `{ roomId, peerId, transportId, kind, rtpParameters }` | `{ producerId }` |
| `consume` | `{ roomId, peerId, transportId, producerId, rtpCapabilities }` | `{ params }` |
| `resumeConsumer` | `{ roomId, peerId, consumerId }` | `{ success }` |
| `pauseProducer` | `{ roomId, peerId, producerId }` | `{ success }` |
| `resumeProducer` | `{ roomId, peerId, producerId }` | `{ success }` |
| `chatMessage` | `{ roomId, peerId, peerName, message }` | — |
| `speakingState` | `{ roomId, peerId, isSpeaking }` | — |
| `leaveRoom` | `{ roomId, peerId }` | — |

### Server → Client (broadcasts)

| Event | Payload |
|-------|---------|
| `peerJoined` | `{ id, name }` |
| `peerLeft` | `{ peerId, peerName }` |
| `newProducer` | `{ producerId, peerId, peerName, kind }` |
| `producerClosed` | `{ consumerId, producerId }` |
| `peerUpdated` | `{ peerId, isAudioMuted, isVideoOff }` |
| `speakingState` | `{ peerId, isSpeaking }` |
| `chatMessage` | `{ id, peerId, peerName, message, timestamp }` |

---

## Scalability Notes

### Single Server Capacity

- **10–50 participants** per room (1 server, 4 CPU cores)
- mediasoup uses **one worker per CPU core**
- Each worker can handle ~20–30 streams comfortably

### Multi-Server Scaling

For 100+ users per room:

1. **Redis pub/sub** — sync socket events across servers
2. **Multiple mediasoup routers** — pipe between routers across workers
3. **Load balancer** — route rooms to least-loaded servers

```js
// Scale-out pattern (reference)
// Use Redis adapter for Socket.IO
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));
```

### Bandwidth Estimates

| Participants | Downstream per user | Server total |
|---|---|---|
| 10 | ~2.5 Mbps | ~25 Mbps |
| 25 | ~6 Mbps | ~150 Mbps |
| 50 | ~6 Mbps | ~300 Mbps |

Simulcast (built in) helps — clients receive lower-quality streams when bandwidth is limited.

---

## Troubleshooting

### "Cannot access camera/microphone"
- Use **HTTPS** in production (`getUserMedia` requires secure context)
- Check browser permissions — click the lock icon → Site settings

### "ICE connection failed" / peers can't connect
- Set `MEDIASOUP_ANNOUNCED_IP` to your **public IP** (not `127.0.0.1`)
- Open **UDP ports 10000–10999** in your firewall/security group
- Add a **TURN server** for users behind strict NAT

### "mediasoup Worker died"
- Ensure `python3`, `make`, `g++` are installed
- Check for port conflicts on 10000–10999
- Review server logs: `pm2 logs videomeet-server`

### Black video / no audio from remote peers
- Check `consumeProducer` is being called after `newProducer` event
- Ensure `resumeConsumer` is called after consuming
- Verify `rtpCapabilities` are loaded before creating consumers

### Mobile: "Connection refused"
- Replace `localhost` with your machine's **local IP** (`192.168.x.x`)
- Ensure both devices are on the **same network** for local testing

---

## License

MIT — free to use in commercial and open-source projects.
