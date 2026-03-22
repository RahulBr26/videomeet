/**
 * Participants Panel
 * Lists all participants with their audio/video status
 */

import React from 'react';

function StatusDot({ isMuted, isVideoOff, isSpeaking }) {
  if (isSpeaking && !isMuted) return <span className="status-speaking">●</span>;
  if (isMuted) return <span className="status-muted">🔇</span>;
  return <span className="status-active">●</span>;
}

export default function ParticipantsPanel({ peers, localPeerId, localName, isOpen }) {
  if (!isOpen) return null;

  const allParticipants = [
    { id: localPeerId, name: localName, isLocal: true },
    ...[...peers.entries()].map(([id, peer]) => ({
      id,
      name: peer.name,
      isAudioMuted: peer.isAudioMuted,
      isVideoOff: peer.isVideoOff,
      isSpeaking: peer.isSpeaking,
      isLocal: false,
    })),
  ];

  return (
    <aside className="participants-panel slide-up">
      <div className="participants-header">
        <h3>People</h3>
        <span className="participants-count">{allParticipants.length}</span>
      </div>

      <div className="participants-list">
        {allParticipants.map((p) => (
          <div key={p.id} className="participant-row">
            <div className="participant-avatar">
              {(p.name || 'A')[0].toUpperCase()}
            </div>
            <div className="participant-info">
              <span className="participant-name">
                {p.name || 'Participant'}
                {p.isLocal && <span className="you-tag">You</span>}
              </span>
            </div>
            <div className="participant-status">
              {p.isAudioMuted && (
                <span title="Muted" className="status-icon status-muted-icon">
                  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                    <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/>
                    <path d="M17 16.95A7 7 0 015 12v-2"/>
                  </svg>
                </span>
              )}
              {p.isVideoOff && (
                <span title="Camera off" className="status-icon status-cam-icon">
                  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                    <path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2"/>
                    <path d="M23 7l-7 5 7 5V7z"/>
                  </svg>
                </span>
              )}
              {p.isSpeaking && !p.isAudioMuted && (
                <span className="speaking-bars">
                  <span/><span/><span/>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
