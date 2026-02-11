import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import Auth from './components/Auth';

const Layout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [newChatKey, setNewChatKey] = useState(0);

  const handleNewChat = () => {
    setNewChatKey(prev => prev + 1);
    setRefreshTrigger(prev => prev + 1);
  };

  // Layout Tuner State
  const [tunerConfig, setTunerConfig] = useState({
    sidebarWidth: 288,
    recentsMt: 36,
    profilePy: 10,
    profilePx: 12,
    mainContentWidth: 773,
    mainContentMt: -100,
    inputRadius: 24,
    welcomeSize: 46,
    welcomeMb: 34,

    recentsFontSize: 14,
    recentsItemPy: 7,
    recentsPl: 6,
    userAvatarSize: 28,
    userNameSize: 13,
    headerPy: 0,

    // Toggle Button (Independent Position)
    toggleSize: 28,
    toggleAbsRight: 10,
    toggleAbsTop: 11,
    toggleAbsLeft: 8, // Collapsed State Left Position
  });

  // Guard: check if logged in
  const token = localStorage.getItem('auth_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex w-full h-screen overflow-hidden bg-claude-bg font-sans antialiased selection:bg-[#D97757] selection:text-white">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        refreshTrigger={refreshTrigger}
        onNewChatClick={handleNewChat}
        tunerConfig={tunerConfig}
        setTunerConfig={setTunerConfig}
      />
      <div className="flex-1 flex flex-col h-full min-w-0">
        <MainContent
          onNewChat={handleNewChat}
          resetKey={newChatKey}
          tunerConfig={tunerConfig}
        />
      </div>
    </div>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route path="/" element={<Layout />} />
        <Route path="/chat/:id" element={<Layout />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;