import React from 'react';
import { FileText, Download, X } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import SlidePreview from './SlidePreview';
import DocxPreview from './DocxPreview';
import PdfPreview from './PdfPreview';
import { DocumentInfo } from './DocumentCard';

interface DocumentPanelProps {
  document: DocumentInfo;
  onClose: () => void;
}

const DocumentPanel: React.FC<DocumentPanelProps> = ({ document, onClose }) => {
  const fmt = document.format || 'markdown';

  const handleDownload = async () => {
    if (fmt === 'markdown') {
      const blob = new Blob([document.content || ''], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${document.title}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const extMap: Record<string, string> = { docx: '.docx', pptx: '.pptx', xlsx: '.xlsx', pdf: '.pdf' };
      const ext = extMap[fmt] || '.bin';
      try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`/api/documents/${document.id}/raw`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = `${document.title}${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        // silent fail
      }
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-claude-input border-l border-claude-border min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-claude-border flex-shrink-0">
        <div className="flex items-center min-w-0 text-[14px] truncate">
          <span className="text-claude-text font-normal">{document.title}</span>
          <span className="text-claude-textSecondary font-normal ml-1">· {fmt.toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleDownload}
            className="p-1.5 text-claude-textSecondary hover:text-claude-text hover:bg-claude-btn-hover rounded-lg transition-colors"
            title="下载文档"
          >
            <Download size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-claude-textSecondary hover:text-claude-text hover:bg-claude-btn-hover rounded-lg transition-colors"
            title="关闭"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      {/* Content */}
      <div className={`flex-1 overflow-y-auto ${fmt === 'docx' || fmt === 'pdf' ? 'px-4 py-4 bg-claude-hover' : 'p-4'}`}>
        {fmt === 'pptx' && document.slides ? (
          <SlidePreview slides={document.slides} title={document.title} colorScheme={document.colorScheme} />
        ) : fmt === 'docx' && document.content ? (
          <DocxPreview content={document.content} title={document.title} />
        ) : fmt === 'pdf' && document.sections ? (
          <PdfPreview sections={document.sections} title={document.title} />
        ) : fmt === 'xlsx' && document.sheets ? (
          <div className="space-y-6">
            {document.sheets.map((sheet, si) => (
              <div key={si}>
                <div className="text-[14px] font-medium text-claude-text mb-2">{sheet.name}</div>
                <div className="overflow-x-auto border border-claude-border rounded-lg">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="bg-[#4472C4] text-white">
                        {sheet.headers.map((h, hi) => (
                          <th key={hi} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sheet.rows.map((row, ri) => (
                        <tr key={ri} className={ri % 2 === 0 ? 'bg-claude-bg' : 'bg-transparent'}>
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-3 py-1.5 border-t border-claude-border whitespace-nowrap text-claude-text">{cell ?? ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <MarkdownRenderer content={document.content || ''} />
        )}
      </div>
    </div>
  );
};

export default DocumentPanel;
