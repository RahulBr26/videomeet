/**
 * App.jsx
 * Root component with routing and global providers
 */

import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './contexts/SocketContext';
import HomePage from './components/HomePage';
import RoomPage from './components/RoomPage';
import './styles/global.css';
import './styles/room.css';
import './styles/home.css';
import './styles/components.css';

export default function App() {
  const [userName, setUserName] = useState(
    () => localStorage.getItem('vm_username') || ''
  );

  const handleSetUserName = (name) => {
    setUserName(name);
    localStorage.setItem('vm_username', name);
  };

  return (
    <SocketProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                userName={userName}
                setUserName={handleSetUserName}
              />
            }
          />
          <Route
            path="/room/:roomId"
            element={
              userName
                ? <RoomPage userName={userName} />
                : <Navigate to="/" replace />
            }
          />
          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SocketProvider>
  );
}
