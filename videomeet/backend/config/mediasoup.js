/**
 * mediasoup Configuration
 * Handles all mediasoup-specific settings including codecs, transports, and ICE servers
 */

module.exports = {
  // Number of mediasoup workers (usually = number of CPU cores)
  numWorkers: Object.keys(require('os').cpus()).length,

  // Worker settings
  worker: {
    rtcMinPort: 10000,
    rtcMaxPort: 10999,
    logLevel: 'warn',
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
  },

  // Router settings - defines supported media codecs
  router: {
    mediaCodecs: [
      // Audio codecs
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        parameters: {
          'useinbandfec': 1,       // Forward error correction
          'usedtx': 1,             // Discontinuous transmission (silence suppression)
          'maxplaybackrate': 48000,
          'stereo': 1,
        },
      },
      // Video codecs
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video',
        mimeType: 'video/VP9',
        clockRate: 90000,
        parameters: {
          'profile-id': 2,
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video',
        mimeType: 'video/h264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '4d0032',
          'level-asymmetry-allowed': 1,
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video',
        mimeType: 'video/h264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '42e01f',
          'level-asymmetry-allowed': 1,
          'x-google-start-bitrate': 1000,
        },
      },
    ],
  },

  // WebRTC transport settings
  webRtcTransport: {
    listenIps: [
      {
        ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1',
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    enableSctp: false,
    initialAvailableOutgoingBitrate: 1_000_000,  // 1 Mbps initial
    maxSctpMessageSize: 262144,
    maxIncomingBitrate: 1_500_000,               // 1.5 Mbps max incoming
  },

  // ICE servers for WebRTC peer connections
  iceServers: [
    // Google STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // Add TURN server if configured
    ...(process.env.TURN_SERVER_URL
      ? [
          {
            urls: process.env.TURN_SERVER_URL,
            username: process.env.TURN_USERNAME,
            credential: process.env.TURN_PASSWORD,
          },
        ]
      : []),
  ],
};
