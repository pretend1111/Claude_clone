import React, { useState } from 'react';
import { FileText, File, X, Code2 } from 'lucide-react';
import { getAttachmentUrl } from '../api';

interface Attachment {
  id: string;
  file_type: string;
  file_name: string;
  mime_type: string;
}

interface MessageAttachmentsProps {
  attachments: Attachment[];
}

function getDocIcon(fileName: string, mimeType: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'docx' || ext === 'doc' || ext === 'odt' || ext === 'rtf') {
    return <span className="text-blue-600 font-bold text-xs">W</span>;
  }
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
    return <span className="text-green-600 font-bold text-xs">X</span>;
  }
  if (ext === 'pptx' || ext === 'ppt') {
    return <span className="text-orange-600 font-bold text-xs">P</span>;
  }
  if (ext === 'pdf' || mimeType === 'application/pdf') {
    return <FileText size={18} className="text-red-500 flex-shrink-0" />;
  }
  if (ext === 'epub') {
    return <span className="text-purple-600 font-bold text-xs">E</span>;
  }
  const codeExts = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'scala', 'vue', 'svelte', 'lua', 'r', 'sql', 'sh', 'bash', 'html', 'css', 'scss', 'less'];
  if (codeExts.includes(ext)) {
    return <Code2 size={18} className="text-gray-600 flex-shrink-0" />;
  }
  return <File size={18} className="text-blue-500 flex-shrink-0" />;
}

const MessageAttachments: React.FC<MessageAttachmentsProps> = ({ attachments }) => {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (!attachments || attachments.length === 0) return null;

  const token = localStorage.getItem('auth_token');

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-2">
        {attachments.map((att) => {
          const url = getAttachmentUrl(att.id);
          const authedUrl = `${url}${url.includes('?') ? '&' : '?'}token=${token}`;

          if (att.file_type === 'image') {
            return (
              <img
                key={att.id}
                src={authedUrl}
                alt={att.file_name}
                className="w-20 h-20 rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity border border-[#E5E4E0]"
                onClick={() => setLightboxUrl(authedUrl)}
              />
            );
          }

          return (
            <div
              key={att.id}
              className="flex items-center gap-2 bg-[#F5F4F0] border border-[#E5E4E0] rounded-lg px-3 py-2"
            >
              {getDocIcon(att.file_name, att.mime_type)}
              <span className="text-[13px] text-[#555] truncate max-w-[150px]">{att.file_name}</span>
            </div>
          );
        })}
      </div>

      {/* 灯箱 */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setLightboxUrl(null)}
          >
            <X size={28} />
          </button>
          <img
            src={lightboxUrl}
            alt="preview"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

export default React.memo(MessageAttachments);
