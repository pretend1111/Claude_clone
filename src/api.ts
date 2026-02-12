const API_BASE = 'http://localhost:3001/api';

// 获取存储的 token
function getToken() {
  return localStorage.getItem('auth_token');
}

// 通用请求方法
async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) {
    (headers as any)['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('认证失效');
  }
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed: ${res.status}`);
  }
  return res;
}

// 认证相关
export async function sendCode(email: string) {
  const res = await request('/auth/send-code', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  return res.json();
}

export async function register(email: string, password: string, nickname: string, code: string) {
  const res = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, nickname, code }),
  });
  return res.json();
}

export async function login(email: string, password: string) {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export async function forgotPassword(email: string) {
  const res = await request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  return res.json();
}

export async function resetPassword(email: string, code: string, password: string) {
  const res = await request('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, code, password }),
  });
  return res.json();
}

export function logout() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

export function getUser() {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

// 对话相关
export async function getConversations() {
  const res = await request('/conversations');
  return res.json();
}

export async function createConversation(title?: string, model?: string) {
  const body: any = { model };
  if (title !== undefined) {
    body.title = title;
  }
  const res = await request('/conversations', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function getConversation(id: string) {
  const res = await request(`/conversations/${id}`);
  return res.json();
}

export async function deleteConversation(id: string) {
  const res = await request(`/conversations/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function updateConversation(id: string, data: any) {
  const res = await request(`/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.json();
}

// 手动压缩对话
export async function compactConversation(
  id: string,
  instruction?: string
): Promise<{ summary: string; tokensSaved: number; messagesCompacted: number }> {
  const res = await request(`/conversations/${id}/compact`, {
    method: 'POST',
    body: JSON.stringify({ instruction }),
  });
  return res.json();
}

// 删除指定消息及其后续消息
export async function deleteMessagesFrom(conversationId: string, messageId: string) {
  const res = await request(`/conversations/${conversationId}/messages/${messageId}`, {
    method: 'DELETE',
  });
  return res.json();
}

// 文件上传相关
export interface UploadResult {
  fileId: string;
  fileName: string;
  fileType: 'image' | 'document' | 'text';
  mimeType: string;
  size: number;
}

export function uploadFile(
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const token = getToken();
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        reject(new Error('认证失效'));
        return;
      }
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new Error(data.error || '上传失败'));
        }
      } catch {
        reject(new Error('上传失败'));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('网络错误')));
    xhr.addEventListener('abort', () => reject(new Error('上传已取消')));

    xhr.open('POST', `${API_BASE}/upload`);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.send(formData);
  });
}

export function getAttachmentUrl(fileId: string): string {
  return `${API_BASE}/uploads/${fileId}/raw`;
}

// 流式对话（核心）
export async function sendMessage(
  conversationId: string,
  message: string,
  attachments: any[] | null,
  onDelta: (delta: string, full: string) => void,
  onDone: (full: string) => void,
  onError: (err: string) => void,
  onThinking?: (thinking: string, full: string) => void,
  onSystem?: (event: string, message: string, data: any) => void,
  onCitations?: (citations: Array<{ url: string; title: string; cited_text?: string }>) => void,
  signal?: AbortSignal
) {
  const token = getToken();
  let fullText = '';
  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        message,
        attachments: attachments || undefined,
      }),
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '请求失败' }));
      onError(err.error || '请求失败');
      return;
    }

    if (!res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let thinkingText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留不完整的最后一行

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data.trim() === '[DONE]') {
          onDone(fullText);
          return;
        }

        try {
          const parsed = JSON.parse(data);

          // 处理 system 事件（如 compaction 通知）
          if (parsed.type === 'system') {
            if (onSystem) {
              onSystem(parsed.event, parsed.message, parsed);
            }
            continue;
          }

          // 处理 status 事件（如搜索状态通知）
          if (parsed.type === 'status') {
            if (onSystem) {
              onSystem('status', parsed.message, parsed);
            }
            continue;
          }

          // 处理搜索来源事件
          if (parsed.type === 'search_sources') {
            if (onCitations && Array.isArray(parsed.sources)) {
              onCitations(parsed.sources);
            }
            continue;
          }

          // 处理 thinking 内容
          if (parsed.type === 'content_block_delta' && parsed.delta) {
            if (parsed.delta.type === 'text_delta' && parsed.delta.text) {
              fullText += parsed.delta.text;
              onDelta(parsed.delta.text, fullText);
            }
            if (parsed.delta.type === 'thinking_delta' && parsed.delta.thinking) {
              thinkingText += parsed.delta.thinking;
              if (onThinking) {
                onThinking(parsed.delta.thinking, thinkingText);
              }
            }
          }

          // 处理 content_block_start 来识别 thinking block
          if (parsed.type === 'content_block_start' && parsed.content_block) {
            if (parsed.content_block.type === 'thinking' && onThinking) {
              // 新的 thinking block 开始
              thinkingText = '';
            }
          }

          if (parsed.type === 'message_stop') {
            // 如果有文本内容才结束，否则可能是服务端工具中间的 message_stop
            if (fullText) {
              onDone(fullText);
              return;
            }
            // 没有文本内容时继续等待后续事件
            continue;
          }

          if (parsed.type === 'error') {
            onError(parsed.error || '未知错误');
            return;
          }
        } catch (e) {
          // 忽略非JSON行
        }
      }
    }

    if (fullText) {
      onDone(fullText);
    }
  } catch (err: any) {
    // 用户主动中断不算错误
    if (err.name === 'AbortError') {
      onDone(fullText);
      return;
    }
    onError(err.message || 'Network error');
  }
}