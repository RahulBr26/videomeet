/**
 * Home / Lobby Page
 * Create a new room or join an existing one
 * Clean, Google Meet-inspired lobby design
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

export default function HomePage({ userName, setUserName }) {
  const navigate = useNavigate();
  const [roomInput, setRoomInput] = useState('');
  const [nameInput, setNameInput] = useState(userName || '');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [previewStream, setPreviewStream] = useState(null);
  const videoRef = useRef(null);

  // Start camera preview
  useEffect(() => {
    let stream;
    navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 180 }, audio: false })
      .then(s => {
        stream = s;
        setPreviewStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => {}); // Silently fail if no camera

    return () => stream?.getTracks().forEach(t => t.stop());
  }, []);

  const handleCreateRoom = async () => {
    if (!nameInput.trim()) {
      setError('Please enter your name first');
      return;
    }
    setIsCreating(true);
    setError('');

    try {
      const res = await axios.get(`${SERVER_URL}/api/rooms/new`);
      const { roomId } = res.data;
      setUserName(nameInput.trim());
      previewStream?.getTracks().forEach(t => t.stop());
      navigate(`/room/${roomId}`);
    } catch (err) {
      setError('Failed to create room. Is the server running?');
      setIsCreating(false);
    }
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!roomInput.trim()) {
      setError('Please enter a room ID or link');
      return;
    }

    setError('');
    setUserName(nameInput.trim());

    // Extract room ID from link or use as-is
    let rid = roomInput.trim();
    const match = rid.match(/\/room\/([^/?#]+)/);
    if (match) rid = match[1];

    previewStream?.getTracks().forEach(t => t.stop());
    navigate(`/room/${rid}`);
  };

  return (
    <div className="home-page">
      {/* Background mesh */}
      <div className="home-bg" aria-hidden="true">
        <div className="mesh-blob mesh-blob-1" />
        <div className="mesh-blob mesh-blob-2" />
        <div className="mesh-blob mesh-blob-3" />
      </div>

      {/* Header */}
      <header className="home-header">
        <div className="home-logo">
          <span className="logo-icon">📹</span>
          <span className="logo-text">VideoMeet</span>
        </div>
        <nav className="home-nav">
          <a href="https://github.com" target="_blank" rel="noreferrer" className="nav-link">
            GitHub
          </a>
        </nav>
      </header>

      {/* Main */}
      <main className="home-main">
        {/* Left: actions */}
        <section className="home-actions fade-in">
          <div className="home-headline">
            <h1>Video calls for<br /><span className="headline-accent">everyone</span></h1>
            <p className="home-subline">
              Connect, collaborate, and celebrate — no downloads required.
              Up to 50 participants per room.
            </p>
          </div>

          {/* Name input */}
          <div className="input-group">
            <label className="input-label">Your name</label>
            <input
              type="text"
              className="home-input"
              placeholder="Enter your name"
              value={nameInput}
              onChange={e => { setNameInput(e.target.value); setError(''); }}
              maxLength={30}
            />
          </div>

          {/* Create room */}
          <button
            className="btn-create"
            onClick={handleCreateRoom}
            disabled={isCreating}
          >
            {isCreating ? (
              <>
                <span className="btn-spinner" />
                Creating…
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="16"/>
                  <line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
                New meeting
              </>
            )}
          </button>

          {/* Divider */}
          <div className="or-divider">
            <span>or join with a code</span>
          </div>

          {/* Join form */}
          <form className="join-form" onSubmit={handleJoinRoom}>
            <input
              type="text"
              className="home-input"
              placeholder="Enter room code or link"
              value={roomInput}
              onChange={e => { setRoomInput(e.target.value); setError(''); }}
            />
            <button
              type="submit"
              className="btn-join"
              disabled={!roomInput.trim()}
            >
              Join
            </button>
          </form>

          {error && <div className="error-banner">{error}</div>}

          {/* Features */}
          <div className="features-row">
            {[
              { icon: '🔒', label: 'Encrypted' },
              { icon: '📱', label: 'Mobile ready' },
              { icon: '⚡', label: 'Low latency' },
              { icon: '🌐', label: 'No install' },
            ].map(f => (
              <div key={f.label} className="feature-chip">
                <span>{f.icon}</span>
                <span>{f.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Right: Camera preview */}
        <section className="home-preview fade-in">
          <div className="preview-card">
            <div className="preview-video-wrap">
              {previewStream ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="preview-video"
                />
              ) : (
                <div className="preview-placeholder">
                  <span className="preview-icon">📷</span>
                  <p>Camera preview</p>
                  <p className="preview-sub">Allow camera access to see yourself</p>
                </div>
              )}
              <div className="preview-overlay">
                <span className="preview-name">{nameInput || 'Your name'}</span>
              </div>
            </div>
            <div className="preview-caption">
              Ready to join — your camera and mic will be active in the room
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
