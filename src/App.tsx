import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams, useNavigate } from 'react-router-dom';
import { FileText, ChevronDown, Trash, Pencil, Star } from 'lucide-react';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import { updateConversation, deleteConversation } from './api';
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
import ChatsPage from './components/ChatsPage';
import CustomizePage from './components/CustomizePage';
import ProjectsPage from './components/ProjectsPage';

const ChatHeader = ({
  title,
  showArtifacts,
  documentPanelDoc,
  onOpenArtifacts,
  hasArtifacts,
  onTitleRename
}: {
  title: string;
  showArtifacts: boolean;
  documentPanelDoc: any;
  onOpenArtifacts: () => void;
  hasArtifacts: boolean;
  onTitleRename?: (newTitle: string) => void;
}) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const startEditing = () => {
    setEditTitle(title || 'New Chat');
    setIsEditing(true);
    setShowMenu(false);
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteConversation(id);
      navigate('/');
      // Trigger sidebar refresh
      window.dispatchEvent(new CustomEvent('conversationTitleUpdated'));
    } catch (err) {
      console.error('Failed to delete chat:', err);
    }
    setShowMenu(false);
  };

  const handleRenameSubmit = async () => {
    if (!id || !editTitle.trim()) {
      setIsEditing(false);
      return;
    }

    try {
      await updateConversation(id, { title: editTitle });
      onTitleRename?.(editTitle);
      window.dispatchEvent(new CustomEvent('conversationTitleUpdated'));
    } catch (err) {
      console.error('Failed to rename chat:', err);
    } finally {
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  return (
    <div className="relative flex items-center justify-between px-3 py-2 bg-claude-bg flex-shrink-0 h-12 border-b border-transparent z-40">
      {isEditing ? (
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={handleKeyDown}
          autoFocus
          className="max-w-[60%] px-2 py-1 text-[14px] font-medium text-claude-text bg-claude-input border border-blue-500 rounded-md outline-none shadow-sm"
        />
      ) : (
        <div className="relative flex items-center gap-1">
          <button 
            onClick={startEditing}
            className="flex items-center px-2 py-1.5 hover:bg-claude-btn-hover rounded-md transition-colors text-[14px] font-medium text-claude-text max-w-[200px] truncate group"
          >
            {title || 'New Chat'}
          </button>
          
          <button
            ref={buttonRef}
            onClick={() => setShowMenu(!showMenu)}
            className={`p-1 hover:bg-claude-btn-hover rounded-md transition-colors text-claude-textSecondary hover:text-claude-text ${showMenu ? 'bg-claude-btn-hover text-claude-text' : ''}`}
          >
            <ChevronDown size={14} />
          </button>
          
          {showMenu && (
            <div 
              ref={menuRef}
              className="absolute top-full left-0 mt-1 z-50 bg-claude-input border border-claude-border rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.08)] py-1.5 flex flex-col w-[200px]"
            >
              <button className="flex items-center gap-3 px-3 py-2 hover:bg-claude-hover text-left w-full transition-colors group">
                <Star size={16} className="text-claude-textSecondary group-hover:text-claude-text" />
                <span className="text-[13px] text-claude-text">Star</span>
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  startEditing();
                }}
                className="flex items-center gap-3 px-3 py-2 hover:bg-claude-hover text-left w-full transition-colors group"
              >
                <Pencil size={16} className="text-claude-textSecondary group-hover:text-claude-text" />
                <span className="text-[13px] text-claude-text">Rename</span>
              </button>
              <div className="h-[1px] bg-claude-border my-1 mx-3" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                className="flex items-center gap-3 px-3 py-2 hover:bg-claude-hover text-left w-full transition-colors group"
              >
                <Trash size={16} className="text-[#B9382C]" />
                <span className="text-[13px] text-[#B9382C]">Delete</span>
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-1">
        {hasArtifacts && (
          <button
            onClick={onOpenArtifacts}
            className={`w-8 h-8 flex items-center justify-center text-claude-textSecondary hover:bg-claude-btn-hover rounded-md transition-colors ${showArtifacts ? 'bg-claude-btn-hover text-claude-text' : ''}`}
            title="View Artifacts"
          >
            <FileText size={18} strokeWidth={1.5} />
          </button>
        )}
        <button className="px-3 py-1.5 text-[13px] font-medium text-claude-textSecondary hover:bg-claude-btn-hover rounded-md transition-colors border border-transparent hover:border-claude-border">
          Share
        </button>
      </div>
      <div className="absolute top-full left-0 right-0 h-6 bg-gradient-to-b from-claude-bg to-transparent pointer-events-none z-30" />
    </div>
  );
};

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

  // Collapse sidebar on Customize page
  useEffect(() => {
    if (location.pathname === '/customize') {
      setIsSidebarCollapsed(true);
    }
  }, [location.pathname]);

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
    userAvatarSize: 32,
    userNameSize: 15,
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
            hasArtifacts={artifacts.length > 0}
            onTitleRename={handleTitleChange}
          />
        )}

        <div className="flex-1 flex overflow-hidden relative" ref={contentContainerRef}>

          {/* Main Content Area - takes remaining width after panel */}
          <div className="flex-1 flex flex-col h-full min-w-0">
            {/* Header - Only render here if NOT in Artifacts-only mode */}
            {isChatMode && (!showArtifacts || documentPanelDoc) && !showSettings && !showUpgrade && location.pathname !== '/chats' && location.pathname !== '/customize' && location.pathname !== '/projects' && (
              <ChatHeader
                title={currentChatTitle}
                showArtifacts={showArtifacts}
                documentPanelDoc={documentPanelDoc}
                onOpenArtifacts={handleOpenArtifacts}
                hasArtifacts={artifacts.length > 0}
                onTitleRename={handleTitleChange}
              />
            )}

            {showSettings ? (
              <SettingsPage onClose={() => setShowSettings(false)} />
            ) : showUpgrade ? (
              <UpgradePlan onClose={() => setShowUpgrade(false)} />
            ) : location.pathname === '/chats' ? (
              <ChatsPage />
            ) : location.pathname === '/customize' ? (
              <CustomizePage />
            ) : location.pathname === '/projects' ? (
              <ProjectsPage />
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
        <Route path="/chats" element={<Layout />} />
        <Route path="/customize" element={<Layout />} />
        <Route path="/projects" element={<Layout />} />
        <Route path="/chat/:id" element={<Layout />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
