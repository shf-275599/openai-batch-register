# openai-batch-register

基于 [klsf/codex-register](https://github.com/klsf/codex-register) 的个人复刻。

批量注册 OpenAI 账号。

## 功能

- 批量注册 OpenAI 账号
- 支持多种邮箱提供商：Cloudflare、Gmail、Hotmail、GPTMail 等
- 自动获取邮箱验证码

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置
cp config.example.json config.json
# 编辑 config.json，填入代理地址和邮箱配置

# 3. 注册
npm run dev -- --n 1
```

## 常用命令

```bash
npm run dev -- --n 1                          # 注册 1 个账号
npm run dev -- --n 5                          # 注册 5 个账号
npm run dev -- --email your@email.com         # 指定邮箱注册
```

## 配置说明

`config.json` 核心字段：

```json
{
  "provider": "cloudflare",
  "defaultProxyUrl": "http://127.0.0.1:10808",
  "defaultPassword": "your_password"
}
```

根据 `provider` 不同，需要配置对应的邮箱参数：

| provider | 必填配置 |
|----------|----------|
| `cloudflare` | `cloudflareEmailDomain`, `cloudflareApiBaseUrl`, `cloudflareApiKey` |
| `gmail` | `gmailAccessToken`, `gmailEmailAddress` |
| `hotmail` | `hotmail/tokens.txt` 文件 |
| `gptmail` | `gptMailApiKey` |
| `2925` | `2925EmailAddress`, `2925Password` |

## 安全提醒

以下文件已被 `.gitignore` 排除，请勿提交：

- `config.json` — 配置（含代理、API Key）
- `accounts/` — 账号密码
- `auth/` — 授权文件

## 项目结构

```
src/
├── index.ts              # 主入口
├── openai.ts             # OpenAI 注册核心
├── config.ts             # 配置定义
├── constants.ts          # 常量
├── mail/                 # 邮箱 provider
│   ├── cloudflare.ts
│   ├── gmail.ts
│   ├── hotmail.ts
│   ├── gptmail.ts
│   └── 2925.ts
└── utils.ts              # 工具函数
```

## 致谢

- [klsf/codex-register](https://github.com/klsf/codex-register)

## 许可证

MIT
