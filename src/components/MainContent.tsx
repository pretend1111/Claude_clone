import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, FileText, ArrowUp } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { StarIcon } from './StarIcon';
import { IconPlus, IconVoice, IconPencil } from './Icons';
import { getConversation, sendMessage, createConversation, getUser, updateConversation } from '../api';
import MarkdownRenderer from './MarkdownRenderer';
import ModelSelector from './ModelSelector';

interface MainContentProps {
  onNewChat: () => void; // Callback to tell sidebar to refresh
  resetKey?: number;
  tunerConfig?: any;
}

const MainContent = ({ onNewChat, resetKey, tunerConfig }: MainContentProps) => {
  const { id } = useParams(); // Get conversation ID from URL
  const [localId, setLocalId] = useState<string | null>(null);

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

  const isCreatingRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // If we have a URL param ID, clear any local ID to ensure we sync with source of truth
    if (id) {
      setLocalId(null);
    }
  }, [id]);

  // Reset when resetKey changes (New Chat clicked)
  useEffect(() => {
    if (resetKey && resetKey > 0) {
      setLocalId(null);
      setMessages([]);
      setInputText("");
      setCurrentModelString('claude-opus-4-6-thinking');
      // Ensure visual URL is clean
      window.history.pushState({}, '', '/');
    }
  }, [resetKey]);

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
  }, [activeId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
    if (!inputText.trim() || loading) return;

    const userMessageText = inputText;
    setInputText(""); // Clear input

    // Optimistic UI: Add user message immediately
    const tempUserMsg = { role: 'user', content: userMessageText };
    setMessages(prev => [...prev, tempUserMsg]);

    // Prepare assistant message placeholder
    const assistantMsgIndex = messages.length + 1;
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    let conversationId = activeId;

    // If no ID, create conversation first
    if (!conversationId) {
      isCreatingRef.current = true; // Block useEffect fetch
      try {
        // Pass the title and the current selected model
        console.log("Creating conversation with model:", currentModelString);
        const newConv = await createConversation(userMessageText.substring(0, 30), currentModelString);
        console.log("Created conversation response:", newConv);

        if (!newConv || !newConv.id) {
          throw new Error("Invalid conversation response from server");
        }

        conversationId = newConv.id;
        console.log("New Conversation ID:", conversationId);

        // Use pushState to update URL without unmounting component
        window.history.pushState({}, '', `/chat/${conversationId}`);
        setLocalId(conversationId);
        setConversationTitle(newConv.title || userMessageText.substring(0, 30));

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
    setLoading(true);
    await sendMessage(
      conversationId!,
      userMessageText,
      null,
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
        if (conversationId) {
          getConversation(conversationId).then(data => {
            if (data && data.title) {
              setConversationTitle(data.title);
              onNewChat(); // Refresh sidebar too to show new title
            }
          }).catch(console.error);
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
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };


  // --- Render Logic ---

  // MODE 1: Landing Page (No ID)
  if (!activeId && messages.length === 0) {
    return (
      <div className="flex-1 bg-claude-bg h-screen flex flex-col relative overflow-hidden text-[#393939]">
        {/* Top Right Icon */}
        <div className="absolute top-4 right-5 z-10">
          <div className="w-8 h-8 rounded-full bg-[#EAE8E3] flex items-center justify-center text-[#525252] hover:bg-[#E2E0DB] transition-colors cursor-pointer text-sm font-medium">
            {user?.nickname?.charAt(0).toUpperCase() || 'S'}
          </div>
        </div>

        {/* Centered Content */}
        <div
          className="flex-1 flex flex-col items-center justify-center w-full mx-auto px-4 -mt-8 pl-12"
          style={{
            maxWidth: `${tunerConfig?.mainContentWidth || 768}px`,
            marginTop: `${tunerConfig?.mainContentMt || 0}px` // vertical pos adjustment
          }}
        >

          <div
            className="flex items-center gap-4"
            style={{ marginBottom: `${tunerConfig?.welcomeMb || 40}px` }}
          >
            <div className="text-claude-accent w-10 h-10 md:w-11 md:h-11 flex items-center justify-center">
              <StarIcon className="w-full h-full" />
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
            <div
              className="bg-white border border-[#D1D1D1] shadow-[0_2px_6px_rgba(0,0,0,0.08)] focus-within:shadow-[0_4px_12px_rgba(0,0,0,0.12)] focus-within:border-[#999] transition-all duration-200 overflow-hidden"
              style={{ borderRadius: `${tunerConfig?.inputRadius || 16}px` }}
            >
              <input
                ref={inputRef}
                type="text"
                className="w-full h-32 px-4 text-[#111] placeholder:text-[#949494] text-[16px] outline-none font-sans"
                style={{ paddingBottom: '3.5rem' }}
                placeholder="How can I help you today?"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                <div className="pointer-events-auto">
                  <button className="p-2 text-[#747474] hover:text-[#2D2D2D] hover:bg-black/5 rounded-lg transition-colors">
                    <IconPlus size={20} />
                  </button>
                </div>
                <div className="flex items-center gap-3 pointer-events-auto">
                  <ModelSelector
                    currentModelString={currentModelString}
                    onModelChange={handleModelChange}
                    isNewChat={true}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputText.trim() || loading}
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
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#E5E5E5]/60 bg-claude-bg sticky top-0 z-30 h-12">
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

      <div className="flex-1 overflow-y-auto w-full">
        <div
          className="w-full mx-auto px-4 py-8 pb-32"
          style={{ maxWidth: `${tunerConfig?.mainContentWidth || 768}px` }}
        >
          {messages.map((msg, idx) => (
            <div key={idx} className="mb-6 group">
              {msg.role === 'user' ? (
                // User Message
                <div className="max-w-[70%] w-fit ml-auto bg-[#F0EEE7] text-[#2D2D2D] rounded-2xl px-5 py-3.5 text-[16px] leading-relaxed font-sans whitespace-pre-wrap break-words">
                  {msg.content}
                </div>
              ) : (
                // Assistant Message
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

                  <MarkdownRenderer content={msg.content} />

                  {/* Cursor for streaming assistant */}
                  {loading && idx === messages.length - 1 && !msg.isThinking && (
                    <span className="inline-block w-2 h-4 ml-1 bg-claude-accent animate-pulse align-middle"></span>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Bottom Input Area */}
      <div className="w-full flex-shrink-0 bg-claude-bg pt-2 pb-6 px-4 z-20">
        <div
          className="mx-auto"
          style={{ maxWidth: `${tunerConfig?.mainContentWidth || 768}px` }}
        >
          {/* 输入框区域 */}
          <div className="w-full relative group">
            <div
              className="bg-white border border-[#D1D1D1] shadow-[0_2px_6px_rgba(0,0,0,0.08)] focus-within:shadow-[0_4px_12px_rgba(0,0,0,0.12)] focus-within:border-[#999] transition-all duration-200 overflow-hidden"
              style={{ borderRadius: `${tunerConfig?.inputRadius || 16}px` }}
            >
              <input
                ref={inputRef}
                type="text"
                className="w-full h-24 px-4 text-[#111] placeholder:text-[#949494] text-[16px] outline-none font-sans"
                style={{ paddingBottom: '3.5rem' }}
                placeholder="How can I help you today?"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                <div className="pointer-events-auto">
                  <button className="p-2 text-[#747474] hover:text-[#2D2D2D] hover:bg-black/5 rounded-lg transition-colors">
                    <IconPlus size={20} />
                  </button>
                </div>
                <div className="flex items-center gap-3 pointer-events-auto">
                  <ModelSelector
                    currentModelString={currentModelString}
                    onModelChange={handleModelChange}
                    isNewChat={false}
                    dropdownPosition="top"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputText.trim() || loading}
                    className="p-2 bg-[#D97757] text-white rounded-lg hover:bg-[#c4694a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ArrowUp size={22} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center text-[11px] text-[#999] mt-2">
            Claude can make mistakes. Please use with caution.
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainContent;