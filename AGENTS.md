# 开发规则

## Git 同步规则（必须遵守）
每次执行任务前后，必须执行以下操作：

### 任务开始前：
1. 执行 `git pull --rebase origin main` 拉取最新代码（前端可能有更新）
2. 查看 `frontend/` 目录的最新改动，了解前端接口变化

### 任务完成后：
1. 执行 `git add .`
2. 执行 `git commit -m "feat/fix: 简要描述改动"`
3. 执行 `git push origin main`

## 项目结构
- 根目录除了backend/的部分 - 前端代码（由 Google AI Studio 维护，不要修改）
- `backend/` - 后端代码（由你维护）

## 重要约束
- **绝对不要修改 根目录除了backend/的部分 的任何文件**
- 只在 `backend/` 目录下工作
- 写后端 API 时，先检查前端代码中的 fetch/axios 请求，确保接口路径和参数一致

## 接口摘要输出规则
每次新增或修改 API 接口后，必须在回复末尾输出接口摘要，格式如下：

### 新增/修改接口
- `POST /api/auth/login` - 用户登录，参数：{email, password}，返回：{token, user}
- `GET /api/messages` - 获取消息列表，参数：无，返回：[{id, content, timestamp}]

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

不要运行 npm install，不要运行 node 启动服务，不要运行任何测试命令。只写代码文件，写完 git commit push 就结束。安装和测试我在本地做。