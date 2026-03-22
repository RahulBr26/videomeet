/**
 * Controls Bar Component
 * Bottom control bar with mic, camera, chat, participants, and leave buttons
 */

import React from 'react';

// Icon components (inline SVG for zero dependencies)
const MicIcon = ({ muted }) => muted ? (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <line x1="1" y1="1" x2="23" y2="23"/>
    <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/>
    <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23"/>
    <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
) : (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
    <path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);

const CamIcon = ({ off }) => off ? (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34"/>
    <path d="M23 7l-7 5 7 5V7z"/><line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
) : (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <polygon points="23 7 16 12 23 17 23 7"/>
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
  </svg>
);

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
);

const PeopleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
);

const LeaveIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);

export default function Controls({
  isAudioMuted,
  isVideoOff,
  onToggleAudio,
  onToggleVideo,
  onToggleChat,
  onToggleParticipants,
  onLeave,
  onShareRoom,
  isChatOpen,
  participantCount,
  roomId,
}) {
  return (
    <div className="controls-bar">
      {/* Left: Room info */}
      <div className="controls-section controls-left">
        <div className="room-id-display">
          <span className="room-label">Room</span>
          <span className="room-code">{roomId}</span>
        </div>
        <button className="ctrl-btn ctrl-btn-sm" onClick={onShareRoom} title="Copy invite link">
          <ShareIcon />
          <span>Share</span>
        </button>
      </div>

      {/* Center: Media controls */}
      <div className="controls-section controls-center">
        {/* Mic */}
        <button
          className={`ctrl-btn ctrl-btn-round ${isAudioMuted ? 'ctrl-btn-danger' : ''}`}
          onClick={onToggleAudio}
          title={isAudioMuted ? 'Unmute' : 'Mute'}
        >
          <MicIcon muted={isAudioMuted} />
          <span className="ctrl-label">{isAudioMuted ? 'Unmute' : 'Mute'}</span>
        </button>

        {/* Camera */}
        <button
          className={`ctrl-btn ctrl-btn-round ${isVideoOff ? 'ctrl-btn-danger' : ''}`}
          onClick={onToggleVideo}
          title={isVideoOff ? 'Start video' : 'Stop video'}
        >
          <CamIcon off={isVideoOff} />
          <span className="ctrl-label">{isVideoOff ? 'Start' : 'Stop'}</span>
        </button>

        {/* Leave */}
        <button
          className="ctrl-btn ctrl-btn-round ctrl-btn-leave"
          onClick={onLeave}
          title="Leave meeting"
        >
          <LeaveIcon />
          <span className="ctrl-label">Leave</span>
        </button>
      </div>

      {/* Right: UI panels */}
      <div className="controls-section controls-right">
        <button
          className={`ctrl-btn ctrl-btn-sm ${isChatOpen ? 'ctrl-btn-active' : ''}`}
          onClick={onToggleChat}
          title="Chat"
        >
          <ChatIcon />
          <span>Chat</span>
        </button>

        <button
          className="ctrl-btn ctrl-btn-sm"
          onClick={onToggleParticipants}
          title="Participants"
        >
          <PeopleIcon />
          <span>{participantCount}</span>
        </button>
      </div>
    </div>
  );
}
