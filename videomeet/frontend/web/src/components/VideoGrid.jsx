/**
 * VideoGrid Component
 * Dynamically adapts grid layout based on participant count
 * Supports 1–50+ participants with responsive tiling
 */

import React, { useMemo } from 'react';
import VideoTile from './VideoTile';

/**
 * Compute CSS grid template based on participant count
 */
function getGridLayout(count) {
  if (count === 1) return { cols: 1, rows: 1, tileSize: 'large' };
  if (count === 2) return { cols: 2, rows: 1, tileSize: 'large' };
  if (count <= 4)  return { cols: 2, rows: 2, tileSize: 'normal' };
  if (count <= 6)  return { cols: 3, rows: 2, tileSize: 'normal' };
  if (count <= 9)  return { cols: 3, rows: 3, tileSize: 'normal' };
  if (count <= 12) return { cols: 4, rows: 3, tileSize: 'small' };
  if (count <= 16) return { cols: 4, rows: 4, tileSize: 'small' };
  return { cols: 5, rows: Math.ceil(count / 5), tileSize: 'small' };
}

export default function VideoGrid({
  localStream,
  localPeerId,
  localName,
  isLocalAudioMuted,
  isLocalVideoOff,
  isLocalSpeaking,
  peers,
  activeSpeakerId,
}) {
  // Convert peers Map to array, put local first
  const participants = useMemo(() => {
    const list = [
      {
        id: localPeerId,
        name: localName,
        audioStream: localStream,
        videoStream: localStream,
        isLocal: true,
        isAudioMuted: isLocalAudioMuted,
        isVideoOff: isLocalVideoOff,
        isSpeaking: isLocalSpeaking,
      },
    ];

    peers.forEach((peer, id) => {
      // Merge audio+video into combined stream for display
      const tracks = [];
      if (peer.audioStream) tracks.push(...peer.audioStream.getTracks());
      if (peer.videoStream) tracks.push(...peer.videoStream.getTracks());
      
      // Create a combined stream
      const combinedStream = tracks.length > 0 ? new MediaStream(tracks) : null;

      list.push({
        id,
        name: peer.name,
        audioStream: peer.audioStream,
        videoStream: peer.videoStream,
        combinedStream,
        isLocal: false,
        isAudioMuted: peer.isAudioMuted,
        isVideoOff: peer.isVideoOff,
        isSpeaking: peer.isSpeaking,
      });
    });

    return list;
  }, [localStream, localPeerId, localName, isLocalAudioMuted, isLocalVideoOff, isLocalSpeaking, peers]);

  const { cols, tileSize } = getGridLayout(participants.length);

  return (
    <div
      className="video-grid"
      style={{
        '--grid-cols': cols,
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: '8px',
        padding: '8px',
        width: '100%',
        height: '100%',
        overflow: 'auto',
      }}
    >
      {participants.map(participant => (
        <VideoTile
          key={participant.id}
          stream={participant.isLocal ? localStream : participant.combinedStream}
          peerName={participant.name}
          isLocal={participant.isLocal}
          isAudioMuted={participant.isAudioMuted}
          isVideoOff={participant.isVideoOff}
          isSpeaking={participant.isSpeaking}
          isActiveSpeaker={activeSpeakerId === participant.id}
          tileSize={participants.length === 1 ? 'large' : tileSize}
        />
      ))}
    </div>
  );
}
