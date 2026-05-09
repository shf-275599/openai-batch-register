# openai-batch-register

基于 [klsf/codex-register](https://github.com/klsf/codex-register) 的个人复刻版本。

用于批量注册 OpenAI 账号、授权 Codex 登录生成授权文件、批量检查额度。

## 功能

- 批量注册 OpenAI 账号
- Codex 登录授权，生成 auth 文件
- 自动上传 auth 到 CLIProxyAPI
- 批量检查账号剩余额度
- 支持多种邮箱提供商：Cloudflare、Gmail、Hotmail、GPTMail 等

## 环境要求

- Node.js 18+
- 可用代理

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置

```bash
cp config.example.json config.json
```

编辑 `config.json`，根据使用的邮箱提供商配置。

### 3. 运行

```bash
npm run dev -- --n 1
npm run build && npm run start
```

## 常用命令

### 注册并授权

```bash
npm run dev -- --n 1                          # 自动注册 1 个
npm run dev -- --email your@email.com --sign  # 指定邮箱注册并授权
```

### 只做登录授权

```bash
npm run dev -- --email your@email.com --auth  # 生成 auth 文件
```

### 检查额度

```bash
npm run check                                 # 检查本地 auth 目录
npm run check -- --limit 20 --table           # 检查前 20 个，显示表格
npm run check -- --refresh --table            # 刷新 token 后检查
npm run check:cpa                             # 从 CLIProxyAPI 检查
```

## 安全提醒

- `config.json`、`accounts/`、`auth/` 已被 `.gitignore` 排除
- **请勿将敏感文件提交到公开仓库**

## 致谢

- [klsf/codex-register](https://github.com/klsf/codex-register) — 原项目

## 免责声明

本项目仅供学习与研究使用。因使用本项目导致的任何后果，均由使用者自行承担。

## 许可证

MIT
