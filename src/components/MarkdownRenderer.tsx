import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="markdown-body text-[#393939] text-[16px] leading-relaxed">
      <ReactMarkdown
        components={{
          code({node, inline, className, children, ...props}: any) {
            return !inline ? (
              <pre className="bg-[#F6F6F6] p-3 rounded-md overflow-x-auto my-3 text-sm border border-[#E5E5E5]">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            ) : (
              <code className="bg-black/5 px-1.5 py-0.5 rounded text-sm font-mono text-[#C14C3D]" {...props}>
                {children}
              </code>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;