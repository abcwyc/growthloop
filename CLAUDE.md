# GrowthLoop 开发指南

## 技术栈

- **框架**: Next.js 16.2.1 (App Router, Turbopack)
- **前端**: React 19 + Tailwind CSS 4 + Framer Motion
- **数据库**: SQLite (better-sqlite3, WAL mode)
- **AI**: 兼容 OpenAI Chat Completions API 的 LLM

## 环境变量

复制 `.env.example` 为 `.env` 并填入 LLM 配置：

```bash
cp .env.example .env
```

必填项：`LLM_ENDPOINT`、`LLM_API_KEY`

## 启动开发

```bash
npm install
npm run dev
```

## 项目结构

- `app/` — Next.js 页面和 API 路由
- `components/` — React 组件
- `lib/` — 核心逻辑（AI Agent、数据库、数据适配器）
- `data/` — 运行时 SQLite 数据库（自动创建，已被 .gitignore 排除）
