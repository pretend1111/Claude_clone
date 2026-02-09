import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { StarIcon } from './StarIcon';
import { IconPlus, IconVoice } from './Icons';
import { getConversation, sendMessage, createConversation, getUser } from '../api';
import MarkdownRenderer from './MarkdownRenderer';

interface MainContentProps {
  onNewChat: () => void; // Callback to tell sidebar to refresh
}

const MainContent = ({ onNewChat }: MainContentProps) => {
  const { id } = useParams(); // Get conversation ID from URL
  const navigate = useNavigate();
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const isCreatingRef = useRef(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setUser(getUser());
    // If we are currently creating/sending (optimistic), don't fetch/clear state yet
    if (id && !isCreatingRef.current) {
      loadConversation(id);
    } else if (!id) {
      setMessages([]);
    }
  }, [id]);

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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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

    let conversationId = id;

    // If no ID, create conversation first
    if (!conversationId) {
      isCreatingRef.current = true; // Block useEffect fetch
      try {
        const newConv = await createConversation(userMessageText.substring(0, 30));
        conversationId = newConv.id;
        navigate(`/chat/${conversationId}`, { replace: true });
        onNewChat(); // Refresh sidebar
      } catch (err) {
        console.error("Failed to create conversation", err);
        isCreatingRef.current = false;
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
          if (newMsgs[newMsgs.length - 1].role === 'assistant') {
             newMsgs[newMsgs.length - 1].content = full;
          }
          return newMsgs;
        });
      },
      (full) => {
        setLoading(false);
        isCreatingRef.current = false; // Reset flag
        setMessages(prev => {
          const newMsgs = [...prev];
          if (newMsgs[newMsgs.length - 1].role === 'assistant') {
             newMsgs[newMsgs.length - 1].content = full;
          }
          return newMsgs;
        });
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

  // Adjust textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [inputText]);


  // --- Render Logic ---

  // MODE 1: Landing Page (No ID)
  if (!id && messages.length === 0) {
    return (
      <div className="flex-1 bg-claude-bg h-screen flex flex-col relative overflow-hidden text-[#393939]">
        {/* Top Right Icon */}
        <div className="absolute top-4 right-5 z-10">
          <div className="w-8 h-8 rounded-full bg-[#EAE8E3] flex items-center justify-center text-[#525252] hover:bg-[#E2E0DB] transition-colors cursor-pointer text-sm font-medium">
             {user?.nickname?.charAt(0).toUpperCase() || 'S'}
          </div>
        </div>

        {/* Centered Content */}
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-[48rem] mx-auto px-4 -mt-8 pl-12">
          
          <div className="flex items-center gap-4 mb-10">
            <div className="text-claude-accent w-10 h-10 md:w-11 md:h-11 flex items-center justify-center">
              <StarIcon className="w-full h-full" />
            </div>
            <h1 className="font-serif-claude text-[32px] md:text-[38px] text-[#222] font-normal tracking-tight leading-none pt-1">
              {user ? `${user.nickname} is thinking` : 'Skeleton is thinking'}
            </h1>
          </div>

          <div className="w-full relative group">
            <div className="bg-white border border-[#E5E5E5] rounded-[16px] shadow-[0_2px_6px_rgba(0,0,0,0.015)] focus-within:shadow-[0_4px_16px_rgba(0,0,0,0.04)] focus-within:border-[#D1D1D1] transition-all duration-200 overflow-hidden">
              <textarea
                ref={textareaRef}
                className="w-full min-h-[120px] max-h-[400px] p-4 pr-12 text-[#2D2D2D] placeholder:text-[#949494] text-[17px] leading-relaxed resize-none outline-none font-sans"
                placeholder="How can I help you today?"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ paddingBottom: '3.5rem' }} 
              />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                 <div className="pointer-events-auto">
                   <button className="p-2 text-[#747474] hover:text-[#2D2D2D] hover:bg-black/5 rounded-lg transition-colors">
                      <IconPlus size={20} />
                   </button>
                </div>
                <div className="flex items-center gap-3 pointer-events-auto">
                   <button className="flex items-center gap-1.5 text-[13px] font-medium text-[#747474] hover:bg-black/5 px-2 py-1.5 rounded-md transition-colors">
                      <span>Opus 4.6</span>
                      <ChevronDown size={14} className="text-[#999]" />
                   </button>
                   <button className="p-2 text-[#747474] hover:bg-black/5 rounded-lg transition-colors">
                      <IconVoice size={20} />
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
       {/* Header for Chat Mode could go here if needed, but Claude usually keeps it clean */}
       
       <div className="flex-1 overflow-y-auto w-full">
         <div className="max-w-[48rem] mx-auto px-4 py-8 pb-32">
            {messages.map((msg, idx) => (
              <div key={idx} className="mb-8 group">
                {/* Role Label */}
                <div className="font-semibold text-[15px] mb-2 pl-1">
                  {msg.role === 'user' ? (user?.nickname || 'User') : 'Claude'}
                </div>
                
                {/* Message Content */}
                <div className="text-[#393939] leading-relaxed">
                   {msg.role === 'assistant' ? (
                     <MarkdownRenderer content={msg.content} />
                   ) : (
                     <div className="whitespace-pre-wrap">{msg.content}</div>
                   )}
                   {/* Cursor for streaming assistant */}
                   {msg.role === 'assistant' && loading && idx === messages.length - 1 && (
                     <span className="inline-block w-2 h-4 ml-1 bg-claude-accent animate-pulse align-middle"></span>
                   )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
         </div>
       </div>

       {/* Bottom Input Area */}
       <div className="w-full flex-shrink-0 bg-claude-bg pt-2 pb-6 px-4 z-20">
          <div className="max-w-[48rem] mx-auto">
            <div className="bg-white border border-[#E5E5E5] rounded-[16px] shadow-[0_2px_6px_rgba(0,0,0,0.015)] focus-within:shadow-[0_4px_16px_rgba(0,0,0,0.04)] focus-within:border-[#D1D1D1] transition-all duration-200 overflow-hidden relative">
              <textarea
                ref={textareaRef}
                className="w-full max-h-[200px] p-3 pl-4 pr-12 text-[#2D2D2D] placeholder:text-[#949494] text-[16px] leading-relaxed resize-none outline-none font-sans"
                placeholder="Reply to Claude..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                style={{ paddingRight: '40px' }}
              />
               <button 
                  onClick={handleSend}
                  disabled={loading || !inputText.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-[#CC7C5E] text-white rounded-md hover:bg-[#B96B4E] transition-colors disabled:opacity-50 disabled:bg-gray-300"
                >
                  <IconPlus size={16} className="rotate-90 transform" /> 
                </button>
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