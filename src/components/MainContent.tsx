import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ChevronDown, FileText, ArrowUp, RotateCcw, Pencil, Copy, Check, Square, Paperclip, ListCollapse, Globe, Clock, Ghost } from 'lucide-react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { IconPlus, IconVoice, IconPencil } from './Icons';
import ClaudeLogo from './ClaudeLogo';
import { getConversation, sendMessage, createConversation, getUser, updateConversation, deleteMessagesFrom, uploadFile, deleteAttachment, compactConversation, getUserUsage } from '../api';
import MarkdownRenderer from './MarkdownRenderer';
import ModelSelector from './ModelSelector';
import FileUploadPreview, { PendingFile } from './FileUploadPreview';
import MessageAttachments from './MessageAttachments';
import DocumentCard, { DocumentInfo } from './DocumentCard';
import { copyToClipboard } from '../utils/clipboard';
import SearchProcess from './SearchProcess';

// 时间戳格式化
function formatMessageTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (isToday) {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
  const isSameYear = date.getFullYear() === now.getFullYear();
  if (isSameYear) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

interface MainContentProps {
  onNewChat: () => void; // Callback to tell sidebar to refresh
  resetKey?: number;
  tunerConfig?: any;
  onOpenDocument?: (doc: DocumentInfo) => void;
  onArtifactsUpdate?: (docs: DocumentInfo[]) => void;
  onOpenArtifacts?: () => void;
  onTitleChange?: (title: string) => void;
  onChatModeChange?: (isChat: boolean) => void;
}

// 草稿存储：在切换对话、打开设置页面时保留输入内容和附件
const draftsStore = new Map<string, { text: string; files: PendingFile[]; height: number }>();

/** Memoized message list — skips re-render when only inputText changes */
interface MessageListProps {
  messages: any[];
  loading: boolean;
  expandedMessages: Set<number>;
  editingMessageIdx: number | null;
  editingContent: string;
  copiedMessageIdx: number | null;
  compactStatus: { state: string; message?: string };
  onSetEditingContent: (v: string) => void;
  onEditCancel: () => void;
  onEditSave: () => void;
  onToggleExpand: (idx: number) => void;
  onResend: (content: string, idx: number) => void;
  onEdit: (content: string, idx: number) => void;
  onCopy: (content: string, idx: number) => void;
  onOpenDocument?: (doc: DocumentInfo) => void;
  onSetMessages: React.Dispatch<React.SetStateAction<any[]>>;
  messageContentRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
}

const MessageList = React.memo<MessageListProps>(({
  messages, loading, expandedMessages, editingMessageIdx, editingContent,
  copiedMessageIdx, compactStatus, onSetEditingContent, onEditCancel, onEditSave,
  onToggleExpand, onResend, onEdit, onCopy, onOpenDocument, onSetMessages,
  messageContentRefs,
}) => {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .animate-shimmer-text {
          background: linear-gradient(90deg, #6b7280 45%, #ffffff 50%, #6b7280 55%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }
      `}</style>
      {messages.map((msg: any, idx: number) => (
        <div key={idx} className="mb-6 group">
          {msg.is_summary === 1 && (
            <div className="flex items-center gap-3 mb-5 mt-2">
              <div className="flex-1 h-px bg-claude-border" />
              <span className="text-[12px] text-claude-textSecondary whitespace-nowrap">Context compacted above this point</span>
              <div className="flex-1 h-px bg-claude-border" />
            </div>
          )}
          {msg.role === 'user' ? (
            editingMessageIdx === idx ? (
              <div className="w-full">
                <div className="bg-[#F0EEE7] dark:bg-claude-btnHover rounded-2xl px-5 py-3.5 text-[16px] leading-relaxed font-sans">
                  <textarea
                    className="w-full bg-transparent text-claude-text outline-none resize-none font-sans text-[16px] leading-relaxed"
                    value={editingContent}
                    onChange={(e) => {
                      onSetEditingContent(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    onKeyDown={(e) => { if (e.key === 'Escape') onEditCancel(); }}
                    ref={(el) => {
                      if (el) {
                        el.style.height = 'auto';
                        el.style.height = el.scrollHeight + 'px';
                        el.focus();
                      }
                    }}
                    style={{ minHeight: '60px' }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[13px] text-claude-textSecondary">
                    Submitting will replace this response and all following messages
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={onEditCancel} className="px-4 py-1.5 text-[13px] font-medium text-claude-text bg-claude-btnHover hover:bg-claude-hover rounded-lg transition-colors">Cancel</button>
                    <button onClick={onEditSave} disabled={!editingContent.trim()} className="px-4 py-1.5 text-[13px] font-medium text-white bg-[#D97757] hover:bg-[#c4694a] rounded-lg transition-colors disabled:opacity-40">Send</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-end">
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="max-w-[85%] w-fit mb-1">
                    <MessageAttachments attachments={msg.attachments} />
                  </div>
                )}
                <div className="max-w-[85%] w-fit relative">
                  <div
                    className="bg-[#F0EEE7] dark:bg-claude-btnHover text-claude-text px-5 py-2.5 text-[16px] leading-relaxed font-sans whitespace-pre-wrap break-words relative overflow-hidden"
                    style={{
                      maxHeight: expandedMessages.has(idx) ? 'none' : '300px',
                      borderRadius: ((() => {
                        const el = messageContentRefs.current.get(idx);
                        const isOverflow = el && el.scrollHeight > 300;
                        return isOverflow;
                      })()) ? '16px 16px 0 0' : '16px',
                    }}
                    ref={(el) => { if (el) messageContentRefs.current.set(idx, el); }}
                  >
                    {msg.content}
                    {!expandedMessages.has(idx) && (() => {
                      const el = messageContentRefs.current.get(idx);
                      return el && el.scrollHeight > 300;
                    })() && (
                        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#F0EEE7] dark:from-claude-btnHover to-transparent pointer-events-none" />
                      )}
                  </div>
                  {(() => {
                    const el = messageContentRefs.current.get(idx);
                    const isOverflow = el && el.scrollHeight > 300;
                    if (!isOverflow) return null;
                    return (
                      <div className="bg-[#F0EEE7] dark:bg-claude-btnHover rounded-b-2xl px-5 pb-3 pt-1 -mt-[1px] relative" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                        <button onClick={() => onToggleExpand(idx)} className="text-[13px] text-claude-textSecondary hover:text-claude-text transition-colors">
                          {expandedMessages.has(idx) ? 'Show less' : 'Show more'}
                        </button>
                      </div>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 pr-1">
                  {msg.created_at && (
                    <span className="text-[12px] text-claude-textSecondary mr-1">{formatMessageTime(msg.created_at)}</span>
                  )}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onResend(msg.content, idx)} className="p-1 text-claude-textSecondary hover:text-claude-text hover:bg-claude-hover rounded transition-colors" title="重新发送"><RotateCcw size={14} /></button>
                    <button onClick={() => onEdit(msg.content, idx)} className="p-1 text-claude-textSecondary hover:text-claude-text hover:bg-claude-hover rounded transition-colors" title="编辑"><Pencil size={14} /></button>
                    <button onClick={() => onCopy(msg.content, idx)} className="p-1 text-claude-textSecondary hover:text-claude-text hover:bg-claude-hover rounded transition-colors" title="复制">
                      {copiedMessageIdx === idx ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="px-1 text-claude-text text-[16px] leading-relaxed font-sans mt-2">
              {msg.thinking && (
                <div className="mb-4">
                  <div
                    className="flex items-center gap-2 cursor-pointer select-none group/think text-claude-textSecondary hover:text-claude-text transition-colors"
                    onClick={() => {
                      onSetMessages(prev =>
                        prev.map((m, i) =>
                          i === idx ? { ...m, isThinkingExpanded: !m.isThinkingExpanded } : m
                        )
                      );
                    }}
                  >
                    {msg.isThinking && (
                      <ClaudeLogo autoAnimate style={{ width: '30px', height: '30px' }} />
                    )}
                    <span className={`text-[14px] ${msg.isThinking ? 'animate-shimmer-text' : 'text-claude-text'}`}>
                      {(() => {
                        if (msg.thinking_summary) return msg.thinking_summary;
                        const text = (msg.thinking || '').trim();
                        const lines = text.split('\n').filter((l: string) => l.trim());
                        const last = lines[lines.length - 1] || '';
                        const summary = last.length > 40 ? last.slice(0, 40) + '...' : last;
                        return summary || 'Thinking...';
                      })()}
                    </span>
                    <ChevronDown size={14} className={`transform transition-transform duration-200 ${msg.isThinkingExpanded ? 'rotate-180' : ''}`} />
                  </div>
                  
                  {msg.isThinkingExpanded && (
                    <div className="mt-2 ml-1 pl-4 border-l-2 border-claude-border">
                      <div className="flex gap-3">
                        <div className="text-claude-textSecondary text-[14px] leading-relaxed whitespace-pre-wrap">
                          {msg.thinking}
                        </div>
                      </div>
                      {!msg.isThinking && (
                        <div className="flex items-center gap-2 mt-2 text-claude-textSecondary">
                          <Check size={16} />
                          <span className="text-[14px]">Done</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {msg.searchStatus && (!msg.searchLogs || msg.searchLogs.length === 0) && (
                <div className="flex items-center justify-center gap-2 text-[15px] font-medium mb-4 w-full">
                  <Globe size={18} className="text-[#6b7280]" />
                  <span className="animate-shimmer-text">
                    Searching the web
                  </span>
                </div>
              )}
              
              {msg.searchLogs && msg.searchLogs.length > 0 && (
                <SearchProcess logs={msg.searchLogs} isThinking={msg.isThinking} isDone={(msg.content || '').length > (msg._contentLenBeforeSearch || 0)} />
              )}

              <MarkdownRenderer content={msg.content} citations={msg.citations} />
              {msg.document && (
                <div className="mt-2 mb-1">
                  <DocumentCard document={msg.document} onOpen={(doc) => onOpenDocument?.(doc)} />
                </div>
              )}
              {loading && idx === messages.length - 1 && !msg.content && !msg.thinking && !msg.searchStatus && (
                <span className="inline-block ml-1 align-middle" style={{ verticalAlign: 'middle' }}>
                  <ClaudeLogo breathe style={{ width: '40px', height: '40px', display: 'inline-block' }} />
                </span>
              )}
              {loading && idx === messages.length - 1 && !msg.isThinking && (msg.content || (msg.searchStatus && msg.content)) && (
                <span className="inline-block ml-1 align-middle" style={{ verticalAlign: 'middle' }}>
                  <ClaudeLogo autoAnimate style={{ width: '40px', height: '40px', display: 'inline-block' }} />
                </span>
              )}
              {!loading && idx === messages.length - 1 && msg.content && (
                <span className="inline-flex items-center gap-2 ml-0.5 mt-3">
                  <ClaudeLogo autoAnimate={compactStatus.state === 'compacting'} style={{ width: '40px', height: '40px', display: 'inline-block' }} />
                  {compactStatus.state === 'compacting' && (
                    <div className="flex items-center gap-2">
                      <div className="w-48 h-1 bg-[#E5E5E5] rounded-full overflow-hidden">
                        <div className="h-full bg-[#D97757] rounded-full animate-[compactProgress_2s_ease-in-out_infinite]" />
                      </div>
                    </div>
                  )}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </>
  );
});

const MainContent = ({ onNewChat, resetKey, tunerConfig, onOpenDocument, onArtifactsUpdate, onOpenArtifacts, onTitleChange, onChatModeChange }: MainContentProps) => {
  const { id } = useParams(); // Get conversation ID from URL
  const location = useLocation();
  const [localId, setLocalId] = useState<string | null>(null);
  const [showEntranceAnimation, setShowEntranceAnimation] = useState(false);
  
  // Temporary Font Tuner State
  const [tempFontSize, setTempFontSize] = useState(46);
  const [tempFontWeight, setTempFontWeight] = useState(500);
  const [tempLetterSpacing, setTempLetterSpacing] = useState(-0.05);
  const [tempTextStroke, setTempTextStroke] = useState(0);
  const [tempFontFamily, setTempFontFamily] = useState('Optima');
  const [showFontTuner, setShowFontTuner] = useState(false);

  // Initialize from tunerConfig if available
  useEffect(() => {
    if (tunerConfig?.welcomeSize) {
      setTempFontSize(tunerConfig.welcomeSize);
    }
  }, [tunerConfig]);

  const FONT_FAMILIES = [
    'Spectral', // Default
    'Söhne',
    'Söhne Mono',
    'Inter',
    'system-ui',
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Roboto',
    'Helvetica Neue',
    'Arial',
    'sans-serif',
    'Georgia',
    'Times New Roman',
    'serif',
    'Courier New',
    'Courier',
    'monospace',
    'Verdana',
    'Tahoma',
    'Trebuchet MS',
    'Impact',
    'Gill Sans',
    'Optima',
    'American Typewriter',
    'Didot',
    'Copperplate',
    'Papyrus',
    'Brush Script MT',
    'Lucida Console',
    'Monaco',
    'Bradley Hand',
    'Luminari',
    'Chalkboard',
    'Comic Sans MS'
  ];

  // Use localId if we just created a chat, effectively overriding the lack of URL param until next true navigation
  const activeId = id || localId || null;

  const navigate = useNavigate();
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Notify parent about artifacts
  useEffect(() => {
    if (onArtifactsUpdate) {
      const docs = messages
        .filter((m: any) => m.document)
        .map((m: any) => m.document as DocumentInfo);
      onArtifactsUpdate(docs);
    }
  }, [messages, onArtifactsUpdate]);

  // Notify parent about Chat Mode and Title
  useEffect(() => {
    const isChat = !!(activeId || messages.length > 0);
    onChatModeChange?.(isChat);
  }, [activeId, messages.length, onChatModeChange]);



  // Model state defaults from user settings
  const getDefaultModel = () => localStorage.getItem('default_model') || 'claude-opus-4-6-thinking';
  const [currentModelString, setCurrentModelString] = useState(getDefaultModel);
  const [conversationTitle, setConversationTitle] = useState("");

  useEffect(() => {
    onTitleChange?.(conversationTitle);
  }, [conversationTitle, onTitleChange]);

  const [user, setUser] = useState<any>(null);

  // Welcome greeting — randomized per new chat, time-aware
  const welcomeGreeting = useMemo(() => {
    const hour = new Date().getHours();
    const name = user?.nickname || 'there';
    const timeGreetings = hour < 6
      ? [`Night owl mode, ${name}`, `Burning the midnight oil, ${name}?`, `Still up, ${name}?`]
      : hour < 12
        ? [`Good morning, ${name}`, `Morning, ${name}`, `Rise and shine, ${name}`]
        : hour < 18
          ? [`Good afternoon, ${name}`, `Hey there, ${name}`, `What's on your mind, ${name}?`]
          : [`Good evening, ${name}`, `Evening, ${name}`, `Winding down, ${name}?`];
    const general = [`What can I help with?`, `How can I help you today?`, `Let's get to work, ${name}`, `Ready when you are, ${name}`];
    const pool = [...timeGreetings, ...general];
    return pool[Math.floor(Math.random() * pool.length)];
  }, [resetKey, user?.nickname]);

  // 输入栏参数
  const inputBarWidth = 768;
  const inputBarMinHeight = 32;
  const inputBarRadius = 22;
  const inputBarBottom = 26;
  const inputBarBaseHeight = inputBarMinHeight + 16; // border-box: content + padding (pt-4=16px + pb-0=0px)
  const textareaHeightVal = useRef(inputBarBaseHeight);

  const isCreatingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastResetKeyRef = useRef(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const userScrolledUpRef = useRef(false);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set());
  const [copiedMessageIdx, setCopiedMessageIdx] = useState<number | null>(null);
  const [editingMessageIdx, setEditingMessageIdx] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const messageContentRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const plusBtnRef = useRef<HTMLButtonElement>(null);
  const [compactStatus, setCompactStatus] = useState<{ state: 'idle' | 'compacting' | 'done' | 'error'; message?: string }>({ state: 'idle' });
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null); // null = loading

  // 草稿持久化 refs（跟踪最新值，供 effect cleanup 读取）
  const inputTextRef = useRef(inputText);
  inputTextRef.current = inputText;
  const pendingFilesRef = useRef(pendingFiles);
  pendingFilesRef.current = pendingFiles;
  const textareaHeightRef = useRef(textareaHeightVal.current);
  textareaHeightRef.current = textareaHeightVal.current;

  // textarea 高度计算改为在 onChange 中直接操作 DOM（见 adjustTextareaHeight）
  const adjustTextareaHeight = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = `${inputBarBaseHeight}px`;
    const sh = el.scrollHeight;
    const newH = sh > inputBarBaseHeight ? Math.min(sh, 316) : inputBarBaseHeight;
    el.style.height = `${newH}px`;
    el.style.overflowY = newH >= 316 ? 'auto' : 'hidden';
    textareaHeightVal.current = newH;
  }, [inputBarBaseHeight]);

  useEffect(() => {
    // If we have a URL param ID, clear any local ID to ensure we sync with source of truth
    if (id) {
      setLocalId(null);
    }
  }, [id]);

  // 检测滚动条宽度
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const update = () => setScrollbarWidth(el.offsetWidth - el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [messages]);

  // 用户滚轮向上时，立刻中止自动滚动
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) {
        userScrolledUpRef.current = true;
        isAtBottomRef.current = false;
        // 取消正在进行的 smooth scroll 动画
        el.scrollTo({ top: el.scrollTop });
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: true });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // 点击外部关闭加号菜单
  useEffect(() => {
    if (!showPlusMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node) &&
        plusBtnRef.current && !plusBtnRef.current.contains(e.target as Node)) {
        setShowPlusMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPlusMenu]);

  // Reset when resetKey changes (New Chat clicked)
  useEffect(() => {
    if (resetKey && resetKey !== lastResetKeyRef.current) {
      lastResetKeyRef.current = resetKey;
      setLocalId(null);
      setMessages([]);
      setCurrentModelString(getDefaultModel());
      setConversationTitle("");
      // 触发入场动画
      setShowEntranceAnimation(true);
      setTimeout(() => setShowEntranceAnimation(false), 800);
      isAtBottomRef.current = true;
    }
  }, [resetKey]);

  // 草稿持久化：切换对话 / 打开设置页面时保存，切回时恢复
  const draftKey = activeId || '__new__';
  useEffect(() => {
    const saved = draftsStore.get(draftKey);
    if (saved) {
      setInputText(saved.text);
      setPendingFiles(saved.files);
      textareaHeightVal.current = saved.height;
      // Apply saved height to DOM
      if (inputRef.current) {
        inputRef.current.style.height = `${saved.height}px`;
        inputRef.current.style.overflowY = saved.height >= 316 ? 'auto' : 'hidden';
      }
      draftsStore.delete(draftKey);
    } else {
      setInputText('');
      setPendingFiles([]);
      textareaHeightVal.current = inputBarBaseHeight;
    }
    return () => {
      const text = inputTextRef.current;
      const files = pendingFilesRef.current;
      const height = textareaHeightRef.current;
      if (text.trim() || files.length > 0) {
        draftsStore.set(draftKey, { text, files, height });
      } else {
        draftsStore.delete(draftKey);
      }
    };
  }, [draftKey]);

  // 路由变化时也触发入场动画
  useEffect(() => {
    if (location.pathname === '/' || location.pathname === '') {
      setShowEntranceAnimation(true);
      setTimeout(() => setShowEntranceAnimation(false), 800);
    }
  }, [location.pathname]);

  useEffect(() => {
    setUser(getUser());
    // Check subscription status
    getUserUsage().then(usage => {
      const hasSub = !!(usage.plan && usage.plan.status === 'active');
      const hasQuota = usage.token_quota > 0 && usage.token_remaining > 0;
      setHasSubscription(hasSub || hasQuota);
    }).catch(() => setHasSubscription(false));
    // If we are currently creating/sending (optimistic), don't fetch/clear state yet
    if (activeId && !isCreatingRef.current) {
      loadConversation(activeId);
    } else if (!activeId) {
      setMessages([]);
      // Default model for new chat
      setCurrentModelString(getDefaultModel());
    }
    // New conversation -> force scroll to bottom
    if (activeId) isAtBottomRef.current = true;
  }, [activeId]);

  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom();
    }
  }, [messages]);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const isBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50;
      if (isBottom && userScrolledUpRef.current) {
        // 用户自己滚回了底部，重新启用自动滚动
        userScrolledUpRef.current = false;
      }
      if (!userScrolledUpRef.current) {
        isAtBottomRef.current = isBottom;
      }
    }
  };

  const scrollToBottom = () => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  };

  const loadConversation = async (conversationId: string) => {
    try {
      setLoading(true);
      const data = await getConversation(conversationId);
      setMessages(data.messages || []);
      if (data.model) {
        setCurrentModelString(data.model);
      }
      setConversationTitle(data.title || 'New Chat');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleModelChange = async (newModelString: string) => {
    setCurrentModelString(newModelString);

    // If in an existing conversation, we should update the conversation's model immediately
    if (activeId && !isCreatingRef.current) {
      try {
        await updateConversation(activeId, { model: newModelString });
      } catch (err) {
        console.error("Failed to update conversation model", err);
      }
    }
  };

  const handleSend = async () => {
    const hasFiles = pendingFiles.some(f => f.status === 'done');
    if ((!inputText.trim() && !hasFiles) || loading) return;
    const isUploading = pendingFiles.some(f => f.status === 'uploading');
    if (isUploading) return;

    const userMessageText = inputText;
    setInputText(""); // Clear input

    // 收集已上传的附件
    const uploadedFiles = pendingFiles.filter(f => f.status === 'done' && f.fileId);
    const attachmentsPayload = uploadedFiles.length > 0
      ? uploadedFiles.map(f => ({ fileId: f.fileId! }))
      : null;

    // 构建乐观 UI 的附件数据
    const optimisticAttachments = uploadedFiles.map(f => ({
      id: f.fileId!,
      file_type: f.fileType || 'text',
      file_name: f.fileName,
      mime_type: f.mimeType,
    }));

    // 清空 pendingFiles 并释放预览 URL
    pendingFiles.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
    setPendingFiles([]);
    draftsStore.delete(activeId || '__new__');

    // 重置 textarea 高度
    textareaHeightVal.current = inputBarBaseHeight;
    if (inputRef.current) {
      inputRef.current.style.height = `${inputBarBaseHeight}px`;
      inputRef.current.style.overflowY = 'hidden';
    }

    // Optimistic UI: Add user message immediately
    const tempUserMsg: any = { role: 'user', content: userMessageText, created_at: new Date().toISOString() };
    if (optimisticAttachments.length > 0) {
      tempUserMsg.has_attachments = 1;
      tempUserMsg.attachments = optimisticAttachments;
    }
    setMessages(prev => [...prev, tempUserMsg]);

    // Force scroll to bottom and track state
    isAtBottomRef.current = true;
    setTimeout(scrollToBottom, 50);

    // Prepare assistant message placeholder
    const assistantMsgIndex = messages.length + 1;
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    let conversationId = activeId;

    // If no ID, create conversation first
    if (!conversationId) {
      isCreatingRef.current = true; // Block useEffect fetch
      try {
        // 不传临时标题，让后端生成
        console.log("Creating conversation with model:", currentModelString);
        const newConv = await createConversation(undefined, currentModelString);
        console.log("Created conversation response:", newConv);

        if (!newConv || !newConv.id) {
          throw new Error("Invalid conversation response from server");
        }

        conversationId = newConv.id;
        console.log("New Conversation ID:", conversationId);

        // Use pushState to update URL without unmounting component
        window.history.pushState({}, '', `/chat/${conversationId}`);
        setLocalId(conversationId);
        setConversationTitle(newConv.title || 'New Chat');

        onNewChat(); // Refresh sidebar
      } catch (err: any) {
        console.error("Failed to create conversation", err);
        isCreatingRef.current = false;
        setMessages(prev => {
          const newMsgs = [...prev];
          // Find the last assistant message (placeholder) and update it
          if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === 'assistant') {
            newMsgs[newMsgs.length - 1].content = "Error: Failed to create conversation. " + (err.message || err);
          }
          return newMsgs;
        });
        return;
      }
    }

    // Call streaming API
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);
    await sendMessage(
      conversationId!,
      userMessageText,
      attachmentsPayload,
      (delta, full) => {
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastMsg = newMsgs[newMsgs.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.content = full;
            lastMsg.isThinking = false; // Switch to text mode
          }
          return newMsgs;
        });
      },
      (full) => {
        setLoading(false);
        isCreatingRef.current = false; // Reset flag
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastMsg = newMsgs[newMsgs.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.content = full;
            lastMsg.isThinking = false;
          }
          return newMsgs;
        });

        // Refresh conversation to get generated title (if any)
        // 标题生成是异步的，可能需要几秒钟，所以需要延迟轮询
        if (conversationId) {
          const refreshTitle = async () => {
            try {
              const data = await getConversation(conversationId);
              console.log('[MainContent] Polling title for', conversationId, ':', data?.title);
              if (data && data.title) {
                setConversationTitle(data.title);
                // 使用 CustomEvent 通知侧边栏刷新，避免触发 resetKey 变化
                window.dispatchEvent(new CustomEvent('conversationTitleUpdated'));
              }
            } catch (err) {
              console.error('[MainContent] Error polling title:', err);
            }
          };

          // 立即刷新一次
          refreshTitle();
          // 3秒后再刷新一次（此时标题生成应该已完成）
          setTimeout(refreshTitle, 3000);
          // 6秒后再刷新一次（备用）
          setTimeout(refreshTitle, 6000);
        }
      },
      (err) => {
        setLoading(false);
        isCreatingRef.current = false;
        setMessages(prev => {
          const newMsgs = [...prev];
          if (newMsgs[newMsgs.length - 1].role === 'assistant') {
            newMsgs[newMsgs.length - 1].content = "Error: " + err;
          }
          return newMsgs;
        });
      },
      (thinkingDelta, thinkingFull) => {
        // Handle thinking updates
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastMsg = newMsgs[newMsgs.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.thinking = thinkingFull;
            lastMsg.isThinking = true;
          }
          return newMsgs;
        });
      },
      (event, message) => {
        // Handle system/status events (e.g. web search status)
        if (event === 'status' && message) {
          setMessages(prev => {
            const newMsgs = [...prev];
            const lastMsg = newMsgs[newMsgs.length - 1];
            if (lastMsg.role === 'assistant') {
              lastMsg.searchStatus = message;
              lastMsg._contentLenBeforeSearch = (lastMsg.content || '').length;
            }
            return newMsgs;
          });
        }
        // Handle thinking summary
        if (event === 'thinking_summary' && message) {
          setMessages(prev => {
            const newMsgs = [...prev];
            const lastMsg = newMsgs[newMsgs.length - 1];
            if (lastMsg.role === 'assistant') {
              lastMsg.thinking_summary = message;
            }
            return newMsgs;
          });
        }
      },
      (sources, query) => {
        // Handle search_sources — collect citation sources
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastMsg = newMsgs[newMsgs.length - 1];
          if (lastMsg.role === 'assistant') {
            const existing = lastMsg.citations || [];
            
            // 去重合并
            const existingUrls = new Set(existing.map((s: any) => s.url));
            const newSources = sources.filter((s: any) => !existingUrls.has(s.url));
            lastMsg.citations = [...existing, ...newSources];
            
            if (query) {
              const logs = lastMsg.searchLogs || [];
              // 检查是否已存在相同的 query
              const existingLogIndex = logs.findIndex((log: any) => log.query === query);
              if (existingLogIndex !== -1) {
                // 更新现有 log 的 results
                const existingLog = logs[existingLogIndex];
                const currentResults = existingLog.results || [];
                const currentUrls = new Set(currentResults.map((r: any) => r.url));
                const uniqueNewResults = sources.filter((s: any) => !currentUrls.has(s.url));
                existingLog.results = [...currentResults, ...uniqueNewResults];
              } else {
                // 添加新 log
                logs.push({ query, results: sources });
              }
              lastMsg.searchLogs = logs;
            }
          }
          return newMsgs;
        });
      },
      (doc) => {
        // Handle document_created — store document on the assistant message
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastIdx = newMsgs.length - 1;
          if (newMsgs[lastIdx].role === 'assistant') {
            newMsgs[lastIdx] = { ...newMsgs[lastIdx], document: doc };
          }
          return newMsgs;
        });
      },
      controller.signal
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;

    const sendKey = localStorage.getItem('sendKey') || 'enter';
    // Normalize format (settings uses underscore, old might use plus)
    const sk = sendKey.replace('+', '_').toLowerCase();

    let shouldSend = false;
    if (sk === 'enter') {
      if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) shouldSend = true;
    } else if (sk === 'ctrl_enter') {
      if (e.ctrlKey) shouldSend = true;
    } else if (sk === 'cmd_enter') {
      if (e.metaKey) shouldSend = true;
    } else if (sk === 'alt_enter') {
      if (e.altKey) shouldSend = true;
    }

    if (shouldSend) {
      e.preventDefault();
      handleSend();
    }
  };

  // 停止生成
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    isCreatingRef.current = false;
  };

  // 复制消息内容
  // 复制消息内容
  const handleCopyMessage = (content: string, idx: number) => {
    copyToClipboard(content).then((success) => {
      if (success) {
        setCopiedMessageIdx(idx);
        setTimeout(() => setCopiedMessageIdx(null), 2000);
      }
    });
  };

  // 重新发送消息
  const handleResendMessage = async (content: string, idx: number) => {
    if (loading) return;
    const msg = messages[idx];
    // 删除当前消息及其后续消息（前端），然后重新添加用户消息 + assistant 占位
    setMessages(prev => [
      ...prev.slice(0, idx),
      { role: 'user', content, created_at: new Date().toISOString() },
      { role: 'assistant', content: '' },
    ]);
    // 删除后端消息
    if (activeId && msg.id) {
      try {
        await deleteMessagesFrom(activeId, msg.id);
      } catch (err) {
        console.error('Failed to delete messages from backend:', err);
      }
    }
    // 直接重新发送
    isAtBottomRef.current = true;
    setTimeout(scrollToBottom, 50);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);
    await sendMessage(
      activeId!,
      content,
      null,
      (delta, full) => {
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastMsg = newMsgs[newMsgs.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.content = full;
            lastMsg.isThinking = false;
          }
          return newMsgs;
        });
      },
      (full) => {
        setLoading(false);
        abortControllerRef.current = null;
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastMsg = newMsgs[newMsgs.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.content = full;
            lastMsg.isThinking = false;
          }
          return newMsgs;
        });
      },
      (err) => {
        setLoading(false);
        abortControllerRef.current = null;
        setMessages(prev => {
          const newMsgs = [...prev];
          if (newMsgs[newMsgs.length - 1].role === 'assistant') {
            newMsgs[newMsgs.length - 1].content = "Error: " + err;
          }
          return newMsgs;
        });
      },
      (thinkingDelta, thinkingFull) => {
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastMsg = newMsgs[newMsgs.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.thinking = thinkingFull;
            lastMsg.isThinking = true;
          }
          return newMsgs;
        });
      },
      (event, message) => {
        if (event === 'thinking_summary' && message) {
          setMessages(prev => {
            const newMsgs = [...prev];
            const lastMsg = newMsgs[newMsgs.length - 1];
            if (lastMsg.role === 'assistant') {
              lastMsg.thinking_summary = message;
            }
            return newMsgs;
          });
        }
      },
      undefined,
      undefined,
      controller.signal
    );
  };

  // 编辑消息 — 进入原地编辑模式（不立即删除后续消息）
  const handleEditMessage = (content: string, idx: number) => {
    if (loading) return;
    setEditingMessageIdx(idx);
    setEditingContent(content);
  };

  // 取消编辑
  const handleEditCancel = () => {
    setEditingMessageIdx(null);
    setEditingContent('');
  };

  // 保存编辑 — 删除当前及后续消息，用新内容重新发送
  const handleEditSave = async () => {
    if (editingMessageIdx === null || !editingContent.trim() || loading) return;
    const idx = editingMessageIdx;
    const msg = messages[idx];
    const newContent = editingContent.trim();

    // 退出编辑模式
    setEditingMessageIdx(null);
    setEditingContent('');

    // 删除当前消息及其后续消息（前端），同时加入新的用户消息和 assistant 占位
    setMessages(prev => [
      ...prev.slice(0, idx),
      { role: 'user', content: newContent, created_at: new Date().toISOString() },
      { role: 'assistant', content: '' },
    ]);

    // 删除后端消息
    if (activeId && msg.id) {
      try {
        await deleteMessagesFrom(activeId, msg.id);
      } catch (err) {
        console.error('Failed to delete messages from backend:', err);
      }
    }

    // 直接发送新内容
    isAtBottomRef.current = true;
    setTimeout(scrollToBottom, 50);

    const conversationId = activeId;
    if (!conversationId) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);
    await sendMessage(
      conversationId,
      newContent,
      null,
      (delta, full) => {
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastMsg = newMsgs[newMsgs.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.content = full;
            lastMsg.isThinking = false;
          }
          return newMsgs;
        });
      },
      (full) => {
        setLoading(false);
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastMsg = newMsgs[newMsgs.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.content = full;
            lastMsg.isThinking = false;
          }
          return newMsgs;
        });
      },
      (err) => {
        setLoading(false);
        setMessages(prev => {
          const newMsgs = [...prev];
          if (newMsgs[newMsgs.length - 1].role === 'assistant') {
            newMsgs[newMsgs.length - 1].content = "Error: " + err;
          }
          return newMsgs;
        });
      },
      (thinkingDelta, thinkingFull) => {
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastMsg = newMsgs[newMsgs.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.thinking = thinkingFull;
            lastMsg.isThinking = true;
          }
          return newMsgs;
        });
      },
      (event, message) => {
        if (event === 'thinking_summary' && message) {
          setMessages(prev => {
            const newMsgs = [...prev];
            const lastMsg = newMsgs[newMsgs.length - 1];
            if (lastMsg.role === 'assistant') {
              lastMsg.thinking_summary = message;
            }
            return newMsgs;
          });
        }
      },
      undefined,
      undefined,
      controller.signal
    );
  };

  // 切换消息展开/折叠
  const toggleMessageExpand = (idx: number) => {
    setExpandedMessages(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  // === 文件上传相关 ===
  const ACCEPTED_TYPES = 'image/png,image/jpeg,image/jpg,image/gif,image/webp,application/pdf,.docx,.xlsx,.pptx,.odt,.rtf,.epub,.txt,.md,.csv,.json,.xml,.yaml,.yml,.js,.jsx,.ts,.tsx,.py,.java,.cpp,.c,.h,.cs,.go,.rs,.rb,.php,.swift,.kt,.scala,.html,.css,.scss,.less,.sql,.sh,.bash,.vue,.svelte,.lua,.r,.m,.pl,.ex,.exs';

  const handleFilesSelected = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const maxFiles = 20;
    const currentCount = pendingFiles.length;
    const allowed = fileArray.slice(0, maxFiles - currentCount);

    for (const file of allowed) {
      const id = Math.random().toString(36).slice(2);
      const isImage = file.type.startsWith('image/');
      const previewUrl = isImage ? URL.createObjectURL(file) : undefined;

      const pending: PendingFile = {
        id,
        file,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        progress: 0,
        status: 'uploading',
        previewUrl,
      };

      setPendingFiles(prev => [...prev, pending]);

      uploadFile(file, (percent) => {
        setPendingFiles(prev => prev.map(f => f.id === id ? { ...f, progress: percent } : f));
      }).then((result) => {
        setPendingFiles(prev => prev.map(f => f.id === id ? {
          ...f,
          fileId: result.fileId,
          fileType: result.fileType,
          status: 'done' as const,
          progress: 100,
        } : f));
      }).catch((err) => {
        setPendingFiles(prev => prev.map(f => f.id === id ? {
          ...f,
          status: 'error' as const,
          error: err.message,
        } : f));
      });
    }
  };

  const handleRemoveFile = (id: string) => {
    setPendingFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
      // 已上传的文件调后端删除，释放存储空间
      if (file?.fileId) {
        deleteAttachment(file.fileId).catch(() => {});
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      handleFilesSelected(imageFiles);
    }
  };


  // --- Render Logic ---

  // MODE 1: Landing Page (No ID)
  if (!activeId && messages.length === 0) {
    return (
      <div className={`flex-1 bg-claude-bg h-screen flex flex-col relative overflow-hidden text-claude-text ${showEntranceAnimation ? 'animate-slide-in' : ''}`}>
        
        {/* Font Tuner Toggle Button */}
        <button
          onClick={() => setShowFontTuner(prev => !prev)}
          className="fixed top-4 right-4 z-50 p-2 text-claude-textSecondary hover:text-claude-text hover:bg-claude-hover rounded-lg transition-colors"
          title="Toggle Font Tuner"
        >
          <Ghost size={20} />
        </button>

        {/* Font Tuner (Debug) */}
        {showFontTuner && (
          <div className="fixed top-16 right-6 z-50 w-64 bg-white/95 dark:bg-gray-800/95 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl backdrop-blur-md p-5 transition-all animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Font Tuner</span>
              </div>
              <button 
                onClick={() => setShowFontTuner(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              {/* Font Family */}
              <div 
                className="group relative bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl p-3 cursor-ns-resize select-none transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                onWheel={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const delta = e.deltaY > 0 ? 1 : -1;
                  setTempFontFamily(prev => {
                    const idx = FONT_FAMILIES.indexOf(prev);
                    const nextIdx = (idx + delta + FONT_FAMILIES.length) % FONT_FAMILIES.length;
                    return FONT_FAMILIES[nextIdx];
                  });
                }}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide group-hover:text-orange-500 transition-colors">Font</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-60 transition-opacity">Scroll</span>
                    <ArrowUp size={12} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:-translate-y-0.5" />
                  </div>
                </div>
                <div className="text-base font-medium text-claude-text truncate" title={tempFontFamily}>
                  {tempFontFamily}
                </div>
              </div>

              {/* Other controls hidden as requested */}
            </div>
          </div>
        )}


        {/* Centered Content */}
        <div
          className="flex-1 flex flex-col items-center w-full mx-auto px-4 pl-12"
          style={{
            maxWidth: `${tunerConfig?.mainContentWidth || 768}px`,
            marginTop: `${tunerConfig?.mainContentMt || 0}px`,
            paddingTop: '40vh'
          }}
        >

          <div
            className="flex items-center gap-1"
            style={{ marginBottom: `${tunerConfig?.welcomeMb || 40}px` }}
          >
            <div className="w-[66px] h-[66px] flex items-center justify-center">
              <ClaudeLogo />
            </div>
            <h1
              className="text-claude-text tracking-tight leading-none pt-1 transition-all duration-100 ease-out whitespace-nowrap"
              style={{
                fontFamily: tempFontFamily,
                fontSize: `${tempFontSize}px`,
                fontWeight: tempFontWeight,
                letterSpacing: `${tempLetterSpacing}em`,
                WebkitTextStroke: `${tempTextStroke}px currentColor`,
              }}
            >
              {welcomeGreeting}
            </h1>
          </div>

          {/* 无套餐提示 */}
          {hasSubscription === false && (
            <div className="w-full max-w-md mb-6 bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-6 text-center">
              <h3 className="text-base font-semibold text-gray-800 mb-2">您当前没有可用套餐</h3>
              <p className="text-sm text-gray-500 mb-4">购买套餐后即可开始使用 AI 对话功能</p>
              <button
                onClick={() => {
                  // Navigate to upgrade page — trigger the onOpenUpgrade in parent Layout
                  window.dispatchEvent(new CustomEvent('open-upgrade'));
                }}
                className="px-6 py-2.5 bg-[#D97757] hover:bg-[#c4684b] text-white text-sm font-medium rounded-xl transition-colors"
              >
                购买套餐
              </button>
            </div>
          )}

          {/* 输入框区域 */}
          <div className={`w-full relative group ${hasSubscription === false ? 'opacity-40 pointer-events-none select-none' : ''}`}>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              multiple
              accept={ACCEPTED_TYPES}
              onChange={(e) => {
                if (e.target.files) handleFilesSelected(e.target.files);
                e.target.value = '';
              }}
            />
            <div
              className={`bg-claude-input border shadow-none hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:border-[#CCC] dark:hover:border-[#5a5a58] focus-within:shadow-[0_2px_8px_rgba(0,0,0,0.08)] focus-within:border-[#CCC] dark:focus-within:border-[#5a5a58] transition-all duration-200 flex flex-col max-h-[60vh] ${isDragging ? 'border-[#D97757] bg-orange-50/30' : 'border-claude-border dark:border-[#3a3a38]'}`}
              style={{ borderRadius: `${tunerConfig?.inputRadius || 16}px` }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex-1 overflow-y-auto min-h-0">
                <FileUploadPreview files={pendingFiles} onRemove={handleRemoveFile} />
                <textarea
                  ref={inputRef}
                  className="w-full px-4 pt-4 pb-2 text-claude-text placeholder:text-claude-textSecondary text-[16px] outline-none font-sans resize-none overflow-hidden bg-transparent"
                  style={{ minHeight: '72px', borderRadius: `${tunerConfig?.inputRadius || 16}px ${tunerConfig?.inputRadius || 16}px 0 0` }}
                  placeholder="How can I help you today?"
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 300) + 'px';
                    e.target.style.overflowY = e.target.scrollHeight > 300 ? 'auto' : 'hidden';
                  }}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                />
              </div>
              <div className="px-4 pb-3 pt-1 flex items-center justify-between flex-shrink-0">
                <div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-claude-textSecondary hover:text-claude-text hover:bg-claude-hover rounded-lg transition-colors"
                  >
                    <IconPlus size={20} />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <ModelSelector
                    currentModelString={currentModelString}
                    onModelChange={handleModelChange}
                    isNewChat={true}
                  />
                  <button
                    onClick={handleSend}
                    disabled={(!inputText.trim() && !pendingFiles.some(f => f.status === 'done')) || loading || pendingFiles.some(f => f.status === 'uploading')}
                    className="p-2 bg-[#D97757] text-white rounded-lg hover:bg-[#c4694a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ArrowUp size={22} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MODE 2: Chat Interface (Has ID or Messages)
  return (
    <div className="flex-1 bg-claude-bg h-full flex flex-col overflow-clip text-claude-text chat-root chat-font-scope">
      {/* Content area - positioning container for scroll + bottom bars */}
      <div className="flex-1 min-h-0 relative">
        <div
          className="absolute inset-0 overflow-y-auto chat-scroll"
          style={{ paddingBottom: '160px' }}
          ref={scrollContainerRef}
          onScroll={handleScroll}
        >
          <div
            className="w-full mx-auto px-4 py-8 pb-32"
            style={{ maxWidth: `${tunerConfig?.mainContentWidth || 768}px` }}
          >
            <MessageList
              messages={messages}
              loading={loading}
              expandedMessages={expandedMessages}
              editingMessageIdx={editingMessageIdx}
              editingContent={editingContent}
              copiedMessageIdx={copiedMessageIdx}
              compactStatus={compactStatus}
              onSetEditingContent={setEditingContent}
              onEditCancel={handleEditCancel}
              onEditSave={handleEditSave}
              onToggleExpand={toggleMessageExpand}
              onResend={handleResendMessage}
              onEdit={handleEditMessage}
              onCopy={handleCopyMessage}
              onOpenDocument={onOpenDocument}
              onSetMessages={setMessages}
              messageContentRefs={messageContentRefs}
            />
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 免责声明 - 固定在最底部 */}
        <div className="absolute bottom-0 left-0 z-10 bg-claude-bg text-center text-[12px] text-claude-textSecondary py-2 pointer-events-none" style={{ right: `${scrollbarWidth}px` }}>
          Claude is AI and can make mistakes. Please double-check responses.
        </div>

        {/* 输入框 - 浮动在内容上方，底部距离可调 */}
        {hasSubscription === false ? (
          <div className="absolute left-0 right-0 z-20" style={{ bottom: `${inputBarBottom + 28}px`, paddingLeft: '16px', paddingRight: `${16 + scrollbarWidth}px` }}>
            <div className="mx-auto" style={{ maxWidth: `${inputBarWidth}px` }}>
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-5 text-center">
                <p className="text-sm text-gray-600 mb-3">您当前没有可用套餐，无法发送消息</p>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('open-upgrade'))}
                  className="px-5 py-2 bg-[#D97757] hover:bg-[#c4684b] text-white text-sm font-medium rounded-xl transition-colors"
                >
                  购买套餐
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ bottom: `${inputBarBottom + 28}px`, paddingLeft: '16px', paddingRight: `${16 + scrollbarWidth}px` }}>
            <div
              className="mx-auto pointer-events-auto"
              style={{ maxWidth: `${inputBarWidth}px` }}
            >
              <div className="w-full relative group">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  multiple
                  accept={ACCEPTED_TYPES}
                  onChange={(e) => {
                    if (e.target.files) handleFilesSelected(e.target.files);
                    e.target.value = '';
                  }}
                />
                <div
                  className={`bg-claude-input border shadow-none hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:border-[#CCC] dark:hover:border-[#5a5a58] focus-within:shadow-[0_2px_8px_rgba(0,0,0,0.08)] focus-within:border-[#CCC] dark:focus-within:border-[#5a5a58] transition-all duration-200 flex flex-col ${isDragging ? 'border-[#D97757] bg-orange-50/30' : 'border-claude-border dark:border-[#3a3a38]'}`}
                  style={{ borderRadius: `${inputBarRadius}px` }}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <FileUploadPreview files={pendingFiles} onRemove={handleRemoveFile} />
                  <textarea
                    ref={inputRef}
                    className="w-full px-4 pt-4 pb-0 text-claude-text placeholder:text-claude-textSecondary text-[16px] outline-none font-sans resize-none bg-transparent"
                    style={{ height: `${inputBarBaseHeight}px`, minHeight: '16px', boxSizing: 'border-box', overflowY: 'hidden' }}
                    placeholder="How can I help you today?"
                    value={inputText}
                    onChange={(e) => {
                      setInputText(e.target.value);
                      adjustTextareaHeight();
                    }}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                  />
                  <div className="px-4 pb-3 pt-1 flex items-center justify-between">
                    <div className="relative">
                      <button
                        ref={plusBtnRef}
                        onClick={() => setShowPlusMenu(prev => !prev)}
                        className="p-2 text-claude-textSecondary hover:text-claude-text hover:bg-claude-hover rounded-lg transition-colors"
                      >
                        <IconPlus size={20} />
                      </button>
                      {showPlusMenu && (
                        <div
                          ref={plusMenuRef}
                          className="absolute bottom-full left-0 mb-2 w-[220px] bg-claude-input border border-claude-border rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.12)] py-1.5 z-50"
                        >
                          <button
                            onClick={() => {
                              setShowPlusMenu(false);
                              fileInputRef.current?.click();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-claude-text hover:bg-claude-hover transition-colors"
                          >
                            <Paperclip size={16} className="text-[#525252]" />
                            Add files or photos
                          </button>
                          <button
                            onClick={async () => {
                              setShowPlusMenu(false);
                              if (!activeId || compactStatus.state === 'compacting') return;
                              setCompactStatus({ state: 'compacting' });
                              try {
                                const result = await compactConversation(activeId);
                                await loadConversation(activeId);
                                setCompactStatus({ state: 'done', message: `Compacted ${result.messagesCompacted} messages, saved ~${result.tokensSaved} tokens` });
                                setTimeout(() => setCompactStatus({ state: 'idle' }), 4000);
                              } catch (err) {
                                console.error('Compact failed:', err);
                                setCompactStatus({ state: 'error', message: 'Compaction failed' });
                                setTimeout(() => setCompactStatus({ state: 'idle' }), 3000);
                              }
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-claude-text hover:bg-claude-hover transition-colors"
                          >
                            <ListCollapse size={16} className="text-claude-textSecondary" />
                            Compact conversation
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <ModelSelector
                        currentModelString={currentModelString}
                        onModelChange={handleModelChange}
                        isNewChat={false}
                        dropdownPosition="top"
                      />
                      {loading ? (
                        <button
                          onClick={handleStop}
                          className="p-2 bg-[#D97757] text-white rounded-lg hover:bg-[#c4694a] transition-colors"
                        >
                          <Square size={18} fill="white" strokeWidth={0} />
                        </button>
                      ) : (
                        <button
                          onClick={handleSend}
                          disabled={(!inputText.trim() && !pendingFiles.some(f => f.status === 'done')) || pendingFiles.some(f => f.status === 'uploading')}
                          className="p-2 bg-[#D97757] text-white rounded-lg hover:bg-[#c4694a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ArrowUp size={22} strokeWidth={2.5} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MainContent;