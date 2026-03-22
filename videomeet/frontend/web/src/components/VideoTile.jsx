/**
 * VideoTile Component
 * Displays a single participant's video with name, status indicators
 */

import React, { useEffect, useRef, memo } from 'react';

const VideoTile = memo(function VideoTile({
  stream,
  peerName,
  isLocal,
  isAudioMuted,
  isVideoOff,
  isSpeaking,
  isActiveSpeaker,
  tileSize = 'normal', // 'normal' | 'large' | 'small'
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      video.srcObject = stream;
    } else {
      video.srcObject = null;
    }
  }, [stream]);

  const initials = (peerName || 'A')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const showVideo = stream && !isVideoOff;

  return (
    <div
      className={`video-tile ${isSpeaking || isActiveSpeaker ? 'speaking' : ''} size-${tileSize}`}
      data-local={isLocal}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} // Never play back local audio (echo)
        style={{ display: showVideo ? 'block' : 'none' }}
      />

      {/* Avatar fallback when video is off */}
      {!showVideo && (
        <div className="avatar-fallback">
          <div className="avatar-circle">
            <span className="avatar-initials">{initials}</span>
          </div>
        </div>
      )}

      {/* Overlay: name + indicators */}
      <div className="tile-overlay">
        <div className="tile-name">
          {isAudioMuted && <span className="tile-mute-icon" title="Muted">🎙️</span>}
          {peerName || 'Participant'}
          {isLocal && <span className="tile-you-badge">You</span>}
        </div>

        {/* Speaking indicator */}
        {(isSpeaking || isActiveSpeaker) && !isAudioMuted && (
          <div className="speaking-indicator">
            <span /><span /><span />
          </div>
        )}
      </div>

      {/* Network quality (stub) */}
      <div className="tile-quality" />
    </div>
  );
});

export default VideoTile;
