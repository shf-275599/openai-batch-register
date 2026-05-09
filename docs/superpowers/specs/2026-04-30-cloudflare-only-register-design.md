# Cloudflare-Only Register Design

## Goal

继续精简 `codex-register`，将其收敛为 **只支持 Cloudflare 邮箱路由** 的 OpenAI 注册工具，同时做中度整理，让项目结构、配置和文档都只围绕这一条路径展开。

## Scope

### 保留

- 注册入口与循环执行
- `OpenAIClient` 注册状态机
- 代理能力
- 设备指纹
- Sentinel 与浏览器 Sentinel 备用模式
- Cloudflare 邮件 provider
- Cloudflare Worker 部署说明

### 删除

- `proxiedmail`
- `hotmail`
- `2925`
- `gmail`
- `gptmail`
- 所有对应的配置项、文档和 provider 分发逻辑

## Recommended Approach

采用“**单 provider + 注册流程收拢**”方案：

1. 项目目标明确为 Cloudflare-only
2. `config.ts` 只保留通用字段和 Cloudflare 字段
3. `mailbox.ts` 不再做 provider switch，而是直接封装 Cloudflare provider
4. `README.md` 只保留 Cloudflare 安装/配置/运行说明
5. 删除所有其他 provider 文件和相关文档
6. 对 `openai.ts` 做中度整理，只清掉多 provider 兼容痕迹，不做深度拆文件

## File Plan

### Keep

- `src/index.ts`
- `src/openai.ts`
- `src/constants.ts`
- `src/config.ts`
- `src/device-profile.ts`
- `src/sentinel.ts`
- `src/sentinel-browser.ts`
- `src/utils.ts`
- `src/mail/cloudflare.ts`
- `src/mail/generate-email-name.ts`
- `src/mail/verification-matcher.ts`
- `MAIL_WORKER_DEPLOY.md`
- `MAIL_WORKER_UPLOAD.js`

### Delete

- `src/mail/proxiedmail.ts`
- `src/mail/hotmail.ts`
- `src/mail/2925.ts`
- `src/mail/gmail.ts`
- `src/mail/gptmail.ts`
- `GMAIL_OAUTH_PLAYGROUND.md`

### Modify

- `src/config.ts`
- `config.example.json`
- `src/mailbox.ts`
- `README.md`
- `src/openai.ts`

## Architecture

### Configuration

配置层只保留：

- `defaultProxyUrl`
- `defaultPassword`
- `loopDelayMs`
- `cloudflareEmailDomain`
- `cloudflareApiBaseUrl`
- `cloudflareApiKey`

不再保留 provider 选择器；项目默认就是 Cloudflare-only。

### Mailbox Layer

`mailbox.ts` 从“多 provider 调度器”改为“单 provider 适配入口”：

- `getEmailAddress()` → 直接调用 Cloudflare provider
- `getEmailVerificationCode()` → 直接调用 Cloudflare provider

这样其他层无需知道 provider 细节，但项目内部也不再保留无意义的 switch 逻辑。

### Registration Flow

`openai.ts` 继续负责：

- 初始化会话
- 提交邮箱
- 提交密码
- 邮件验证码
- about-you
- 完成注册

中度整理只做：

- 删除与多 provider 相关的注释/兼容痕迹
- 保持单文件但让其职责更清晰

不做：

- 深度拆分多个新模块

## CLI Behavior

CLI 不变，仍保留：

- `--n`
- `--email`
- `--otp`
- `--st`

但文档和配置层明确说明：

> 该项目只支持 Cloudflare 邮箱路由方案。

## Verification Strategy

- `npm install`
- `npm run build`
- 验证以下事实：
  - `src/mail/` 只剩 Cloudflare 相关实现和通用辅助文件
  - `config.example.json` 只包含 Cloudflare 需要的字段
  - `README.md` 不再提及其他 provider
  - `mailbox.ts` 不再有 provider switch

## Non-Goals

- 不重写 Sentinel
- 不深拆 `openai.ts`
- 不修改 Cloudflare Worker 实现协议
