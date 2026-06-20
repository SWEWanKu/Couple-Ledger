# Couple Ledger

电脑端优先的情侣共同账本 Web App 最小可运行骨架。

## 当前范围

- Next.js App Router + TypeScript
- Tailwind CSS 基础样式
- `/` 产品介绍与登录入口
- `/login` 邮箱登录表单占位
- `/dashboard` 电脑端看板布局
- `AppShell`、`Sidebar`、`Topbar`、`StatCard` 组件
- Supabase 环境变量示例

## 暂不包含

- 真实 Supabase 数据库或认证逻辑
- 账单新增、确认、结算、图表、导出
- 支付宝、微信、OCR、AI 分析、商业化或多租户后台

## 环境变量

复制 `.env.example` 后再填写真实值。本仓库不要提交 `.env`。

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## 本地运行

```bash
npm install
npm run dev
```

访问：

- `http://localhost:3000/`
- `http://localhost:3000/login`
- `http://localhost:3000/dashboard`

页面中的账单、金额和结算提示均为 mock/fallback 数据，等待后续接入真实数据源。
