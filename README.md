# codex-register

基于 [klsf/codex-register](https://github.com/klsf/codex-register) 的个人复刻版本。

用于批量注册 OpenAI 账号、生成授权文件，并批量检查额度。

## 功能

- 批量注册 OpenAI 账号
- 支持多种邮箱提供商：Cloudflare、Gmail、Hotmail、GPTMail 等
- 自动生成授权文件
- 批量检查账号剩余额度
- 支持 CLIProxyAPI 自动上传 auth

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

编辑 `config.json`，至少修改：

```json
{
  "provider": "cloudflare",
  "defaultProxyUrl": "http://127.0.0.1:10808",
  "defaultPassword": "your_password",
  "cloudflareEmailDomain": "your-domain.com",
  "cloudflareApiBaseUrl": "https://your-worker.workers.dev",
  "cloudflareApiKey": "your_api_key"
}
```

### 3. 运行

```bash
# 开发模式
npm run dev

# 只跑 1 轮
npm run dev -- --n 1

# 构建后运行
npm run build
npm run start
```

### 4. 检查额度

```bash
npm run check
npm run check -- --limit 20 --table
```

## 支持的邮箱提供商

| 提供商 | 说明 |
|--------|------|
| `cloudflare` | 自有域名，需配置 Cloudflare Email Routing + Worker |
| `gmail` | 需要 Gmail API token |
| `hotmail` | 需要 Hotmail/Outlook 账号的 refresh_token |
| `gptmail` | 需要 GPTMail API Key |
| `2925` | 需要 2925 邮箱账号 |

## 常用命令

```bash
# 指定邮箱注册并授权
npm run dev -- --email your_mail@example.com

# 只做登录授权
npm run dev -- --email your_mail@example.com --auth

# 手动输入验证码
npm run dev -- --email your_mail@example.com --otp

# 直接注册并授权
npm run dev -- --email your_mail@example.com --sign
```

## 安全提醒

- `config.json` 包含敏感信息，已被 `.gitignore` 排除
- `accounts/` 目录包含账号密码，已被 `.gitignore` 排除
- `auth/` 目录包含授权文件，已被 `.gitignore` 排除
- **请勿将上述文件提交到公开仓库**

## 致谢

- [klsf/codex-register](https://github.com/klsf/codex-register) — 原项目

## 免责声明

本项目仅供学习与研究使用。使用者应自行确保其用途符合目标平台的服务条款和当地法律法规。因使用本项目导致的任何后果，均由使用者自行承担。

## 许可证

MIT
