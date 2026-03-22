/**
 * Chat Sidebar Component
 * Real-time messaging within a room
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

export default function Chat({ socket, roomId, peerId, peerName, isOpen }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Listen for incoming messages
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg) => {
      setMessages(prev => [...prev, msg]);
    };

    socket.on('chatMessage', handleMessage);
    return () => socket.off('chatMessage', handleMessage);
  }, [socket]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMessage = useCallback(() => {
    const text = draft.trim();
    if (!text || !socket) return;

    socket.emit('chatMessage', {
      roomId,
      peerId,
      peerName,
      message: text,
      timestamp: Date.now(),
    });

    setDraft('');
  }, [draft, socket, roomId, peerId, peerName]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <aside className="chat-panel slide-up">
      {/* Header */}
      <div className="chat-header">
        <h3>In-call messages</h3>
        <p className="chat-subtitle">Messages are only visible during the call</p>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <span className="chat-empty-icon">💬</span>
            <p>No messages yet</p>
            <p>Be the first to say something!</p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.peerId === peerId;
          return (
            <div key={msg.id} className={`chat-message ${isMe ? 'is-me' : ''}`}>
              {!isMe && (
                <div className="msg-sender">{msg.peerName}</div>
              )}
              <div className="msg-bubble">
                <span className="msg-text">{msg.message}</span>
              </div>
              <div className="msg-time">{formatTime(msg.timestamp)}</div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <textarea
          ref={inputRef}
          className="chat-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          rows={1}
          maxLength={1000}
        />
        <button
          className={`chat-send-btn ${draft.trim() ? 'active' : ''}`}
          onClick={sendMessage}
          disabled={!draft.trim()}
          title="Send (Enter)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </aside>
  );
}
