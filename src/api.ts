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
  return res;
}

// 认证相关
export async function register(email: string, password: string, nickname: string) {
  const res = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, nickname }),
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

export async function createConversation(title?: string) {
  const res = await request('/conversations', {
    method: 'POST',
    body: JSON.stringify({ title: title || 'New chat' }),
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

// 流式对话（核心）
export async function sendMessage(
  conversationId: string, 
  message: string, 
  attachments: any[] | null, 
  onDelta: (delta: string, full: string) => void, 
  onDone: (full: string) => void, 
  onError: (err: string) => void
) {
  const token = getToken();
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
    let fullText = '';

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

          if (parsed.type === 'content_block_delta' && parsed.delta) {
            if (parsed.delta.type === 'text_delta' && parsed.delta.text) {
              fullText += parsed.delta.text;
              onDelta(parsed.delta.text, fullText);
            }
          }

          if (parsed.type === 'message_stop') {
            onDone(fullText);
            return;
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
    onError(err.message || 'Network error');
  }
}