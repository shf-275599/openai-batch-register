# Register-Only Minimal Design

## Goal

将 `codex-register` 裁剪成“只保留注册成功即结束”的最小版本。保留邮箱注册所需的代理、设备指纹、Sentinel、邮箱验证码 provider 和注册状态机；删除手机号验证、授权换 token、auth 文件、额度检查、CLIProxyAPI 上传和批量注册等不再需要的能力。

## Scope

### 保留

- `config.json` 读取
- 代理能力
- 设备指纹生成
- Sentinel token 获取
- 邮箱 provider 抽象与各 provider 的验证码轮询
- 单次注册和自动循环注册
- CLI 参数：`--email`、`--otp`、`--n`、`--st`

### 删除

- 手机号验证 / HeroSMS / `src/sms/*`
- `--sign`
- `--auth`
- 登录授权流程
- OAuth code/token 交换
- `auth/*.json` 生成与保存
- `check-auth-quota`
- `check:cpa`
- `batch-register`
- `cliproxyapi`
- HeroSMS / CLIProxyAPI 配置项与文档

## Approach Options

### Option A: 温和裁剪

仅关闭入口并删除少量无用文件，保留 `openai.ts` 中大量授权相关死代码。

**优点**：改动小。  
**缺点**：残留大量无用逻辑，后续维护成本高。

### Option B: 最小可运行重构（推荐）

保留现有注册链路，但系统性删除手机号、授权、额度检查和上传能力；同时将 `OpenAIClient` 精简为只负责注册流程。

**优点**：结果干净、可维护、最符合当前用途。  
**缺点**：改动面比温和裁剪更大。

### Option C: 新写一个极简注册器

新建单独实现，旧代码大量保留但不再使用。

**优点**：实现直观。  
**缺点**：仓库会留下大量死代码，不符合本次“删干净”的目标。

## Recommended Design

采用 **Option B**。

### Architecture

主入口 `src/index.ts` 只保留“注册”语义：

- 指定邮箱时执行一次注册
- 未指定邮箱时按 `--n` / `loopDelayMs` 循环注册
- 成功后只输出注册成功信息

`src/openai.ts` 精简为单一职责的注册客户端：

- 初始化 ChatGPT / OpenAI 注册会话
- 生成或接收邮箱
- 提交邮箱、密码、邮箱验证码
- 填写 about-you
- 完成注册 callback

不再包含：

- 登录授权
- workspace 选择
- OAuth callback code 解析
- code 换 token
- auth 文件保存
- 登录后的 add-phone 授权分支

### File Plan

#### Delete

- `src/sms/activation-broker.ts`
- `src/sms/heroSMS.ts`
- `src/sms/index.ts`
- `src/sms/provider.ts`
- `src/check-auth-quota.ts`
- `src/batch-register.ts`
- `src/cliproxyapi.ts`
- `ADD_PHONE_HERO_SMS.md`

#### Heavy edits

- `src/index.ts`
- `src/openai.ts`
- `src/config.ts`
- `config.example.json`
- `package.json`
- `tsup.config.ts`
- `README.md`

#### Keep with minimal or no changes

- `src/constants.ts`（可能删掉仅授权使用的常量）
- `src/device-profile.ts`
- `src/sentinel.ts`
- `src/sentinel-browser.ts`
- `src/mailbox.ts`
- `src/mail/*`
- `src/utils.ts`

## Data Flow

1. 读取 `config.json`
2. 根据 `provider` 初始化邮箱 provider
3. 创建 `OpenAIClient`
4. 打开注册页并建立 cookie / `oai-did`
5. 生成 Sentinel token
6. 提交邮箱、密码
7. 发送并读取邮箱验证码
8. 提交基础资料
9. 完成注册 callback
10. 输出注册成功并退出/进入下一轮

## CLI Behavior

### Supported commands

```bash
npm run dev
npm run dev -- --n 1
npm run dev -- --email your_mail@example.com
npm run dev -- --email your_mail@example.com --otp
npm run start
```

### Removed commands

- `--auth`
- `--sign`
- `npm run check`
- `npm run check:cpa`
- `npm run batch`

## Config Changes

### Keep

- `provider`
- `defaultProxyUrl`
- `defaultPassword`
- `loopDelayMs`
- 各邮箱 provider 所需字段

### Remove

- `heroSMSApiKey`
- `heroSMSCountry`
- `heroSMSMaxPrice`
- `heroSMSPollAttempts`
- `heroSMSPollIntervalMs`
- `cliproxyApiAutoUploadAuth`
- `cliproxyApiBaseUrl`
- `cliproxyApiManagementKey`

## Error Handling

- 保留现有注册阶段错误输出
- 自动循环中失败只计数并继续下一轮
- 手动模式失败后直接退出
- 不再出现任何“授权成功/授权失败/auth 文件”相关文案

## Verification Strategy

- `npm install`
- `npm run build`
- 静态检查以下事实：
  - `package.json` 不再暴露 `check` / `check:cpa` / `batch`
  - `src/index.ts` 不再引用授权路径
  - `src/openai.ts` 不再包含 token 保存 / 登录授权 / 手机验证依赖
  - `README.md` 只描述注册用法

## Non-Goals

- 不重新设计邮箱 provider
- 不重写 Sentinel 算法
- 不引入新的测试框架
- 不保留兼容旧 auth 文件工作流
