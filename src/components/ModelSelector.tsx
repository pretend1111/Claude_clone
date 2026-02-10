import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';

interface ModelDef {
  id: string; // Internal ID like 'opus-4.6'
  name: string; // Display name 'Opus 4.6'
  desc: string;
  baseValue: string; // 'claude-opus-4-6'
  thinkingValue: string; // 'claude-opus-4-6-thinking'
}

const MODELS: ModelDef[] = [
  { 
    id: 'opus-4.6', 
    name: 'Opus 4.6', 
    desc: 'Most capable for ambitious work', 
    baseValue: 'claude-opus-4-6',
    thinkingValue: 'claude-opus-4-6-thinking'
  },
  { 
    id: 'sonnet-4.5', 
    name: 'Sonnet 4.5', 
    desc: 'Best for everyday tasks', 
    baseValue: 'claude-sonnet-4-5-20250929', 
    thinkingValue: 'claude-sonnet-4-5-20250929-thinking'
  },
  { 
    id: 'haiku-4.5', 
    name: 'Haiku 4.5', 
    desc: 'Fastest for quick answers', 
    baseValue: 'claude-haiku-4-5-20251001', 
    thinkingValue: 'claude-haiku-4-5-20251001-thinking'
  }
];

const MORE_MODELS: ModelDef[] = [
  {
    id: 'opus-4.5',
    name: 'Opus 4.5',
    desc: 'Previous generation Opus', 
    baseValue: 'claude-opus-4-5-20251101',
    thinkingValue: 'claude-opus-4-5-20251101-thinking'
  }
];

// Helper to parse a model string into our internal state
export function parseModelString(modelStr: string) {
  const allModels = [...MODELS, ...MORE_MODELS];
  // Check exact matches first
  const match = allModels.find(m => m.baseValue === modelStr || m.thinkingValue === modelStr);
  
  if (match) {
    return {
      modelId: match.id,
      isThinking: modelStr.endsWith('-thinking')
    };
  }
  
  // Default to Opus 4.6 Thinking if unknown
  return {
    modelId: 'opus-4.6',
    isThinking: true
  };
}

// Helper to construct model string
export function getModelString(modelId: string, isThinking: boolean) {
  const allModels = [...MODELS, ...MORE_MODELS];
  const m = allModels.find(x => x.id === modelId);
  if (!m) return 'claude-opus-4-6-thinking'; // Fallback
  return isThinking ? m.thinkingValue : m.baseValue;
}

interface ModelSelectorProps {
  currentModelString: string;
  onModelChange: (newModelString: string) => void;
  isNewChat: boolean;
  dropdownPosition?: 'top' | 'bottom';
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ currentModelString, onModelChange, isNewChat, dropdownPosition = 'bottom' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { modelId, isThinking } = parseModelString(currentModelString);
  const currentModelDef = [...MODELS, ...MORE_MODELS].find(m => m.id === modelId) || MODELS[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowMore(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectModel = (id: string) => {
    onModelChange(getModelString(id, isThinking));
    setIsOpen(false);
  };

  const handleToggleThinking = () => {
    onModelChange(getModelString(modelId, !isThinking));
    // Don't close dropdown on toggle, usually better UX
  };

  const visibleModels = isNewChat ? MODELS : [currentModelDef];

  if (showMore) {
     // Show "More models" view
     return (
        <div className="relative inline-block text-right" ref={containerRef}>
          <button
             onClick={() => setIsOpen(!isOpen)}
             className="flex items-center gap-1.5 text-[15px] font-medium text-[#444] hover:bg-black/5 px-3 py-2 rounded-md transition-colors"
          >
             <span>{currentModelDef.name}</span>
             {isThinking && <span className="text-[#999] font-normal">Extended</span>}
             <ChevronDown size={14} className="text-[#999]" />
          </button>

          {isOpen && (
             <div className={`absolute ${dropdownPosition === 'top' ? 'bottom-full' : 'top-full'} right-0 ${dropdownPosition === 'top' ? 'mb-2' : 'mt-2'} w-[240px] bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden py-1 text-left`}>
                 <div className="px-3 py-2 flex items-center gap-2 text-sm text-gray-500 cursor-pointer hover:bg-gray-50" onClick={() => setShowMore(false)}>
                    <ChevronDown size={16} className="rotate-90" />
                    <span>Back</span>
                 </div>
                 <div className="h-[1px] bg-gray-100 my-1"/>
                 {MORE_MODELS.map(m => (
                    <div
                      key={m.id}
                      onClick={() => {
                        handleSelectModel(m.id);
                        setShowMore(false);
                      }}
                      className="px-3 py-2 hover:bg-[#F5F4F1] cursor-pointer flex items-start gap-2 text-left"
                    >
                       <div className="flex-1">
                          <div className="text-[14px] font-medium text-[#333]">{m.name}</div>
                          {m.desc && <div className="text-[12px] text-[#747474] mt-0.5">{m.desc}</div>}
                       </div>
                       {modelId === m.id && <Check size={16} className="text-[#333] mt-0.5" />}
                    </div>
                 ))}
             </div>
          )}
        </div>
     )
  }

  return (
    <div className="relative inline-block text-right" ref={containerRef}>
       <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 text-[15px] font-medium text-[#444] hover:bg-black/5 px-3 py-2 rounded-md transition-colors"
       >
          <span>{currentModelDef.name}</span>
          {isThinking && <span className="text-[#999] font-normal">Extended</span>}
          <ChevronDown size={14} className="text-[#999]" />
       </button>

       {isOpen && (
         <div className={`absolute ${dropdownPosition === 'top' ? 'bottom-full' : 'top-full'} right-0 ${dropdownPosition === 'top' ? 'mb-2' : 'mt-2'} w-[240px] bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden py-1 text-left`}>

            {/* Model List */}
            {visibleModels.map(m => (
              <div
                key={m.id}
                onClick={() => handleSelectModel(m.id)}
                className="px-3 py-2 hover:bg-[#F5F4F1] cursor-pointer flex items-start gap-2 text-left"
              >
                 <div className="flex-1">
                    <div className="text-[14px] font-medium text-[#333]">{m.name}</div>
                    <div className="text-[12px] text-[#747474] mt-0.5">{m.desc}</div>
                 </div>
                 {modelId === m.id && <Check size={16} className="text-[#2D2D2D] mt-0.5" />}
              </div>
            ))}

            <div className="h-[1px] bg-gray-100 my-1"/>

            {/* Extended Thinking Toggle */}
            <div className="px-3 py-2 flex items-center justify-between hover:bg-[#F5F4F1] text-left">
               <div className="flex-1">
                  <div className="text-[14px] font-medium text-[#333]">Extended thinking</div>
                  <div className="text-[12px] text-[#747474] mt-0.5">Think longer for complex tasks</div>
               </div>

               <button
                 onClick={(e) => {
                    e.stopPropagation();
                    handleToggleThinking();
                 }}
                 className={`w-10 h-6 rounded-full relative transition-colors duration-200 ${isThinking ? 'bg-[#3A6FE0]' : 'bg-[#E5E5E5]'}`}
               >
                 <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${isThinking ? 'left-5' : 'left-1'}`} />
               </button>
            </div>

            <div className="h-[1px] bg-gray-100 my-1"/>

            {/* More Models */}
            <div
              onClick={() => setShowMore(true)}
              className="px-3 py-2 hover:bg-[#F5F4F1] cursor-pointer flex items-center justify-between text-[#333] text-left"
            >
               <span className="text-[14px] font-medium">More models</span>
               <ChevronRight size={16} className="text-[#999]" />
            </div>

         </div>
       )}
    </div>
  );
};

export default ModelSelector;
