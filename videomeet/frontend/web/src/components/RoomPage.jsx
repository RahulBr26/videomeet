/**
 * Room Page
 * Main video conference view with grid, controls, chat, and participants
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import VideoGrid from '../components/VideoGrid';
import Controls from '../components/Controls';
import Chat from '../components/Chat';
import ParticipantsPanel from '../components/ParticipantsPanel';
import { useMediasoup } from '../hooks/useMediasoup';
import { useSocket } from '../contexts/SocketContext';

export default function RoomPage({ userName }) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);

  const {
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
  } = useMediasoup(socket, roomId, userName || 'Guest');

  // Auto-join when socket is ready
  useEffect(() => {
    if (socket && connectionState === 'idle') {
      joinRoom();
    }
  }, [socket]);

  // Track active speaker
  useEffect(() => {
    if (!socket) return;

    const handle = ({ peerId: pid, isSpeaking: speaking }) => {
      if (speaking) {
        setActiveSpeakerId(pid);
      } else if (activeSpeakerId === pid) {
        setActiveSpeakerId(null);
      }
    };

    socket.on('speakingState', handle);
    return () => socket.off('speakingState', handle);
  }, [socket, activeSpeakerId]);

  // Leave and navigate home
  const handleLeave = useCallback(() => {
    leaveRoom();
    navigate('/');
  }, [leaveRoom, navigate]);

  // Share room link
  const handleShareRoom = useCallback(() => {
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      alert(`Room link copied!\n\n${url}`);
    }).catch(() => {
      prompt('Copy this room link:', url);
    });
  }, [roomId]);

  // ── Render states ──────────────────────────────────────────────────────────

  if (connectionState === 'joining') {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Joining room <strong>{roomId}</strong>…</p>
        <p className="loading-sub">Setting up your camera and microphone</p>
      </div>
    );
  }

  if (connectionState === 'error' || error) {
    return (
      <div className="error-screen">
        <div className="error-icon">⚠️</div>
        <h2>Couldn't join the room</h2>
        <p>{error}</p>
        <div className="error-actions">
          <button className="btn-primary" onClick={joinRoom}>Try again</button>
          <button className="btn-ghost" onClick={() => navigate('/')}>Go home</button>
        </div>
      </div>
    );
  }

  const participantCount = peers.size + 1; // +1 for local

  return (
    <div className="room-page">
      {/* Header */}
      <header className="room-header">
        <div className="room-header-left">
          <div className="logo-sm">📹 VideoMeet</div>
          <div className="room-info">
            <span className="room-id-chip">{roomId}</span>
            <span className="room-time" id="room-clock" />
          </div>
        </div>
        <div className="room-header-right">
          {!isJoined && (
            <span className="connecting-badge">Connecting…</span>
          )}
        </div>
      </header>

      {/* Main area */}
      <main className="room-main">
        {/* Video grid — takes all available space */}
        <div className="grid-container">
          <VideoGrid
            localStream={localStream}
            localPeerId={peerId}
            localName={userName || 'You'}
            isLocalAudioMuted={isAudioMuted}
            isLocalVideoOff={isVideoOff}
            isLocalSpeaking={isSpeaking}
            peers={peers}
            activeSpeakerId={activeSpeakerId}
          />
        </div>

        {/* Side panels */}
        <div className="side-panels">
          <Chat
            socket={socket}
            roomId={roomId}
            peerId={peerId}
            peerName={userName || 'Guest'}
            isOpen={isChatOpen}
          />
          <ParticipantsPanel
            peers={peers}
            localPeerId={peerId}
            localName={userName || 'You'}
            isOpen={isParticipantsOpen}
          />
        </div>
      </main>

      {/* Controls */}
      <Controls
        isAudioMuted={isAudioMuted}
        isVideoOff={isVideoOff}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleChat={() => {
          setIsChatOpen(v => !v);
          if (!isChatOpen) setIsParticipantsOpen(false);
        }}
        onToggleParticipants={() => {
          setIsParticipantsOpen(v => !v);
          if (!isParticipantsOpen) setIsChatOpen(false);
        }}
        onLeave={handleLeave}
        onShareRoom={handleShareRoom}
        isChatOpen={isChatOpen}
        participantCount={participantCount}
        roomId={roomId}
      />
    </div>
  );
}
