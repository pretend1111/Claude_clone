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