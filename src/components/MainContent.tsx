import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, FileText, ArrowUp, RotateCcw, Pencil, Copy, Check, Square } from 'lucide-react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { IconPlus, IconVoice, IconPencil } from './Icons';
import ClaudeLogo from './ClaudeLogo';
import { getConversation, sendMessage, createConversation, getUser, updateConversation, deleteMessagesFrom, uploadFile } from '../api';
import MarkdownRenderer from './MarkdownRenderer';
import ModelSelector from './ModelSelector';
import FileUploadPreview, { PendingFile } from './FileUploadPreview';
import MessageAttachments from './MessageAttachments';

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
}

const MainContent = ({ onNewChat, resetKey, tunerConfig }: MainContentProps) => {
  const { id } = useParams(); // Get conversation ID from URL
  const location = useLocation();
  const [localId, setLocalId] = useState<string | null>(null);
  const [showEntranceAnimation, setShowEntranceAnimation] = useState(false);

  // Use localId if we just created a chat, effectively overriding the lack of URL param until next true navigation
  const activeId = id || localId || null;

  const navigate = useNavigate();
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Model state defaults to Opus 4.6 Thinking
  const [currentModelString, setCurrentModelString] = useState('claude-opus-4-6-thinking');
  const [conversationTitle, setConversationTitle] = useState("");

  // 输入栏参数
  const inputBarWidth = 768;
  const inputBarMinHeight = 32;
  const inputBarRadius = 22;
  const inputBarBottom = 26;

  const isCreatingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastResetKeyRef = useRef(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set());
  const [copiedMessageIdx, setCopiedMessageIdx] = useState<number | null>(null);
  const [editingMessageIdx, setEditingMessageIdx] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const messageContentRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

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

  // Reset when resetKey changes (New Chat clicked)
  // Only reset if we're not already on a clean state (no activeId)
  useEffect(() => {
    if (resetKey && resetKey !== lastResetKeyRef.current) {
      lastResetKeyRef.current = resetKey;
      // Only clear if we're NOT on a conversation page
      if (!activeId) {
        setLocalId(null);
        setMessages([]);
        setInputText("");
        setCurrentModelString('claude-opus-4-6-thinking');
        // 觓发入场动画
        setShowEntranceAnimation(true);
        setTimeout(() => setShowEntranceAnimation(false), 800);
        isAtBottomRef.current = true;
      }
    }
  }, [resetKey, activeId]);

  // 路由变化时也触发入场动画
  useEffect(() => {
    if (location.pathname === '/' || location.pathname === '') {
      setShowEntranceAnimation(true);
      setTimeout(() => setShowEntranceAnimation(false), 800);
    }
  }, [location.pathname]);

  useEffect(() => {
    setUser(getUser());
    // If we are currently creating/sending (optimistic), don't fetch/clear state yet
    if (activeId && !isCreatingRef.current) {
      loadConversation(activeId);
    } else if (!activeId) {
      setMessages([]);
      // Default model for new chat
      setCurrentModelString('claude-opus-4-6-thinking');
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
      // Using 50px threshold.
      // Note: scrollHeight - scrollTop === clientHeight when fully parsed.
      // Use small threshold to allow for minor discrepancies.
      const isBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50;
      isAtBottomRef.current = isBottom;
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

    // 重置 textarea 高度
    if (inputRef.current) {
      inputRef.current.style.height = `${inputBarMinHeight}px`;
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
            }
            return newMsgs;
          });
        }
      },
      (sources) => {
        // Handle search_sources — collect citation sources
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastMsg = newMsgs[newMsgs.length - 1];
          if (lastMsg.role === 'assistant') {
            const existing = lastMsg.citations || [];
            lastMsg.citations = [...existing, ...sources];
          }
          return newMsgs;
        });
      },
      controller.signal
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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
  const handleCopyMessage = (content: string, idx: number) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageIdx(idx);
    setTimeout(() => setCopiedMessageIdx(null), 2000);
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

    // 删除当前消息及其后续消息（前端）
    setMessages(prev => prev.slice(0, idx));

    // 删除后端消息
    if (activeId && msg.id) {
      try {
        await deleteMessagesFrom(activeId, msg.id);
      } catch (err) {
        console.error('Failed to delete messages from backend:', err);
      }
    }

    // 将新内容填入输入框，让用户按 Enter 发送
    setInputText(newContent);
    inputRef.current?.focus();
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
    const maxFiles = 5;
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
      <div className={`flex-1 bg-claude-bg h-screen flex flex-col relative overflow-hidden text-[#393939] ${showEntranceAnimation ? 'animate-slide-in' : ''}`}>
        {/* Top Right Icon */}
        <div className="absolute top-4 right-5 z-10">
          <div className="w-8 h-8 rounded-full bg-[#EAE8E3] flex items-center justify-center text-[#525252] hover:bg-[#E2E0DB] transition-colors cursor-pointer text-sm font-medium">
            {user?.nickname?.charAt(0).toUpperCase() || 'S'}
          </div>
        </div>

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
              className="font-serif-claude text-[#222] font-normal tracking-tight leading-none pt-1"
              style={{ fontSize: `${tunerConfig?.welcomeSize || 32}px` }}
            >
              {user ? `Hello, ${user.nickname}` : 'Hello, night owl'}
            </h1>
          </div>

          {/* 输入框区域 */}
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
              className={`bg-white border shadow-none hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:border-[#D1D1D1] focus-within:shadow-[0_2px_8px_rgba(0,0,0,0.08)] focus-within:border-[#D1D1D1] transition-all duration-200 flex flex-col ${isDragging ? 'border-[#D97757] bg-orange-50/30' : 'border-[#E8E7E3]'}`}
              style={{ borderRadius: `${tunerConfig?.inputRadius || 16}px` }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <FileUploadPreview files={pendingFiles} onRemove={handleRemoveFile} />
              <textarea
                ref={inputRef}
                className="w-full px-4 pt-4 pb-2 text-[#111] placeholder:text-[#949494] text-[16px] outline-none font-sans resize-none overflow-hidden"
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
              <div className="px-4 pb-3 pt-1 flex items-center justify-between">
                <div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-[#747474] hover:text-[#2D2D2D] hover:bg-black/5 rounded-lg transition-colors"
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
    <div className="flex-1 bg-claude-bg h-screen flex flex-col relative overflow-hidden text-[#393939]">
      {/* Header for Chat Mode */}
      <div className="flex items-center justify-between px-3 py-2 bg-claude-bg sticky top-0 z-30 h-12">
        <button className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-[#EAE8E3] rounded-md transition-colors text-[14px] font-medium text-[#393939] max-w-[60%] -ml-1">
          <span className="truncate">{conversationTitle || 'New Chat'}</span>
          <ChevronDown size={14} className="text-[#999]" />
        </button>

        <div className="flex items-center gap-1">
          <button className="w-8 h-8 flex items-center justify-center text-[#5e5e5e] hover:bg-[#EAE8E3] rounded-md transition-colors">
            <FileText size={18} strokeWidth={1.5} />
          </button>
          <button className="px-3 py-1.5 text-[13px] font-medium text-[#5e5e5e] hover:bg-[#EAE8E3] rounded-md transition-colors border border-transparent hover:border-[#D1D1D1]/50">
            Share
          </button>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto w-full"
        style={{ paddingBottom: '160px' }}
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        <div
          className="w-full mx-auto px-4 py-8 pb-32"
          style={{ maxWidth: `${tunerConfig?.mainContentWidth || 768}px` }}
        >
          {messages.map((msg, idx) => (
            <div key={idx} className="mb-6 group">
              {msg.role === 'user' ? (
                editingMessageIdx === idx ? (
                  // User Message — 编辑模式（全宽）
                  <div className="w-full">
                    <div className="bg-[#F0EEE7] rounded-2xl px-5 py-3.5 text-[16px] leading-relaxed font-sans">
                      <textarea
                        className="w-full bg-transparent text-[#2D2D2D] outline-none resize-none font-sans text-[16px] leading-relaxed"
                        value={editingContent}
                        onChange={(e) => {
                          setEditingContent(e.target.value);
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') handleEditCancel();
                        }}
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
                      <span className="text-[13px] text-[#999]">
                        Submitting will replace this response and all following messages
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleEditCancel}
                          className="px-4 py-1.5 text-[13px] font-medium text-[#555] bg-[#E8E7E3] hover:bg-[#DDDCD8] rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleEditSave}
                          disabled={!editingContent.trim()}
                          className="px-4 py-1.5 text-[13px] font-medium text-white bg-[#D97757] hover:bg-[#c4694a] rounded-lg transition-colors disabled:opacity-40"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // User Message — 普通模式
                  <div className="flex flex-col items-end">
                    {/* 附件展示 */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="max-w-[85%] w-fit mb-1">
                        <MessageAttachments attachments={msg.attachments} />
                      </div>
                    )}
                    {/* 消息气泡 */}
                    <div className="max-w-[85%] w-fit relative">
                      <div
                        className="bg-[#F0EEE7] text-[#2D2D2D] px-5 py-3.5 text-[16px] leading-relaxed font-sans whitespace-pre-wrap break-words relative overflow-hidden"
                        style={{
                          maxHeight: expandedMessages.has(idx) ? 'none' : '300px',
                          borderRadius: ((() => {
                            const el = messageContentRefs.current.get(idx);
                            const isOverflow = el && el.scrollHeight > 300;
                            return isOverflow;
                          })()) ? '16px 16px 0 0' : '16px',
                        }}
                        ref={(el) => {
                          if (el) messageContentRefs.current.set(idx, el);
                        }}
                      >
                        {msg.content}
                        {/* 渐变遮罩 - 仅在内容超出且未展开时显示 */}
                        {!expandedMessages.has(idx) && (() => {
                          const el = messageContentRefs.current.get(idx);
                          return el && el.scrollHeight > 300;
                        })() && (
                            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#F0EEE7] to-transparent pointer-events-none" />
                          )}
                      </div>
                      {/* Show More / Show Less 纯色底栏 - 气泡延伸部分 */}
                      {(() => {
                        const el = messageContentRefs.current.get(idx);
                        const isOverflow = el && el.scrollHeight > 300;
                        if (!isOverflow) return null;
                        return (
                          <div className="bg-[#F0EEE7] rounded-b-2xl px-5 pb-3 pt-1 -mt-[1px] relative" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                            <button
                              onClick={() => toggleMessageExpand(idx)}
                              className="text-[13px] text-[#999] hover:text-[#666] transition-colors"
                            >
                              {expandedMessages.has(idx) ? 'Show less' : 'Show more'}
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                    {/* 操作栏：时间戳 + 按钮 */}
                    <div className="flex items-center gap-1.5 mt-1.5 pr-1">
                      {msg.created_at && (
                        <span className="text-[12px] text-[#999] mr-1">
                          {formatMessageTime(msg.created_at)}
                        </span>
                      )}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleResendMessage(msg.content, idx)}
                          className="p-1 text-[#999] hover:text-[#555] hover:bg-black/5 rounded transition-colors"
                          title="重新发送"
                        >
                          <RotateCcw size={14} />
                        </button>
                        <button
                          onClick={() => handleEditMessage(msg.content, idx)}
                          className="p-1 text-[#999] hover:text-[#555] hover:bg-black/5 rounded transition-colors"
                          title="编辑"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleCopyMessage(msg.content, idx)}
                          className="p-1 text-[#999] hover:text-[#555] hover:bg-black/5 rounded transition-colors"
                          title="复制"
                        >
                          {copiedMessageIdx === idx ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className="px-1 text-[#2D2D2D] text-[16px] leading-relaxed font-sans mt-2">
                  {/* Thinking Block */}
                  {msg.thinking && (
                    <div className="mb-3">
                      <div className="bg-[#FAF9F5] border border-[#E5E5E5] rounded-lg overflow-hidden">
                        <div
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[#F2F0EB] transition-colors select-none"
                          onClick={() => {
                            // Toggle expand logic - requires state update
                            setMessages(prev => {
                              const newMsgs = [...prev];
                              newMsgs[idx].isThinkingExpanded = !newMsgs[idx].isThinkingExpanded;
                              return newMsgs;
                            });
                          }}
                        >
                          <ChevronDown
                            size={14}
                            className={`text-[#9CA3AF] transform transition-transform ${msg.isThinkingExpanded ? 'rotate-180' : '-rotate-90'}`}
                          />
                          <span className="text-[13px] font-medium text-[#6B7280]">
                            {msg.isThinking ? "Thinking Process..." : "Thinking Process"}
                          </span>
                          {msg.isThinking && (
                            <span className="inline-block w-2 h-4 ml-auto text-claude-accent animate-pulse font-bold">•</span>
                          )}
                        </div>

                        {(msg.isThinkingExpanded || msg.isThinking) && (
                          <div className="px-4 py-3 border-t border-[#E5E5E5] bg-[#FAF9F5] text-[#6B7280] text-[14px] leading-relaxed font-mono whitespace-pre-wrap relative">
                            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#D4A574] opacity-50"></div>
                            {msg.thinking}
                            {msg.isThinking && <span className="animate-pulse">_</span>}
                          </div>
                        )}
                      </div>
                      {!msg.isThinking && !msg.isThinkingExpanded && (
                        <div className="ml-2 pl-2 border-l-2 border-[#E5E5E5] text-[12px] text-[#9CA3AF] py-1 cursor-pointer hover:text-[#6B7280]" onClick={() => {
                          setMessages(prev => {
                            const newMsgs = [...prev];
                            newMsgs[idx].isThinkingExpanded = true;
                            return newMsgs;
                          });
                        }}>
                          Click to view thinking content
                        </div>
                      )}
                    </div>
                  )}

                  {/* Search Status */}
                  {msg.searchStatus && !msg.content && (
                    <div className="flex items-center gap-2 text-[13px] text-[#6B7280] mb-2">
                      <span className="inline-block w-3 h-3 border-2 border-[#D97757] border-t-transparent rounded-full animate-spin"></span>
                      {msg.searchStatus}
                    </div>
                  )}

                  <MarkdownRenderer content={msg.content} citations={msg.citations} />

                  {/* 等待响应中 — 呼吸动画 */}
                  {loading && idx === messages.length - 1 && !msg.content && !msg.thinking && !msg.searchStatus && (
                    <span className="inline-block ml-1 align-middle" style={{ verticalAlign: 'middle' }}>
                      <ClaudeLogo
                        breathe
                        style={{ width: '40px', height: '40px', display: 'inline-block' }}
                      />
                    </span>
                  )}

                  {/* 流式输出中 — 转圈动画 */}
                  {loading && idx === messages.length - 1 && (msg.content || msg.thinking || msg.searchStatus) && (
                    <span className="inline-block ml-1 align-middle" style={{ verticalAlign: 'middle' }}>
                      <ClaudeLogo
                        autoAnimate
                        style={{ width: '40px', height: '40px', display: 'inline-block' }}
                      />
                    </span>
                  )}
                  {/* 回答结束后 — 静态图标（仅最后一条 assistant 消息） */}
                  {!loading && idx === messages.length - 1 && msg.content && (
                    <span className="inline-block ml-0.5 mt-3">
                      <ClaudeLogo
                        style={{ width: '40px', height: '40px', display: 'inline-block' }}
                      />
                    </span>
                  )}

                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 免责声明 - 固定在最底部 */}
      <div className="absolute bottom-0 left-0 z-10 bg-claude-bg text-center text-[12px] text-[#777] py-2 pointer-events-none" style={{ right: `${scrollbarWidth}px` }}>
        Claude is AI and can make mistakes. Please double-check responses.
      </div>

      {/* 输入框 - 浮动在内容上方，底部距离可调 */}
      <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ bottom: `${inputBarBottom + 28}px`, paddingLeft: '16px', paddingRight: `${16 + scrollbarWidth}px` }}>
        <div
          className="mx-auto pointer-events-auto"
          style={{ maxWidth: `${inputBarWidth}px` }}
        >
          <div className="w-full relative group">
            <div
              className={`bg-white border shadow-none hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:border-[#D1D1D1] focus-within:shadow-[0_2px_8px_rgba(0,0,0,0.08)] focus-within:border-[#D1D1D1] transition-all duration-200 flex flex-col ${isDragging ? 'border-[#D97757] bg-orange-50/30' : 'border-[#E8E7E3]'}`}
              style={{ borderRadius: `${inputBarRadius}px` }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <FileUploadPreview files={pendingFiles} onRemove={handleRemoveFile} />
              <textarea
                ref={inputRef}
                className="w-full px-4 pt-3 pb-1 text-[#111] placeholder:text-[#949494] text-[16px] outline-none font-sans resize-none overflow-hidden bg-transparent"
                style={{ height: `${inputBarMinHeight}px`, minHeight: '16px', boxSizing: 'content-box' }}
                placeholder="How can I help you today?"
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  // content-box 下 scrollHeight 包含 padding (pt-3=12px, pb-1=4px = 16px)
                  const padding = 16;
                  e.target.style.height = `${inputBarMinHeight}px`;
                  const contentHeight = e.target.scrollHeight - padding;
                  if (contentHeight > inputBarMinHeight) {
                    const newH = Math.min(contentHeight, 300);
                    e.target.style.height = newH + 'px';
                    e.target.style.overflowY = contentHeight > 300 ? 'auto' : 'hidden';
                  }
                }}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
              />
              <div className="px-4 pb-3 pt-1 flex items-center justify-between">
                <div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-[#747474] hover:text-[#2D2D2D] hover:bg-black/5 rounded-lg transition-colors"
                  >
                    <IconPlus size={20} />
                  </button>
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
    </div>
  );
};

export default MainContent;