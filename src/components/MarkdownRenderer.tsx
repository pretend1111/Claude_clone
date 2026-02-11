import React, { useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, Copy, Check } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

export interface CitationSource {
  url: string;
  title: string;
  cited_text?: string;
}

interface MarkdownRendererProps {
  content: string;
  citations?: CitationSource[];
}

/**
 * 对 citations 按 url 去重，返回去重后的来源列表（保持首次出现顺序）
 */
function deduplicateSources(citations: CitationSource[]): CitationSource[] {
  const seen = new Map<string, CitationSource>();
  for (const c of citations) {
    if (!seen.has(c.url)) {
      seen.set(c.url, c);
    }
  }
  return Array.from(seen.values());
}

/**
 * 获取 url 对应的引用编号（1-based）
 */
function getSourceIndex(url: string, sources: CitationSource[]): number {
  const idx = sources.findIndex((s) => s.url === url);
  return idx >= 0 ? idx + 1 : 0;
}

/**
 * 移除 <cite index="...">...</cite> 标签，保留内部文本
 */
function stripCiteTags(text: string): string {
  return text.replace(/<cite\s+index="[^"]*"\s*>([\s\S]*?)<\/cite>/g, '$1');
}

/** 引用角标组件 */
const CitationBadge: React.FC<{ index: number; source: CitationSource }> = ({ index, source }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current);
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setShowTooltip(false), 200);
  };

  return (
    <span className="relative inline-block" ref={badgeRef}>
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[11px] font-medium text-[#2563EB] bg-[#EFF6FF] hover:bg-[#DBEAFE] rounded cursor-pointer no-underline align-super leading-none ml-0.5 transition-colors"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {index}
      </a>
      {showTooltip && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-[360px] max-w-[90vw] bg-white border border-[#E5E5E5] rounded-lg shadow-lg p-3 text-left"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="text-[13px] font-medium text-[#111] mb-1 line-clamp-2">{source.title}</div>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-[#2563EB] hover:underline break-all line-clamp-1 mb-2 block"
          >
            {source.url}
          </a>
          {source.cited_text && (
            <div className="text-[12px] text-[#6B7280] leading-relaxed border-l-2 border-[#E5E5E5] pl-2 line-clamp-3">
              {source.cited_text}
            </div>
          )}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-white border-r border-b border-[#E5E5E5] transform rotate-45 -mt-1"></div>
        </div>
      )}
    </span>
  );
};

/** 来源列表折叠组件 */
const SourcesList: React.FC<{ sources: CitationSource[] }> = ({ sources }) => {
  const [expanded, setExpanded] = useState(false);

  if (sources.length === 0) return null;

  return (
    <div className="mt-3 border border-[#E5E5E5] rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2 bg-[#F9F9F7] cursor-pointer hover:bg-[#F2F0EB] transition-colors select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronDown
          size={14}
          className={`text-[#9CA3AF] transform transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`}
        />
        <span className="text-[13px] font-medium text-[#6B7280]">
          来源 ({sources.length})
        </span>
      </div>
      {expanded && (
        <div className="border-t border-[#E5E5E5] bg-[#FAFAF8]">
          {sources.map((source, i) => (
            <div key={source.url} className="flex items-start gap-2 px-3 py-2 border-b border-[#F0F0EE] last:border-b-0">
              <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 text-[11px] font-medium text-[#2563EB] bg-[#EFF6FF] rounded flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] font-medium text-[#111] hover:text-[#2563EB] hover:underline line-clamp-1 block"
                >
                  {source.title || source.url}
                </a>
                <span className="text-[11px] text-[#9CA3AF] break-all line-clamp-1 block">
                  {new URL(source.url).hostname}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/** 代码块组件（带复制按钮和语法高亮） */
const CodeBlock: React.FC<{ language: string; code: string; className?: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  return (
    <div
      className="relative rounded-md overflow-hidden my-3 text-sm border border-[#E5E5E5]"
      style={{ backgroundColor: 'rgb(252, 252, 250)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {language && (
        <div className="px-2 pt-1.5 pb-0 text-[12px] text-[#666] font-mono select-none">{language}</div>
      )}
      {hovered && (
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-2 rounded-md bg-white/80 text-[#666] hover:text-[#333] hover:bg-white transition-colors z-10"
          title="复制代码"
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}
        </button>
      )}
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneLight}
        customStyle={{
          margin: 0,
          padding: '12px',
          paddingTop: language ? '4px' : '12px',
          background: 'transparent',
          fontSize: '14px',
        }}
        codeTagProps={{
          style: { fontFamily: "Menlo, Monaco, SF Mono, Cascadia Code, Fira Code, Consolas, Courier New, monospace" }
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, citations }) => {
  const processed = stripCiteTags(content);
  const sources = citations ? deduplicateSources(citations) : [];
  const hasCitations = sources.length > 0;

  // 为每段文本末尾添加引用角标
  // 由于流式传输中 citations 是按 block 级别的，我们在整个消息末尾统一显示角标
  // 角标通过 SourcesList 和内联 badge 展示

  return (
    <div className="markdown-body text-[#393939] text-[16px] leading-relaxed" style={{ fontFamily: "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children, ...props }: any) {
            return <>{children}</>;
          },
          table({ children, ...props }: any) {
            return (
              <div className="overflow-x-auto my-4">
                <table className="w-full text-[14px]" {...props}>{children}</table>
              </div>
            );
          },
          thead({ children, ...props }: any) {
            return <thead style={{ borderBottom: '1px solid rgb(136, 135, 133)' }} {...props}>{children}</thead>;
          },
          tbody({ children, ...props }: any) {
            return <tbody {...props}>{children}</tbody>;
          },
          tr({ children, ...props }: any) {
            return <tr style={{ borderBottom: '1px solid rgb(136, 135, 133)' }} {...props}>{children}</tr>;
          },
          th({ children, ...props }: any) {
            return <th className="text-left py-2 pr-4 font-semibold text-[#393939]" {...props}>{children}</th>;
          },
          td({ children, ...props }: any) {
            return <td className="py-2 pr-4 text-[#393939]" {...props}>{children}</td>;
          },
          code({ node, className, children, ...props }: any) {
            const isBlock = className?.startsWith('language-') || (node?.position?.start?.line !== node?.position?.end?.line);
            const language = className?.replace('language-', '') || '';
            if (isBlock) {
              const codeText = String(children).replace(/\n$/, '');
              return <CodeBlock language={language} code={codeText} className={className} {...props} />;
            }
            return (
              <code className="bg-black/5 px-1.5 py-0.5 rounded text-sm font-mono border border-[rgb(208,207,204)]" style={{ color: 'rgb(132, 33, 35)' }} {...props}>
                {children}
              </code>
            );
          }
        }}
      >
        {processed}
      </ReactMarkdown>
      {hasCitations && (
        <div className="flex flex-wrap gap-1 mt-2 mb-1">
          {sources.map((source, i) => (
            <CitationBadge key={source.url} index={i + 1} source={source} />
          ))}
        </div>
      )}
      {hasCitations && <SourcesList sources={sources} />}
    </div>
  );
};

export default MarkdownRenderer;
