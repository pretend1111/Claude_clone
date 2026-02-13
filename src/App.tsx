import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import Auth from './components/Auth';
import SettingsPage from './components/SettingsPage';
import UpgradePlan from './components/UpgradePlan';

const Layout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [newChatKey, setNewChatKey] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);
  const [authValid, setAuthValid] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const location = useLocation();

  useEffect(() => {
    setShowSettings(false);
    setShowUpgrade(false);
  }, [location.pathname]);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setAuthChecked(true);
      setAuthValid(false);
      return;
    }
    fetch('http://localhost:3001/api/user/profile', {
      headers: { 'Authorization': `Bearer ${token}` },
    }).then(res => {
      if (res.ok) {
        res.json().then(data => {
          if (data.newToken) {
            localStorage.setItem('auth_token', data.newToken);
          }
          setAuthValid(true);
          setAuthChecked(true);
        });
      } else {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        setAuthValid(false);
        setAuthChecked(true);
      }
    }).catch(() => {
      // 网络错误时信任本地 token，避免离线时踢出
      setAuthValid(true);
      setAuthChecked(true);
    });
  }, []);

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
  if (!authChecked) {
    return null; // 验证中，不渲染
  }
  if (!authValid) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex w-full h-screen overflow-hidden bg-claude-bg font-sans antialiased selection:bg-[#D97757] selection:text-white">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        refreshTrigger={refreshTrigger}
        onNewChatClick={handleNewChat}
        onOpenSettings={() => { setShowSettings(true); setShowUpgrade(false); }}
        onOpenUpgrade={() => { setShowUpgrade(true); setShowSettings(false); }}
        tunerConfig={tunerConfig}
        setTunerConfig={setTunerConfig}
      />
      <div className="flex-1 flex flex-col h-full min-w-0">
        {showSettings ? (
          <SettingsPage onClose={() => setShowSettings(false)} />
        ) : showUpgrade ? (
          <UpgradePlan onClose={() => setShowUpgrade(false)} />
        ) : (
          <MainContent
            onNewChat={handleNewChat}
            resetKey={newChatKey}
            tunerConfig={tunerConfig}
          />
        )}
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