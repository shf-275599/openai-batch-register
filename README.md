# openai-batch-register

基于 [klsf/codex-register](https://github.com/klsf/codex-register) 的个人复刻。

批量注册 OpenAI 账号 → 授权 Codex → 生成 auth 文件 → 检查额度。

## 功能

| 功能 | 命令 |
|------|------|
| 批量注册 | `npm run dev -- --n 1` |
| 注册并授权 | `npm run dev -- --email xxx --sign` |
| 只做授权 | `npm run dev -- --email xxx --auth` |
| 检查额度 | `npm run check` |
| 检查 CPA 额度 | `npm run check:cpa` |

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置
cp config.example.json config.json
# 编辑 config.json，填入代理地址和邮箱配置

# 3. 运行
npm run dev -- --n 1
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

## 检查额度

```bash
npm run check                              # 检查本地 auth 目录
npm run check -- --limit 20 --table        # 检查前 20 个
npm run check -- --refresh --table         # 刷新 token 后检查
npm run check -- -c 8                      # 8 并发
npm run check:cpa                          # 从 CLIProxyAPI 检查
```

输出示例：

```
[✅️][free][100.00%]someone@example.com
[❌️]someone@example.com-token expired

总数 10 | 可用 8 | 限额 1 | 可用额度 6.42
```

## CLIProxyAPI 集成

授权成功后自动上传 auth 文件：

```json
{
  "cliproxyApiAutoUploadAuth": true,
  "cliproxyApiBaseUrl": "http://localhost:8317",
  "cliproxyApiManagementKey": "your_key"
}
```

## 安全提醒

以下文件已被 `.gitignore` 排除，请勿提交：

- `config.json` — 配置（含代理、API Key）
- `accounts/` — 账号密码
- `auth/` — 授权文件

## 项目结构

```
src/
├── index.ts              # 主入口
├── openai.ts             # OpenAI 注册/授权核心
├── check-auth-quota.ts   # 额度检查
├── cliproxyapi.ts        # CLIProxyAPI 集成
├── batch-register.ts     # 批量注册
├── config.ts             # 配置定义
├── constants.ts          # 常量
├── mail/                 # 邮箱 provider
│   ├── cloudflare.ts
│   ├── gmail.ts
│   ├── hotmail.ts
│   ├── gptmail.ts
│   └── 2925.ts
└── sms/                  # 短信 provider
    └── heroSMS.ts
```

## 致谢

- [klsf/codex-register](https://github.com/klsf/codex-register)

## 许可证

MIT
