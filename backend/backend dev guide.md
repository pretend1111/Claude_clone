# Claude Clone 后端开发步骤指南

> 本文档按开发顺序组织，每个 Step 都是一个可以独立完成并测试的里程碑。你可以把每个 Step 直接作为 Codex 的任务描述。

---

## 项目结构目标

```
Claude_clone/
├── frontend/          # 你已有的前端（AI Studio 生成）
├── backend/
│   ├── package.json
│   ├── .env           # 环境变量（不入 git）
│   ├── .env.example   # 环境变量模板
│   ├── src/
│   │   ├── index.js          # 入口，启动 Express
│   │   ├── config.js         # 读取 .env，导出配置
│   │   ├── db/
│   │   │   ├── init.js       # SQLite 初始化 + 建表
│   │   │   └── database.sqlite  # 数据库文件（gitignore）
│   │   ├── middleware/
│   │   │   ├── auth.js       # JWT 验证中间件
│   │   │   └── rateLimit.js  # 限流中间件
│   │   ├── routes/
│   │   │   ├── auth.js       # 注册/登录
│   │   │   ├── chat.js       # 对话（核心：SSE 流式转发）
│   │   │   ├── conversations.js  # 对话历史 CRUD
│   │   │   └── user.js       # 用户信息/用量查询
│   │   └── utils/
│   │       ├── token.js      # JWT 签发/验证
│   │       └── logger.js     # 简单日志
│   └── data/                 # SQLite 文件存放
└── nginx/
    └── claude-clone.conf     # Nginx 配置文件
```

---

## Step 1：项目初始化 + 基础服务器

**目标：** 后端能跑起来，返回 hello world。

**给 Codex 的指令：**
> 在 backend/ 文件夹初始化 Node.js 项目。使用 Express。安装依赖：express, cors, dotenv, better-sqlite3, jsonwebtoken, bcryptjs, uuid。创建 src/index.js 作为入口，监听 3001 端口，配置 CORS 允许前端 localhost:5173（或前端的端口）。创建 .env.example 包含 PORT、JWT_SECRET、API_BASE_URL、API_KEY。添加一个 GET /api/health 返回 { status: "ok" }。

**验证方式：**
```bash
cd backend && npm install && node src/index.js
curl http://localhost:3001/api/health
# 应返回 {"status":"ok"}
```

---

## Step 2：数据库初始化

**目标：** SQLite 建表，应用启动时自动初始化。

**给 Codex 的指令：**
> 创建 src/db/init.js，使用 better-sqlite3 初始化 SQLite 数据库。建以下三张表：
>
> **users 表：** id (TEXT PRIMARY KEY, uuid), email (TEXT UNIQUE NOT NULL), password_hash (TEXT NOT NULL), nickname (TEXT), plan (TEXT DEFAULT 'free'), token_quota (INTEGER DEFAULT 1000000), token_used (INTEGER DEFAULT 0), created_at (DATETIME DEFAULT CURRENT_TIMESTAMP), updated_at (DATETIME DEFAULT CURRENT_TIMESTAMP)
>
> **conversations 表：** id (TEXT PRIMARY KEY, uuid), user_id (TEXT NOT NULL, 外键 users.id), title (TEXT DEFAULT '新对话'), model (TEXT DEFAULT 'claude-opus-4-20250514'), created_at, updated_at
>
> **messages 表：** id (TEXT PRIMARY KEY, uuid), conversation_id (TEXT NOT NULL, 外键 conversations.id), role (TEXT NOT NULL, 'user'|'assistant'), content (TEXT NOT NULL), token_count (INTEGER DEFAULT 0), created_at (DATETIME DEFAULT CURRENT_TIMESTAMP)
>
> 在 index.js 启动时调用 init 函数。如果表已存在则跳过。

**验证方式：**
```bash
node src/index.js
# 查看 data/database.sqlite 是否生成，用 sqlite3 CLI 检查表结构
```

---

## Step 3：用户注册 + 登录（JWT 鉴权）

**目标：** 实现注册、登录接口，返回 JWT。

**给 Codex 的指令：**
> 创建 src/routes/auth.js，实现两个接口：
>
> **POST /api/auth/register** - 接收 { email, password, nickname }。密码用 bcryptjs 哈希（saltRounds=10）。生成 uuid 作为用户 id。成功返回 { token, user: { id, email, nickname, plan } }。邮箱已存在返回 409。
>
> **POST /api/auth/login** - 接收 { email, password }。验证密码，成功签发 JWT（payload 含 userId，过期时间 7 天）。返回格式同注册。
>
> 创建 src/middleware/auth.js，从请求头 Authorization: Bearer <token> 中提取并验证 JWT。验证通过后将 userId 挂到 req.userId。验证失败返回 401。
>
> 创建 src/utils/token.js 封装 jwt.sign 和 jwt.verify。

**验证方式：**
```bash
# 注册
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456","nickname":"Test"}'

# 登录
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456"}'

# 用返回的 token 请求受保护接口
curl http://localhost:3001/api/health \
  -H "Authorization: Bearer <token>"
```

---

## Step 4：对话 CRUD（侧边栏数据来源）

**目标：** 前端侧边栏的「Recents」列表有数据来源了。

**给 Codex 的指令：**
> 创建 src/routes/conversations.js，所有接口都需要 auth 中间件保护：
>
> **GET /api/conversations** - 返回当前用户的所有对话列表，按 updated_at 倒序。只返回 id, title, model, updated_at。
>
> **POST /api/conversations** - 创建新对话。可选传入 { title, model }。返回新建的对话对象。
>
> **GET /api/conversations/:id** - 返回单个对话详情 + 该对话下所有 messages（按 created_at 正序）。验证对话属于当前用户，否则 403。
>
> **PATCH /api/conversations/:id** - 更新对话标题或模型。
>
> **DELETE /api/conversations/:id** - 删除对话及其所有消息。

**验证方式：**
```bash
# 创建对话
curl -X POST http://localhost:3001/api/conversations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"测试对话"}'

# 获取列表
curl http://localhost:3001/api/conversations \
  -H "Authorization: Bearer <token>"
```

---

## Step 5：核心——SSE 流式对话转发 ⭐

**目标：** 这是整个项目最关键的接口。用户发消息，后端转发给中转 API，流式返回结果。

**给 Codex 的指令：**
> 创建 src/routes/chat.js，实现核心对话接口：
>
> **POST /api/chat** - 需要 auth 中间件。接收 JSON body：{ conversation_id, message, model? }
>
> 处理流程：
> 1. 验证 conversation_id 属于当前用户
> 2. 检查用户 token_used < token_quota，否则返回 429 + { error: "配额已用完" }
> 3. 将用户消息存入 messages 表
> 4. 从 messages 表查出该对话的历史消息，组装成 Anthropic API 的 messages 数组格式
> 5. 设置响应头：Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive
> 6. 用 fetch 调用中转 API（POST 到 ${API_BASE_URL}/v1/messages），参数：model, max_tokens: 4096, stream: true, messages
> 7. 逐 chunk 读取中转 API 的响应流。每收到一个 chunk，立即用 res.write() 写入客户端。格式保持 SSE 标准：`data: ${chunk}\n\n`
> 8. 关注 stream 中的 message_start（获取 input_tokens）和 message_delta（获取 output_tokens）事件
> 9. 流结束后：将完整的 assistant 回复内容存入 messages 表；更新 users 表的 token_used（累加 input_tokens + output_tokens）；更新 conversations 的 updated_at
> 10. 如果这是对话的第一条消息，用回复的前20个字自动更新对话 title
> 11. 处理错误：中转 API 返回错误时，通过 SSE 发送错误事件给前端
>
> 中转 API 请求格式：
> ```
> POST ${API_BASE_URL}/v1/messages
> Headers: {
>   "Content-Type": "application/json",
>   "x-api-key": "${API_KEY}",
>   "anthropic-version": "2023-06-01"
> }
> Body: {
>   "model": "claude-opus-4-20250514",
>   "max_tokens": 4096,
>   "stream": true,
>   "messages": [{ "role": "user", "content": "..." }, ...]
> }
> ```
>
> 重要：不要用任何 Anthropic SDK，直接用 fetch 发请求，因为中转 API 的地址不是官方地址。确保 stream 透传时不做任何缓冲，收到就转发。

**验证方式：**
```bash
# 先创建一个对话拿到 conversation_id，然后：
curl -N -X POST http://localhost:3001/api/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"conversation_id":"<id>","message":"你好，请介绍一下自己"}'

# 应该看到 SSE 流式输出，逐字返回
```

---

## Step 6：用户信息 + 用量查询

**目标：** 前端左下角用户信息区域和用量展示有数据来源。

**给 Codex 的指令：**
> 创建 src/routes/user.js，auth 中间件保护：
>
> **GET /api/user/profile** - 返回 { id, email, nickname, plan, token_quota, token_used, created_at }
>
> **GET /api/user/usage** - 返回 { token_quota, token_used, token_remaining, usage_percent }（usage_percent 是百分比数字，保留两位小数）
>
> **PATCH /api/user/profile** - 允许更新 nickname

---

## Step 7：限流中间件

**目标：** 防止单用户刷接口。

**给 Codex 的指令：**
> 创建 src/middleware/rateLimit.js，实现基于内存的简单限流（不需要 Redis）：
>
> 用一个 Map 存储每个用户的请求计数，key 是 userId（已登录）或 IP（未登录）。
>
> 对 /api/chat 接口：每个用户每分钟最多 20 次请求。
> 对 /api/auth 接口：每个 IP 每分钟最多 10 次请求（防暴力破解）。
>
> 超限返回 429 + { error: "请求过于频繁，请稍后再试" }。
> 每分钟清零计数器（用 setInterval）。

---

## Step 8：前后端联调

**目标：** 前端能正式和后端通信。

**这一步需要你自己在前端做的改动（告诉 AI Studio）：**

> 前端需要做以下对接改动：
>
> 1. **创建 API 配置文件**：所有请求发到 `/api/` 前缀（开发时代理到 localhost:3001，生产时 Nginx 反代）
>
> 2. **登录/注册页面**：新建一个登录页面组件。未登录时强制跳转。登录成功后将 JWT 存入 localStorage。
>
> 3. **侧边栏对话列表**：页面加载时调用 GET /api/conversations，渲染到侧边栏 Recents 区域。点击「New chat」调 POST /api/conversations 创建新对话并切换。
>
> 4. **对话消息区域**：点击某个对话时调 GET /api/conversations/:id 拉取历史消息并渲染。
>
> 5. **发送消息（核心）**：用户输入后调 POST /api/chat。使用 EventSource 或 fetch + ReadableStream 读取 SSE 流。收到的每个 content_block_delta 事件中提取 delta.text，实时追加到界面上的 assistant 消息气泡里。
>
> 6. **用户信息**：左下角调 GET /api/user/profile 显示昵称和套餐。
>
> 7. **所有请求的 header 加上** Authorization: Bearer <localStorage 中的 token>

**SSE 前端解析参考（给 AI Studio 的代码示例）：**

```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ conversation_id, message })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value, { stream: true });
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') break;
      
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'content_block_delta') {
          // parsed.delta.text 就是增量文本，追加到界面
          appendToAssistantMessage(parsed.delta.text);
        }
      } catch (e) {
        // 忽略非 JSON 行
      }
    }
  }
}
```

---

## Step 9：日志 + 错误处理

**给 Codex 的指令：**
> 创建 src/utils/logger.js，简单的日志工具：
> - 每次 /api/chat 请求记录：时间、userId、conversation_id、input token 数、output token 数、耗时(ms)、状态(success/error)
> - 写入 data/logs/ 目录，按日期分文件（如 2026-02-09.log）
> - 格式：一行一条 JSON
>
> 在 index.js 添加全局错误处理中间件，捕获未处理异常，返回 500 + { error: "服务器内部错误" }，并写入日志。

---

## Step 10：生产部署配置

**给 Codex 的指令：**
> 创建以下部署相关文件：
>
> **ecosystem.config.js**（PM2 配置）：
> - 应用名 claude-clone-backend
> - 入口 src/index.js
> - 实例数 1（2核机器留一核给 Nginx 和系统）
> - 自动重启、最大重启次数 10
> - 日志路径 ./data/logs/
>
> **nginx/claude-clone.conf**：
> - 监听 443 SSL（证书路径用占位符）
> - 前端静态文件 root 指向前端 build 目录
> - /api/ 路径 proxy_pass 到 http://127.0.0.1:3001
> - 对 /api/chat 路径关闭 proxy_buffering（SSE必须）
> - 开启 gzip
> - 配置 limit_req_zone（按 IP，10r/s burst=20）
> - 设置 X-Real-IP 和 X-Forwarded-For 头

---

## 开发顺序总结

| 顺序 | 步骤 | 预计时间 | 可验证产出 |
|------|------|----------|------------|
| 1 | 项目初始化 | 10min | /api/health 返回 OK |
| 2 | 数据库建表 | 15min | SQLite 文件 + 三张表 |
| 3 | 注册登录 | 30min | 拿到 JWT Token |
| 4 | 对话 CRUD | 30min | 侧边栏列表有数据 |
| 5 | **SSE 流式转发** | 1-2h | **核心功能跑通** |
| 6 | 用户用量接口 | 15min | 用量信息可查 |
| 7 | 限流中间件 | 20min | 刷接口会被拦 |
| 8 | 前后端联调 | 2-3h | **完整可用的产品** |
| 9 | 日志 + 错误处理 | 30min | 有运行日志 |
| 10 | 部署配置 | 30min | PM2 + Nginx 配好 |

**总计约 6-8 小时**，一个人一天可以完成后端全部开发。

---

## 给 Codex 的全局 CLAUDE.md 建议

在 backend/ 目录放一个 CLAUDE.md 文件，内容：

```markdown
# Claude Clone Backend

## 技术栈
- Node.js 20 + Express
- SQLite (better-sqlite3)
- JWT 鉴权 (jsonwebtoken + bcryptjs)

## 关键约束
- 不使用 Anthropic SDK，直接用 fetch 调中转 API
- SSE 流式转发必须零缓冲，收到立即 res.write()
- 所有接口（除 auth）必须经过 JWT 中间件
- 数据库操作用同步 API（better-sqlite3 是同步的）
- 不引入 ORM，直接写 SQL

## 常用命令
- 启动：node src/index.js
- 开发：npx nodemon src/index.js
- 部署：pm2 start ecosystem.config.js

## 代码风格
- ES Module (import/export) 或 CommonJS 均可，保持一致
- 错误统一用 try/catch + next(err) 抛给全局处理
- 环境变量全部通过 config.js 导出，不在其他文件直接读 process.env
```