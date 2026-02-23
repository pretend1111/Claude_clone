import React from 'react';
import { X, FileText, File, Loader2, Code2 } from 'lucide-react';

export interface PendingFile {
  id: string;
  file: File;
  fileId?: string;
  fileName: string;
  fileType?: 'image' | 'document' | 'text';
  mimeType: string;
  size: number;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
  previewUrl?: string;
}

interface FileUploadPreviewProps {
  files: PendingFile[];
  onRemove: (id: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getFileIcon(fileName: string, mimeType: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  // Word
  if (ext === 'docx' || ext === 'doc' || ext === 'odt' || ext === 'rtf') {
    return <div className="w-10 h-10 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 text-blue-600 dark:text-blue-400 font-bold text-sm">W</div>;
  }
  // Excel
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
    return <div className="w-10 h-10 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 text-green-600 dark:text-green-400 font-bold text-sm">X</div>;
  }
  // PPT
  if (ext === 'pptx' || ext === 'ppt') {
    return <div className="w-10 h-10 rounded bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0 text-orange-600 dark:text-orange-400 font-bold text-sm">P</div>;
  }
  // PDF
  if (ext === 'pdf' || mimeType === 'application/pdf') {
    return <div className="w-10 h-10 rounded bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0"><FileText size={20} className="text-red-500 dark:text-red-400" /></div>;
  }
  // EPUB
  if (ext === 'epub') {
    return <div className="w-10 h-10 rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0 text-purple-600 dark:text-purple-400 font-bold text-sm">E</div>;
  }
  // 代码文件
  const codeExts = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'scala', 'vue', 'svelte', 'lua', 'r', 'sql', 'sh', 'bash', 'html', 'css', 'scss', 'less'];
  if (codeExts.includes(ext)) {
    return <div className="w-10 h-10 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0"><Code2 size={20} className="text-gray-600 dark:text-gray-400" /></div>;
  }
  // 其他文本
  return <div className="w-10 h-10 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0"><File size={20} className="text-blue-500 dark:text-blue-400" /></div>;
}

const FileUploadPreview: React.FC<FileUploadPreviewProps> = ({ files, onRemove }) => {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1 max-h-[30vh] overflow-y-auto">
      {files.map((f) => (
        <div
          key={f.id}
          className="relative group/file flex items-center gap-2 bg-claude-hover border border-claude-border rounded-lg px-3 py-2 max-w-[200px]"
        >
          {/* 缩略图或图标 */}
          {f.previewUrl ? (
            <img
              src={f.previewUrl}
              alt={f.fileName}
              className="w-10 h-10 rounded object-cover flex-shrink-0"
            />
          ) : (
            getFileIcon(f.fileName, f.mimeType)
          )}

          {/* 文件信息 */}
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-claude-text truncate">{f.fileName}</div>
            <div className="text-[11px] text-claude-textSecondary">
              {f.status === 'uploading' ? (
                <span className="flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin" />
                  {f.progress}%
                </span>
              ) : f.status === 'error' ? (
                <span className="text-red-500">{f.error || '上传失败'}</span>
              ) : (
                formatSize(f.size)
              )}
            </div>
          </div>

          {/* 删除按钮 */}
          <button
            onClick={() => onRemove(f.id)}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-claude-textSecondary text-white rounded-full flex items-center justify-center opacity-0 group-hover/file:opacity-100 transition-opacity hover:bg-claude-text"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default FileUploadPreview;
