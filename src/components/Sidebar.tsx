import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  IconSidebarToggle,
  IconChatBubble,
  IconCode,
  IconPlusCircle,
  IconArtifactsExact,
  IconProjects,
  IconDotsHorizontal,
  IconStarOutline,
  IconPencil,
  IconTrash
} from './Icons';
import claudeImg from '../assets/icons/claude.png';
import { NAV_ITEMS } from '../constants';
import { ChevronUp, Settings, Gem, HelpCircle, LogOut } from 'lucide-react';
import { getConversations, deleteConversation, getUser, logout } from '../api';

interface SidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  refreshTrigger: number;
  onNewChatClick?: () => void;
  onOpenSettings?: () => void;
  tunerConfig?: any;
  setTunerConfig?: (config: any) => void;
}

const Sidebar = ({ isCollapsed, toggleSidebar, refreshTrigger, onNewChatClick, onOpenSettings, tunerConfig, setTunerConfig }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [chats, setChats] = useState<any[]>([]);
  const [activeMenuIndex, setActiveMenuIndex] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number, left: number } | null>(null);
  const [userUser, setUserUser] = useState<any>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [userMenuPos, setUserMenuPos] = useState<{ bottom: number; left: number } | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userBtnRef = useRef<HTMLButtonElement>(null);

  // Map labels to the correct custom icon
  const getIcon = (label: string, size: number) => {
    switch (label) {
      case 'Chats': return <IconChatBubble size={size} />;
      case 'Projects': return <IconProjects size={size} />;
      case 'Artifacts': return <IconArtifactsExact size={size} />;
      case 'Code': return <IconCode size={size} />;
      default: return <IconChatBubble size={size} />;
    }
  };

  const handleNewChat = () => {
    // 如果已经在首页，先触发回调再导航
    if (location.pathname === '/' || location.pathname === '') {
      if (onNewChatClick) onNewChatClick();
      // 添加一个小的延迟确保状态更新
      setTimeout(() => {
        navigate('/');
      }, 0);
    } else {
      navigate('/');
    }
  };

  const updateTuner = (key: string, value: number) => {
    if (setTunerConfig && tunerConfig) {
      setTunerConfig({ ...tunerConfig, [key]: value });
    }
  };

  useEffect(() => {
    setUserUser(getUser());
    fetchChats();

    // 监听标题更新事件
    const handleTitleUpdate = () => {
      console.log('[Sidebar] Title update event received, fetching conversations...');
      fetchChats();
    };

    window.addEventListener('conversationTitleUpdated', handleTitleUpdate);

    return () => {
      window.removeEventListener('conversationTitleUpdated', handleTitleUpdate);
    };
  }, [refreshTrigger]);

  const fetchChats = async () => {
    try {
      const data = await getConversations();
      console.log('[Sidebar] Fetched conversations:', data);
      if (Array.isArray(data)) {
        setChats(data);
      }
    } catch (e) {
      console.error("Failed to fetch chats", e);
    }
  };

  const handleDeleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteConversation(id);
      setChats(chats.filter(c => c.id !== id));
      setActiveMenuIndex(null);
      if (location.pathname === `/chat/${id}`) {
        navigate('/');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuIndex(null);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    // Close on scroll
    const handleScroll = () => {
      if (activeMenuIndex !== null) setActiveMenuIndex(null);
      if (showUserMenu) setShowUserMenu(false);
    };

    if (activeMenuIndex !== null || showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      // Attach scroll listener to the sidebar scroll container
      const scrollEl = scrollRef.current;
      scrollEl?.addEventListener('scroll', handleScroll);
      window.addEventListener('resize', handleScroll);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      const scrollEl = scrollRef.current;
      scrollEl?.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [activeMenuIndex, showUserMenu]);

  const handleMenuClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    e.preventDefault();

    if (activeMenuIndex === index) {
      setActiveMenuIndex(null);
      return;
    }

    const button = e.currentTarget as HTMLElement;
    const buttonRect = button.getBoundingClientRect();
    const parentElement = button.parentElement;

    let leftPos = buttonRect.right - 200; // Fallback to button alignment

    if (parentElement) {
      const parentRect = parentElement.getBoundingClientRect();
      // Align right edge of menu (200px wide) with the right edge of the chat item container
      leftPos = parentRect.right - 200;
    }

    setMenuPosition({
      top: buttonRect.bottom + 4,
      left: leftPos,
    });
    setActiveMenuIndex(index);
  };

  return (
    <>
      <div
        className={`
          h-screen bg-claude-sidebar border-r border-claude-border flex-shrink-0 text-[#393939] antialiased flex flex-col transition-all duration-200 ease-in-out overflow-hidden relative
        `}
        style={{
          width: isCollapsed ? '46px' : `${tunerConfig?.sidebarWidth || 280}px`
        }}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between flex-shrink-0`}
          style={{
            height: 'auto',
            paddingLeft: '8px',
            paddingRight: '8px',
            paddingTop: `${tunerConfig?.headerPy || 6}px`,
            paddingBottom: `${tunerConfig?.headerPy || 6}px`
          }}
        >
          {/* Logo Container - Replaced Text with Image */}
          <div className={`transition-all duration-200 ease-in-out ${isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}`}>
            <button onClick={() => navigate('/')} className="px-1 py-1 -ml-1 hover:bg-black/5 rounded-md transition-colors flex items-center">
              <img
                src={claudeImg}
                alt="Claude"
                style={{ height: '27px', width: 'auto' }}
                className="object-contain"
              />
            </button>
          </div>

          {/* Toggle Button - Now Absolutely Positioned */}
          <button
            onClick={toggleSidebar}
            className={`
                text-gray-500 hover:text-gray-700 hover:bg-black/5 rounded-lg transition-all duration-200 flex-shrink-0 absolute
                ${isCollapsed
                ? 'flex items-center justify-center p-1.5 rounded-md'
                : 'p-1.5 rounded-md'
              }
              `}
            style={{
              top: `${tunerConfig?.toggleAbsTop}px`,
              left: isCollapsed ? `${tunerConfig?.toggleAbsLeft || 9}px` : `calc(100% - ${(tunerConfig?.toggleAbsRight || 4) + (tunerConfig?.toggleSize || 27)}px)`,
              width: `${tunerConfig?.toggleSize || 27}px`,
              height: `${tunerConfig?.toggleSize || 27}px`,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: 'none',
            }}
          >
            <IconSidebarToggle size={tunerConfig?.toggleSize} className="text-[#666]" />
          </button>
        </div>

        {/* New Chat - Fixed */}
        <div
          className="flex-shrink-0"
          style={{
            marginTop: '8px',
            paddingLeft: '9px',
            paddingRight: '9px',
            marginBottom: '2px'
          }}
        >
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-start text-[#2D2D2D] hover:bg-black/5 rounded-lg transition-colors group overflow-hidden whitespace-nowrap"
            style={{
              paddingTop: '2px',
              paddingBottom: '2px',
              paddingLeft: '0px',
              gap: '8px'
            }}
          >
            <div className={`text-[#333] flex-shrink-0 flex items-center justify-center`}>
              <IconPlusCircle size={27} />
            </div>
            <span
              className={`font-medium leading-none mt-0.5 transition-opacity duration-200 text-left ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100 block'}`}
              style={{ fontSize: '15px' }}
            >
              New chat
            </span>
          </button>
        </div>

        {/* Scrollable Area containing Nav and Recents */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto sidebar-scroll min-h-0 pb-6"
          style={{
            paddingLeft: '9px',
            paddingRight: '9px',
            paddingTop: '0px'
          }}
        >

          {/* Navigation Links */}
          <nav className="space-y-0.5 mb-6">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.label}
                className="w-full flex items-center justify-start text-[#2D2D2D] hover:bg-black/5 rounded-lg transition-colors font-medium group overflow-hidden whitespace-nowrap"
                style={{
                  paddingTop: '2px',
                  paddingBottom: '2px',
                  paddingLeft: '0px',
                  gap: '8px'
                }}
              >
                <div className={`text-gray-900 flex-shrink-0 transition-colors flex items-center justify-center`}>
                  {getIcon(item.label, 27)}
                </div>
                <span
                  className={`leading-none mt-0.5 transition-opacity duration-200 text-left ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100 block'}`}
                  style={{ fontSize: '15px' }}
                >
                  {item.label}
                </span>
              </button>
            ))}
          </nav>

          {/* Recents Section Header - Fades out */}
          <div
            className={`px-3 pb-1.5 text-[11px] font-medium text-[#747474] transition-opacity duration-200 ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}
            style={{ marginTop: `${tunerConfig?.recentsMt || 0}px` }}
          >
            Recents
          </div>

          {/* Recents List - Fades out */}
          <div className={`space-y-0.5 pb-2 transition-opacity duration-200 ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>
            {chats.map((chat, index) => {
              const isActive = location.pathname === `/chat/${chat.id}`;
              return (
                <div
                  key={chat.id}
                  onClick={() => navigate(`/chat/${chat.id}`)}
                  className={`
                    relative group flex items-center w-full rounded-lg transition-colors cursor-pointer min-h-[32px]
                    ${isActive || activeMenuIndex === index ? 'bg-black/5' : 'hover:bg-black/5'}
                  `}
                  style={{
                    paddingTop: `${tunerConfig?.recentsItemPy || 6}px`,
                    paddingBottom: `${tunerConfig?.recentsItemPy || 6}px`,
                    paddingLeft: `${tunerConfig?.recentsPl || 12}px`,
                    paddingRight: `${tunerConfig?.recentsPl || 12}px`
                  }}
                >
                  {/* Chat Title */}
                  <div className="flex-1 min-w-0 pr-6">
                    <div
                      className="text-[#393939] truncate leading-tight"
                      style={{ fontSize: `${tunerConfig?.recentsFontSize || 13}px` }}
                    >
                      {chat.title || 'New Chat'}
                    </div>
                  </div>

                  {/* Three Dots Button */}
                  <button
                    onClick={(e) => handleMenuClick(e, index)}
                    className={`
                      absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-[#747474] hover:text-[#393939] transition-all
                      ${activeMenuIndex === index ? 'opacity-100 block' : 'opacity-0 group-hover:opacity-100 hidden group-hover:block'}
                    `}
                  >
                    <IconDotsHorizontal size={16} />
                  </button>
                </div>
              );
            })}
          </div>

        </div>

        {/* User Profile Footer */}
        <div
          className="mt-auto border-t border-claude-border flex-shrink-0 relative transition-all duration-200"
          style={{
            paddingTop: `${tunerConfig?.profilePy || 12}px`,
            paddingBottom: `${tunerConfig?.profilePy || 12}px`,
            paddingLeft: isCollapsed ? '0px' : `${tunerConfig?.profilePx || 12}px`,
            paddingRight: isCollapsed ? '0px' : `${tunerConfig?.profilePx || 12}px`,
          }}
        >
          <button
            ref={userBtnRef}
            onClick={() => {
              if (!showUserMenu && userBtnRef.current) {
                const rect = userBtnRef.current.getBoundingClientRect();
                setUserMenuPos({ bottom: window.innerHeight - rect.top + 4, left: rect.left });
              }
              setShowUserMenu(!showUserMenu);
            }}
            className={`w-full flex items-center gap-2 hover:bg-black/5 rounded-lg transition-all duration-200 overflow-hidden whitespace-nowrap`}
            style={{
              padding: isCollapsed ? '8px 0px 8px 9px' : '8px'
            }}
          >
            <div
              className="rounded-full bg-claude-accent text-white flex items-center justify-center text-xs font-medium flex-shrink-0"
              style={{ width: `${tunerConfig?.userAvatarSize || 28}px`, height: `${tunerConfig?.userAvatarSize || 28}px` }}
            >
              {userUser?.nickname?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className={`flex items-center justify-between w-full transition-opacity duration-200 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
              <div className="text-left overflow-hidden">
                <div
                  className="font-medium text-[#333] leading-none"
                  style={{ fontSize: `${tunerConfig?.userNameSize || 13}px` }}
                >
                  {userUser?.nickname || 'User'}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5 leading-none">Max plan</div>
              </div>
              <ChevronUp size={16} className="text-gray-400" />
            </div>
          </button>

          {/* User Menu Popup */}
          {showUserMenu && userMenuPos && (
            <div ref={userMenuRef} className="fixed w-[220px] bg-white border border-[#E5E5E5] rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.12)] py-1.5 z-[60]"
              style={{ bottom: `${userMenuPos.bottom}px`, left: `${userMenuPos.left}px` }}
            >
              {/* User info header */}
              <div className="px-4 py-2.5 border-b border-[#E8E7E3]">
                <div className="text-[13px] font-medium text-[#333]">{userUser?.nickname || 'User'}</div>
                <div className="text-[12px] text-[#747474] mt-0.5">{userUser?.email || ''}</div>
              </div>
              {/* Menu items */}
              <div className="py-1">
                <button
                  onClick={() => { setShowUserMenu(false); onOpenSettings?.(); }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-[13px] text-[#393939] hover:bg-[#F5F4F1] transition-colors"
                >
                  <Settings size={16} className="text-[#525252]" />
                  Settings
                </button>
                <button
                  className="w-full flex items-center gap-3 px-4 py-2 text-[13px] text-[#393939] hover:bg-[#F5F4F1] transition-colors"
                  onClick={() => setShowUserMenu(false)}
                >
                  <Gem size={16} className="text-[#525252]" />
                  Upgrade Plan
                </button>
                <button
                  className="w-full flex items-center gap-3 px-4 py-2 text-[13px] text-[#999] cursor-not-allowed"
                  disabled
                >
                  <HelpCircle size={16} className="text-[#BBB]" />
                  Get Help
                </button>
              </div>
              <div className="h-[1px] bg-[#E8E7E3] mx-3" />
              <div className="py-1">
                <button
                  onClick={() => { setShowUserMenu(false); setShowLogoutConfirm(true); }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-[13px] text-[#B9382C] hover:bg-red-50 transition-colors"
                >
                  <LogOut size={16} className="text-[#B9382C]" />
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </div >

      {/* Fixed Context Menu Portal */}
      {
        activeMenuIndex !== null && menuPosition && chats[activeMenuIndex] && (
          <div
            ref={menuRef}
            className="fixed z-50 bg-white border border-[#E5E5E5] rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.08)] py-1.5 flex flex-col w-[200px]"
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`
            }}
          >
            <button className="flex items-center gap-3 px-3 py-2 hover:bg-[#F5F4F1] text-left w-full transition-colors group">
              <IconStarOutline size={16} className="text-[#525252] group-hover:text-[#393939]" />
              <span className="text-[13px] text-[#393939]">Star</span>
            </button>
            <button className="flex items-center gap-3 px-3 py-2 hover:bg-[#F5F4F1] text-left w-full transition-colors group">
              <IconPencil size={16} className="text-[#525252] group-hover:text-[#393939]" />
              <span className="text-[13px] text-[#393939]">Rename</span>
            </button>
            <div className="h-[1px] bg-[#E8E7E3] my-1 mx-3" />
            <button
              onClick={(e) => handleDeleteChat(chats[activeMenuIndex].id, e)}
              className="flex items-center gap-3 px-3 py-2 hover:bg-[#F5F4F1] text-left w-full transition-colors group"
            >
              <IconTrash size={16} className="text-[#B9382C]" />
              <span className="text-[13px] text-[#B9382C]">Delete</span>
            </button>
          </div>
        )
      }
      {/* Fixed Layout Tuner (Removed) */}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-[360px] p-6">
            <h3 className="text-[16px] font-semibold text-[#333] mb-2">确定退出登录？</h3>
            <p className="text-[14px] text-[#666] mb-6">此操作将清除您的登录状态。</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 text-[13px] text-[#393939] bg-[#F5F4F1] hover:bg-[#ECEAE6] rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => { setShowLogoutConfirm(false); logout(); }}
                className="px-4 py-2 text-[13px] text-white bg-[#B9382C] hover:bg-[#A02E23] rounded-lg transition-colors"
              >
                确认退出
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;