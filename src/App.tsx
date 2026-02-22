import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { FileText, ChevronDown } from 'lucide-react';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import Auth from './components/Auth';
import SettingsPage from './components/SettingsPage';
import UpgradePlan from './components/UpgradePlan';
import DocumentPanel from './components/DocumentPanel';
import ArtifactsPanel from './components/ArtifactsPanel';
import DraggableDivider from './components/DraggableDivider';
import { DocumentInfo } from './components/DocumentCard';
import AdminLayout from './components/admin/AdminLayout';
import AdminDashboard from './components/admin/AdminDashboard';
import AdminKeyPool from './components/admin/AdminKeyPool';
import AdminUsers from './components/admin/AdminUsers';
import AdminPlans from './components/admin/AdminPlans';
import AdminRedemption from './components/admin/AdminRedemption';
import AdminModels from './components/admin/AdminModels';

const ChatHeader = ({
  title,
  showArtifacts,
  documentPanelDoc,
  onOpenArtifacts
}: {
  title: string;
  showArtifacts: boolean;
  documentPanelDoc: any;
  onOpenArtifacts: () => void;
}) => (
  <div className="relative flex items-center justify-between px-3 py-2 bg-claude-bg flex-shrink-0 h-12 border-b border-transparent z-40">
    <button className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-claude-btn-hover rounded-md transition-colors text-[14px] font-medium text-claude-text max-w-[60%] -ml-1">
      <span className="truncate">{title || 'New Chat'}</span>
      <ChevronDown size={14} className="text-claude-textSecondary" />
    </button>

    <div className="flex items-center gap-1">
      <button
        onClick={onOpenArtifacts}
        className={`w-8 h-8 flex items-center justify-center text-claude-textSecondary hover:bg-claude-btn-hover rounded-md transition-colors ${showArtifacts ? 'bg-claude-btn-hover text-claude-text' : ''}`}
        title="View Artifacts"
      >
        <FileText size={18} strokeWidth={1.5} />
      </button>
      <button className="px-3 py-1.5 text-[13px] font-medium text-claude-textSecondary hover:bg-claude-btn-hover rounded-md transition-colors border border-transparent hover:border-claude-border">
        Share
      </button>
    </div>
    <div className="absolute top-full left-0 right-0 h-6 bg-gradient-to-b from-claude-bg to-transparent pointer-events-none z-30" />
  </div>
);

const Layout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [newChatKey, setNewChatKey] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);
  const [authValid, setAuthValid] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Document panel state
  const [documentPanelDoc, setDocumentPanelDoc] = useState<DocumentInfo | null>(null);
  const [showArtifacts, setShowArtifacts] = useState(false);
  const [artifacts, setArtifacts] = useState<DocumentInfo[]>([]);
  const [documentPanelWidth, setDocumentPanelWidth] = useState(50); // percent of remaining space (1:1 default)
  const [isChatMode, setIsChatMode] = useState(false);
  const [currentChatTitle, setCurrentChatTitle] = useState('');
  const sidebarWasCollapsedRef = useRef(false);
  const contentContainerRef = useRef<HTMLDivElement>(null);

  const location = useLocation();

  useEffect(() => {
    setShowSettings(false);
    setShowUpgrade(false);
    setDocumentPanelDoc(null);
    setShowArtifacts(false);
  }, [location.pathname]);

  // Listen for open-upgrade event from MainContent paywall
  useEffect(() => {
    const handler = () => { setShowUpgrade(true); setShowSettings(false); };
    window.addEventListener('open-upgrade', handler);
    return () => window.removeEventListener('open-upgrade', handler);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setAuthChecked(true);
      setAuthValid(false);
      return;
    }
    fetch('/api/user/profile', {
      headers: { 'Authorization': `Bearer ${token}` },
    }).then(res => {
      if (res.ok) {
        res.json().then(data => {
          if (data.newToken) {
            localStorage.setItem('auth_token', data.newToken);
          }
          if (data.theme) {
            localStorage.setItem('theme', data.theme);
            const root = document.documentElement;
            if (data.theme === 'dark') {
              root.classList.add('dark');
              root.setAttribute('data-theme', 'dark');
            } else if (data.theme === 'auto') {
              const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
              root.classList.toggle('dark', prefersDark);
              root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
            } else {
              root.classList.remove('dark');
              root.setAttribute('data-theme', 'light');
            }
          }
          if (data.chat_font) {
            localStorage.setItem('chat_font', data.chat_font);
            document.documentElement.setAttribute('data-chat-font', data.chat_font);
          }
          if (data.default_model) {
            localStorage.setItem('default_model', data.default_model);
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

  const refreshSidebar = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleNewChat = () => {
    setNewChatKey(prev => prev + 1);
    setRefreshTrigger(prev => prev + 1);
    setShowSettings(false);
    setShowUpgrade(false);
    setDocumentPanelDoc(null);
    setShowArtifacts(false);
  };

  const handleOpenDocument = useCallback((doc: DocumentInfo) => {
    if (!documentPanelDoc && !showArtifacts) {
      sidebarWasCollapsedRef.current = isSidebarCollapsed;
    }
    setShowArtifacts(false);
    setIsSidebarCollapsed(true);
    setDocumentPanelDoc(doc);
  }, [isSidebarCollapsed, documentPanelDoc, showArtifacts]);

  const handleCloseDocument = useCallback(() => {
    setDocumentPanelDoc(null);
    if (!showArtifacts) {
      setIsSidebarCollapsed(sidebarWasCollapsedRef.current);
    }
  }, [showArtifacts]);

  const handleArtifactsUpdate = useCallback((docs: DocumentInfo[]) => {
    setArtifacts(docs);
  }, []);

  const handleOpenArtifacts = useCallback(() => {
    if (showArtifacts) {
      setShowArtifacts(false);
      // Restore sidebar state if it was collapsed by us?
      // For now, simple toggle close.
      if (!documentPanelDoc) {
        setIsSidebarCollapsed(sidebarWasCollapsedRef.current);
      }
      return;
    }

    if (!documentPanelDoc) {
      sidebarWasCollapsedRef.current = isSidebarCollapsed;
    }
    setIsSidebarCollapsed(true);
    setShowArtifacts(true);
    setDocumentPanelDoc(null);
  }, [isSidebarCollapsed, documentPanelDoc, showArtifacts]);

  const handleCloseArtifacts = useCallback(() => {
    setShowArtifacts(false);
    setIsSidebarCollapsed(sidebarWasCollapsedRef.current);
  }, []);

  const handleChatModeChange = useCallback((isChat: boolean) => {
    setIsChatMode(isChat);
  }, []);

  const handleTitleChange = useCallback((title: string) => {
    setCurrentChatTitle(title);
  }, []);

  // Layout Tuner State
  const [tunerConfig, setTunerConfig] = useState({
    sidebarWidth: 288, // tuned value
    recentsMt: 24,
    profilePy: 10,
    profilePx: 12,
    mainContentWidth: 773, // tuned value
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
    <div className="flex w-full h-screen overflow-hidden bg-claude-bg font-sans antialiased">
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

      {/* Unified Content Wrapper - takes remaining space after sidebar */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">

        {/* Header - moved to allow conditional placement (Full Width Mode) */}
        {isChatMode && (showArtifacts && !documentPanelDoc) && !showSettings && !showUpgrade && (
          <ChatHeader
            title={currentChatTitle}
            showArtifacts={showArtifacts}
            documentPanelDoc={documentPanelDoc}
            onOpenArtifacts={handleOpenArtifacts}
          />
        )}

        <div className="flex-1 flex overflow-hidden relative" ref={contentContainerRef}>

          {/* Main Content Area - takes remaining width after panel */}
          <div className="flex-1 flex flex-col h-full min-w-0">
            {/* Header - Only render here if NOT in Artifacts-only mode */}
            {isChatMode && (!showArtifacts || documentPanelDoc) && !showSettings && !showUpgrade && (
              <ChatHeader
                title={currentChatTitle}
                showArtifacts={showArtifacts}
                documentPanelDoc={documentPanelDoc}
                onOpenArtifacts={handleOpenArtifacts}
              />
            )}

            {showSettings ? (
              <SettingsPage onClose={() => setShowSettings(false)} />
            ) : showUpgrade ? (
              <UpgradePlan onClose={() => setShowUpgrade(false)} />
            ) : (
              <MainContent
                onNewChat={refreshSidebar}
                resetKey={newChatKey}
                tunerConfig={tunerConfig}
                onOpenDocument={handleOpenDocument}
                onArtifactsUpdate={handleArtifactsUpdate}
                onOpenArtifacts={handleOpenArtifacts}
                onTitleChange={handleTitleChange}
                onChatModeChange={handleChatModeChange}
              />
            )}
          </div>

          {/* Animated Document Panel Container */}
          <div
            className={`h-full bg-claude-bg transition-all duration-300 ease-out flex z-20 ${showArtifacts ? 'border border-claude-border rounded-2xl mr-2 ml-4' : ''}`}
            style={{
              width: documentPanelDoc ? `${documentPanelWidth}%` : showArtifacts ? '420px' : '0px',
              opacity: (documentPanelDoc || showArtifacts) ? 1 : 0,
              overflow: 'hidden'
            }}
          >
            <div className={`w-full h-full flex relative min-w-0`}>
              {(documentPanelDoc || showArtifacts) && (
                <>
                  {documentPanelDoc ? <DraggableDivider onResize={setDocumentPanelWidth} containerRef={contentContainerRef} /> : null}
                  {documentPanelDoc ? (
                    <DocumentPanel document={documentPanelDoc} onClose={handleCloseDocument} />
                  ) : (
                    <ArtifactsPanel
                      documents={artifacts}
                      onClose={handleCloseArtifacts}
                      onOpenDocument={handleOpenDocument}
                    />
                  )}
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="keys" element={<AdminKeyPool />} />
          <Route path="models" element={<AdminModels />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="plans" element={<AdminPlans />} />
          <Route path="redemption" element={<AdminRedemption />} />
        </Route>
        <Route path="/" element={<Layout />} />
        <Route path="/chat/:id" element={<Layout />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
