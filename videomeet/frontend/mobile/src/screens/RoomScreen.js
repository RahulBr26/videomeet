/**
 * RoomScreen (Mobile)
 * Full-screen video conference with scrollable participant grid
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RTCView } from 'react-native-webrtc';
import { useMediasoupMobile } from '../hooks/useMediasoupMobile';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Video Tile ─────────────────────────────────────────────────────────────────
function VideoTile({ stream, name, isLocal, isAudioMuted, isVideoOff, isSpeaking, size = 'normal' }) {
  const tileW = size === 'large' ? SCREEN_WIDTH : (SCREEN_WIDTH - 24) / 2;
  const tileH = tileW * (9 / 16);

  const initials = (name || 'A')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <View
      style={[
        styles.tile,
        { width: tileW, height: tileH },
        isSpeaking && styles.tileSpeaking,
      ]}
    >
      {stream && !isVideoOff ? (
        <RTCView
          streamURL={stream.toURL()}
          style={styles.tileVideo}
          objectFit="cover"
          mirror={isLocal}
        />
      ) : (
        <View style={styles.tileAvatar}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
      )}

      {/* Name badge */}
      <View style={styles.tileOverlay}>
        <View style={styles.tileNameRow}>
          {isAudioMuted && <Text style={styles.mutedIcon}>🔇</Text>}
          <Text style={styles.tileName} numberOfLines={1}>
            {name || 'Participant'}
          </Text>
          {isLocal && <Text style={styles.youBadge}>You</Text>}
        </View>
      </View>

      {/* Speaking bars */}
      {isSpeaking && !isAudioMuted && (
        <View style={styles.speakingBars}>
          {[6, 12, 8].map((h, i) => (
            <View key={i} style={[styles.speakingBar, { height: h }]} />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Chat Panel ─────────────────────────────────────────────────────────────────
function ChatPanel({ messages, peerId, peerName, onSend, onClose }) {
  const [draft, setDraft] = useState('');

  const formatTime = (ts) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.chatPanel}
    >
      {/* Header */}
      <View style={styles.chatHeader}>
        <Text style={styles.chatTitle}>Messages</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.chatClose}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        style={styles.chatMessages}
        contentContainerStyle={{ padding: 12, gap: 10 }}
      >
        {messages.length === 0 && (
          <Text style={styles.chatEmpty}>No messages yet</Text>
        )}
        {messages.map((msg) => {
          const isMe = msg.peerId === peerId;
          return (
            <View
              key={msg.id}
              style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}
            >
              {!isMe && (
                <Text style={styles.msgSender}>{msg.peerName}</Text>
              )}
              <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
                <Text style={[styles.msgText, isMe && styles.msgTextMe]}>
                  {msg.message}
                </Text>
              </View>
              <Text style={styles.msgTime}>{formatTime(msg.timestamp)}</Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Input */}
      <View style={styles.chatInputRow}>
        <TextInput
          style={styles.chatInput}
          placeholder="Send a message…"
          placeholderTextColor="#555d73"
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.chatSendBtn, draft.trim() && styles.chatSendBtnActive]}
          onPress={() => {
            if (draft.trim()) {
              onSend(draft.trim());
              setDraft('');
            }
          }}
          disabled={!draft.trim()}
        >
          <Text style={styles.chatSendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Room Screen ────────────────────────────────────────────────────────────────
export default function RoomScreen({ route, navigation }) {
  const { roomId, userName } = route.params;
  const [isChatOpen, setIsChatOpen] = useState(false);

  const {
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
  } = useMediasoupMobile(roomId, userName);

  useEffect(() => {
    joinRoom();
  }, []);

  const handleLeave = useCallback(() => {
    leaveRoom();
    navigation.goBack();
  }, [leaveRoom, navigation]);

  if (connectionState === 'joining') {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#4f8ef7" />
        <Text style={styles.loadingText}>Joining {roomId}…</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorScreen}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.errorBtn} onPress={joinRoom}>
          <Text style={styles.errorBtnText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleLeave}>
          <Text style={styles.errorBack}>← Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Build participant list
  const participants = [
    {
      id: peerId,
      name: userName,
      stream: localStream,
      isLocal: true,
      isAudioMuted,
      isVideoOff,
    },
    ...[...peers.entries()].map(([id, peer]) => {
      const tracks = [];
      if (peer.audioStream) tracks.push(...peer.audioStream.getTracks());
      if (peer.videoStream) tracks.push(...peer.videoStream.getTracks());
      const combinedStream = tracks.length > 0
        ? (() => { const s = new MediaStream(); tracks.forEach(t => s.addTrack(t)); return s; })()
        : null;

      return {
        id,
        name: peer.name,
        stream: combinedStream,
        isLocal: false,
        isAudioMuted: peer.isAudioMuted,
        isVideoOff: peer.isVideoOff,
        isSpeaking: peer.isSpeaking,
      };
    }),
  ];

  const tileSize = participants.length <= 2 ? 'large' : 'normal';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>VideoMeet</Text>
          <Text style={styles.headerRoom}>{roomId}</Text>
        </View>
        <Text style={styles.headerCount}>
          {participants.length} participant{participants.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Video grid */}
      <ScrollView
        style={styles.grid}
        contentContainerStyle={styles.gridContent}
      >
        <View style={styles.tilesWrap}>
          {participants.map(p => (
            <VideoTile
              key={p.id}
              stream={p.stream}
              name={p.name}
              isLocal={p.isLocal}
              isAudioMuted={p.isAudioMuted}
              isVideoOff={p.isVideoOff}
              isSpeaking={p.isSpeaking}
              size={tileSize}
            />
          ))}
        </View>
      </ScrollView>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Mic */}
        <TouchableOpacity
          style={[styles.ctrlBtn, isAudioMuted && styles.ctrlBtnDanger]}
          onPress={toggleAudio}
        >
          <Text style={styles.ctrlIcon}>{isAudioMuted ? '🔇' : '🎙️'}</Text>
          <Text style={styles.ctrlLabel}>{isAudioMuted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>

        {/* Leave */}
        <TouchableOpacity style={styles.ctrlBtnLeave} onPress={handleLeave}>
          <Text style={styles.ctrlIcon}>📵</Text>
          <Text style={[styles.ctrlLabel, { color: '#fff' }]}>Leave</Text>
        </TouchableOpacity>

        {/* Camera */}
        <TouchableOpacity
          style={[styles.ctrlBtn, isVideoOff && styles.ctrlBtnDanger]}
          onPress={toggleVideo}
        >
          <Text style={styles.ctrlIcon}>{isVideoOff ? '📷' : '🎥'}</Text>
          <Text style={styles.ctrlLabel}>{isVideoOff ? 'Start' : 'Stop'}</Text>
        </TouchableOpacity>

        {/* Flip camera */}
        <TouchableOpacity style={styles.ctrlBtn} onPress={switchCamera}>
          <Text style={styles.ctrlIcon}>🔄</Text>
          <Text style={styles.ctrlLabel}>Flip</Text>
        </TouchableOpacity>

        {/* Chat */}
        <TouchableOpacity
          style={[styles.ctrlBtn, isChatOpen && styles.ctrlBtnActive]}
          onPress={() => setIsChatOpen(v => !v)}
        >
          <Text style={styles.ctrlIcon}>💬</Text>
          <Text style={styles.ctrlLabel}>Chat</Text>
        </TouchableOpacity>
      </View>

      {/* Chat overlay */}
      {isChatOpen && (
        <ChatPanel
          messages={messages}
          peerId={peerId}
          peerName={userName}
          onSend={sendMessage}
          onClose={() => setIsChatOpen(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1117' },

  // Loading / Error
  loadingScreen: {
    flex: 1, backgroundColor: '#0f1117',
    alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  loadingText: { color: '#8b92a8', fontSize: 15 },
  errorScreen: {
    flex: 1, backgroundColor: '#0f1117',
    alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
  },
  errorIcon: { fontSize: 48 },
  errorText: { color: '#8b92a8', textAlign: 'center', fontSize: 14 },
  errorBtn: {
    backgroundColor: '#4f8ef7', borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  errorBtnText: { color: '#fff', fontWeight: '600' },
  errorBack: { color: '#4f8ef7', marginTop: 8 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#f0f2f8' },
  headerRoom: { fontSize: 11, color: '#8b92a8', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  headerCount: { fontSize: 12, color: '#8b92a8' },

  // Grid
  grid: { flex: 1 },
  gridContent: { flexGrow: 1 },
  tilesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    padding: 4,
  },

  // Tile
  tile: {
    backgroundColor: '#181c27',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileSpeaking: { borderColor: '#34c97a' },
  tileVideo: { ...StyleSheet.absoluteFillObject },
  tileAvatar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e2333',
  },
  avatarCircle: {
    width: 56, height: 56,
    borderRadius: 28,
    backgroundColor: '#4f8ef7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },

  tileOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 8, paddingBottom: 6, paddingTop: 20,
    background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
  },
  tileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tileName: { color: '#fff', fontSize: 11, fontWeight: '600', flex: 1 },
  mutedIcon: { fontSize: 10 },
  youBadge: {
    fontSize: 9, color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3,
  },

  speakingBars: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'flex-end', gap: 2,
  },
  speakingBar: {
    width: 3, backgroundColor: '#34c97a', borderRadius: 99,
  },

  // Controls
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(15,17,23,0.95)',
  },
  ctrlBtn: {
    alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 12, borderRadius: 12, minWidth: 60,
  },
  ctrlBtnDanger: { backgroundColor: 'rgba(240,79,95,0.8)' },
  ctrlBtnActive: { backgroundColor: 'rgba(79,142,247,0.2)', borderWidth: 1, borderColor: '#4f8ef7' },
  ctrlBtnLeave: {
    alignItems: 'center', gap: 4,
    backgroundColor: '#f04f5f',
    padding: 12, borderRadius: 12, minWidth: 60,
  },
  ctrlIcon: { fontSize: 20 },
  ctrlLabel: { fontSize: 10, color: '#8b92a8', fontWeight: '500' },

  // Chat
  chatPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: SCREEN_HEIGHT * 0.6,
    backgroundColor: '#181c27',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  chatTitle: { fontSize: 15, fontWeight: '700', color: '#f0f2f8' },
  chatClose: { fontSize: 16, color: '#8b92a8', padding: 4 },
  chatMessages: { flex: 1 },
  chatEmpty: { textAlign: 'center', color: '#555d73', marginTop: 32, fontSize: 13 },

  msgRow: { gap: 3 },
  msgRowRight: { alignItems: 'flex-end' },
  msgRowLeft: { alignItems: 'flex-start' },
  msgSender: { fontSize: 11, color: '#4f8ef7', fontWeight: '600', paddingLeft: 2 },
  msgBubble: { maxWidth: '80%', padding: 10, borderRadius: 14 },
  msgBubbleMe: { backgroundColor: '#4f8ef7', borderBottomRightRadius: 4 },
  msgBubbleOther: { backgroundColor: '#1e2333', borderBottomLeftRadius: 4 },
  msgText: { fontSize: 13, color: '#f0f2f8', lineHeight: 18 },
  msgTextMe: { color: '#fff' },
  msgTime: { fontSize: 10, color: '#555d73', paddingHorizontal: 2 },

  chatInputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
  },
  chatInput: {
    flex: 1, backgroundColor: '#1e2333',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12, padding: 10, fontSize: 13, color: '#f0f2f8',
    maxHeight: 80,
  },
  chatSendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1e2333', alignItems: 'center', justifyContent: 'center',
  },
  chatSendBtnActive: { backgroundColor: '#4f8ef7' },
  chatSendIcon: { fontSize: 14, color: '#fff' },
});
