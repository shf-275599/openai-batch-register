# codex-register

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-v1.0.6-111827">
  <img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/klsf/codex-register?style=social">
</p>

一个基于 **Node.js + TypeScript** 的命令行工具，用于通过 **Cloudflare Email Routing + 自建 Cloudflare Worker 邮件查询 API** 批量注册 OpenAI 账号。每次注册成功后，当前流程立即结束；在自动模式下，程序会按设定轮次继续下一次注册。

---

## 免责声明

本项目仅供学习、研究与接口行为测试使用。使用者应自行确保其用途符合目标平台的服务条款、当地法律法规以及所在网络环境的合规要求。

因使用本项目导致的账号风险、访问限制、数据丢失、封禁、法律责任或其他任何损失，均由使用者自行承担，项目作者与维护者不承担任何直接或间接责任。

---

## 这是什么

这个项目本质上是一个 **注册流程自动化 CLI**，主要做三件事：

1. 调用 OpenAI 注册接口，完成邮箱、密码、验证码、资料填写等步骤。
2. 自动生成 `随机前缀@你的域名` 作为注册邮箱。
3. 通过 Cloudflare Worker API 轮询该邮箱收到的验证码邮件，并自动提交验证码。

如果你已经有：

- 一个可用代理
- 一个已配置好 **Cloudflare Email Routing** 的域名
- 一个能查询邮件的 **Cloudflare Worker API**

那么这个项目就能把整套注册流程串起来跑通。

---

## 它为什么这样设计

OpenAI 注册流程里最麻烦的部分，不是发请求本身，而是 **邮箱验证码链路**。这个项目把问题拆成了两段：

```text
本地 CLI
  -> 发起 OpenAI 注册
  -> 使用随机邮箱前缀@你的域名
  -> Cloudflare Email Routing 收信
  -> Cloudflare Worker + D1 存储邮件
  -> CLI 轮询 Worker API 获取验证码
  -> 回填 OTP 完成注册
```

这样做的好处是：

- 程序不需要接真实邮箱 IMAP/POP3
- 任意随机前缀邮箱都能收信，适合自动化
- 邮件查询接口完全由你自己控制

---

## 为什么有时候自定义 Worker 域名更稳

`cloudflareApiBaseUrl` 只是项目里的一个普通 HTTPS 基地址。程序不会区分它是 `workers.dev`，还是你自己的自定义域名；它只会去请求：

- `${cloudflareApiBaseUrl}/latest`
- `${cloudflareApiBaseUrl}/emails`

但是在实际网络环境里，`workers.dev` 和自定义域名并不一定有完全相同的可达性。

在本项目的一次实际验证中，出现过下面这种情况：

- `https://xxx.workers.dev` TLS 握手失败
- `https://mail-api.your-domain.com` 可以正常返回 JSON

这说明问题往往不在 Worker 代码本身，而在 **访问入口**：

- TLS / SNI / 证书链差异
- 网络环境对平台域名的特殊处理
- 代理、DNS、边缘路由对 `workers.dev` 和自定义域名的不同表现

所以，如果你发现 `workers.dev` 地址不稳定、握手失败、或者从某些环境无法访问，**优先尝试改成自定义域名**。更准确地说，这不是代码逻辑差异，而是不同域名入口在你的网络环境里表现不同。一个常见可用写法是：

```text
https://mail-api.your-domain.com
```

---

## 运行前你需要准备什么

- Node.js 18+
- 已安装依赖：`npm install`
- 项目根目录下的 `config.json`
- 一个可用代理，程序默认读取 `config.json.defaultProxyUrl`
- 一个已配置好 **Cloudflare Email Routing** 的域名
- 一个可查询邮件的 **Cloudflare Worker API**

---

## Cloudflare 侧为什么要这样配置

这个项目能跑通，不只是因为本地 CLI 能发请求，更关键的是 **验证码邮件必须能被自动接收、保存、查询、再回填到注册流程里**。Cloudflare 侧的配置，本质上就是为了打通这条链路：

```text
OpenAI 发送验证码邮件
  -> Cloudflare Email Routing 收到域名邮件
  -> Worker 接收邮件事件
  -> D1 存储邮件内容
  -> Worker API 对外提供查询接口
  -> 本地 CLI 轮询验证码并提交 OTP
```

所以 Cloudflare 里的每一步都不是“为了配而配”，而是分别承担不同职责：

### 1. 为什么要创建 D1

Worker 需要一个地方保存收到的邮件，否则邮件事件来了也没有可查询的持久化结果。

在这个项目里，D1 的职责是：

- 保存邮件正文、主题、发件人、时间等信息
- 让 Worker API 能按邮箱查询“最新邮件”或“邮件列表”
- 让本地程序可以轮询验证码，而不是只能在邮件到达的瞬间处理

简单说，**D1 是这个邮件验证码链路的存储层**。

### 2. 为什么 Worker 要绑定 D1，而且变量名必须是 `DB`

Cloudflare Worker 访问平台资源时，不是直接写数据库连接串，而是通过 **binding** 来拿到能力。

这个项目里的 Worker 脚本约定用 `DB` 这个名字读取 D1 binding，所以：

- 必须绑定 D1
- 变量名必须叫 `DB`

如果你绑定了 D1，但名字不是 `DB`，脚本就拿不到数据库实例，邮件虽然可能收到了，但无法正常写入或查询。

### 3. 为什么要配置 `API_KEY` Secret

本地 CLI 访问 Worker API 时，会带上 `x-api-key`。这一步是为了避免你的邮件查询接口被任何人直接公开调用。

把它配置成 Cloudflare Secret，而不是写死在代码里，原因是：

- Secret 适合存放敏感信息
- 不会把密钥直接暴露在仓库代码中
- 后续更换密钥时，不需要改 Worker 代码逻辑

简单说，**`API_KEY` 是这个邮件查询接口的鉴权层**。

### 4. 为什么建议给 Worker 绑定自定义域

这个项目只要求 `cloudflareApiBaseUrl` 是一个可访问的 HTTPS 地址。代码本身不会区分它是 `workers.dev`，还是你自己的域名。

但在实际网络环境里，不同 hostname 的表现不一定一样。常见差异包括：

- TLS / SNI / 证书链差异
- DNS 解析路径差异
- 代理或网络环境对平台域名的特殊处理

因此，当 `workers.dev` 地址在某些环境下不稳定时，自定义域往往更容易作为一个稳定入口来使用。

对这个项目来说，自定义域的价值不是“代码逻辑不同”，而是：

- Worker API 更像一个稳定的业务接口
- 便于你在 `config.json` 里长期固定使用
- 某些网络环境下可达性更好

### 5. 为什么要配置 Email Routing，而且推荐 catch-all

这个项目会自动生成随机前缀邮箱，例如：

```text
abc123@your-domain.com
```

如果你的 Email Routing 只配置单个固定邮箱，那么随机生成出来的邮箱可能根本收不到信。

推荐使用 catch-all 的原因是：

- 任意随机前缀邮箱都能被接收
- 更适合批量注册和自动化流程
- 不需要每次提前创建具体邮箱地址

简单说，**Email Routing + catch-all 是“让随机邮箱真的能收到验证码”的关键**。

---

## Cloudflare 侧配置流程

下面这部分只讲最短流程和每一步的目的；如果你需要详细点击步骤、SQL 和接口示例，请继续看：

- [MAIL_WORKER_DEPLOY.md](./MAIL_WORKER_DEPLOY.md)

### 第 1 步：创建 D1 数据库

在 Cloudflare 控制台创建一个 D1 数据库，例如：

```text
mail-db
```

**为什么要做这一步：** Worker 需要一个地方保存收到的邮件内容，供后续 API 查询。

### 第 2 步：初始化邮件表结构

按 `MAIL_WORKER_DEPLOY.md` 中的 SQL 初始化 `emails` 表。

**为什么要做这一步：** 没有表结构，Worker 即使收到了邮件，也没有地方落库，自然也无法让 CLI 轮询验证码。

### 第 3 步：创建 Worker 并上传 `MAIL_WORKER_UPLOAD.js`

在 Cloudflare Workers & Pages 中创建 Worker，把项目里的 [`MAIL_WORKER_UPLOAD.js`](./MAIL_WORKER_UPLOAD.js) 内容粘进去并部署。

**为什么要做这一步：** 这个 Worker 同时承担两件事：

- 接收 Email Routing 转发过来的邮件
- 提供 `/latest`、`/emails` 等查询接口给本地 CLI 使用

### 第 4 步：给 Worker 绑定 D1，变量名设为 `DB`

在 Worker 设置中添加 D1 binding：

- Variable name: `DB`
- Database: 选择你刚创建的 D1

**为什么要做这一步：** Worker 脚本就是按 `DB` 这个变量名读取数据库能力的。

### 第 5 步：给 Worker 添加 Secret，名字设为 `API_KEY`

在 Worker 设置中添加 Secret：

- Name: `API_KEY`
- Value: 你自己定义的一串密钥

**为什么要做这一步：** 本地 CLI 查询邮件时需要带 `x-api-key`，否则任何人只要知道你的 API 地址就可能直接读取邮件数据。

### 第 6 步：给 Worker 绑定自定义域（推荐）

例如绑定成：

```text
mail-api.your-domain.com
```

**为什么要做这一步：** 在某些网络、代理、TLS 环境下，自定义域会比 `workers.dev` 更稳定，也更适合作为长期写入 `config.json` 的固定接口地址。

### 第 7 步：配置 Email Routing，并尽量使用 catch-all

让你域名下的邮件可以被转发给这个 Worker。

**为什么要做这一步：** 程序会动态生成随机邮箱前缀；如果不用 catch-all，很多随机地址可能无法收到验证码邮件。

### 第 8 步：先测试 Worker API，再回填到 `config.json`

确认带 `x-api-key` 访问你的 Worker API 可以正常返回 JSON，然后把这些值填入项目根目录的 `config.json`：

- `cloudflareEmailDomain`
- `cloudflareApiBaseUrl`
- `cloudflareApiKey`

**为什么要先测 API：** 这样可以先把 Cloudflare 侧链路验证通过，再排查本地 CLI 问题，避免把问题混在一起。

---

## 怎么做：一步一步配置并运行

### 第 1 步：安装依赖

```bash
npm install
```

### 第 2 步：准备 `config.json`

把 `config.example.json` 复制为 `config.json`，然后按你的环境填写：

```json
{
  "defaultProxyUrl": "http://127.0.0.1:10808",
  "defaultPassword": "kuaileshifu88",
  "loopDelayMs": 30000,
  "cloudflareEmailDomain": "your-domain.com",
  "cloudflareApiBaseUrl": "https://mail-api.your-domain.com",
  "cloudflareApiKey": "your_api_key"
}
```

> 如果你的 `workers.dev` 地址能稳定访问，也可以继续使用它。
> 但如果出现 TLS、网络或代理环境下的访问问题，建议改成自定义域名。

### 第 3 步：确认 Cloudflare 侧已经配好

你至少要保证三件事已经完成：

1. **Email Routing 已启用**
2. **Worker 已部署并绑定 D1**
3. **Worker API 可以带 `x-api-key` 正常返回 JSON**

如果还没有部署 Worker，请先看：

- [MAIL_WORKER_DEPLOY.md](./MAIL_WORKER_DEPLOY.md)

### 第 4 步：启动程序

```bash
npm run dev
```

如果配置正确，程序会：

1. 创建注册会话
2. 生成随机注册邮箱
3. 提交邮箱与密码
4. 发送邮箱验证码
5. 轮询 Worker API 取回验证码
6. 自动提交 OTP
7. 完成注册

---

## `config.json` 配置说明

```json
{
  // WSL 直连
  "defaultProxyUrl": "",
  "defaultPassword": "xigaizhonjian",
  "loopDelayMs": 30000,
  "cloudflareEmailDomain": "your-domain.com",
  "cloudflareApiBaseUrl": "https://mail-api.your-domain.com",
  "cloudflareApiKey": "your_api_key"
}
```

### `defaultProxyUrl`

默认代理地址。注册流程和邮件查询都会通过它发起请求。

如果你在 WSL、Linux 或其他环境里已经启用了系统级透明代理（例如 Clash TUN），`defaultProxyUrl` 也可以留空；这时程序表面上是直连，但实际流量可能已经被系统网络层接管。

只有在你明确知道当前环境需要**显式指定一个可访问的 HTTP / SOCKS 代理地址**时，才建议在这里填写具体代理地址。

### `defaultPassword`

注册成功后账号默认使用的密码。

### `loopDelayMs`

自动模式下每轮之间的等待时间，单位毫秒。

README 里的 `30000` 是示例值，不是代码内置默认值。

### `cloudflareEmailDomain`

你的 Cloudflare Email Routing 域名。程序会生成：

```text
随机前缀@your-domain.com
```

### `cloudflareApiBaseUrl`

你的 Cloudflare Worker 邮件查询 API 基地址。程序会用它拼接：

- `/latest?to=...`
- `/emails?to=...`

如果你的网络环境对 `workers.dev` 不稳定，可以改用你自己的自定义域名，例如：

```text
https://mail-api.your-domain.com
```

### `cloudflareApiKey`

你的 Worker API 使用的 `x-api-key`。

> 注意：当前运行时实际读取的配置项只有 README 中列出的这些字段。某些旧文档或示例里如果出现额外字段，不代表当前代码必须使用它们。

---

## 常用命令

### 开发模式运行

```bash
npm run dev
```

### 只跑 1 轮

```bash
npm run dev -- --n 1
```

### 指定邮箱注册

```bash
npm run dev -- --email your_mail@example.com
```

### 指定邮箱并手动输入验证码

```bash
npm run dev -- --email your_mail@example.com --otp
```

### 构建

```bash
npm run build
```

### 运行构建后的主程序

```bash
npm run start
```

---

## 主程序参数

`npm run dev` 和 `npm run start` 参数一致：

```bash
npm run dev -- [参数]
npm run start -- [参数]
```

### 参数说明

- `--n <次数>`
  - 自动模式最多跑多少轮
- `--email <邮箱>`
  - 指定单个邮箱执行
- `--otp`
  - 手动输入邮箱验证码
- `--st`
  - Sentinel 使用浏览器模式

### 示例

#### 自动模式只跑 1 次

```bash
npm run dev -- --n 1
```

#### 指定邮箱注册

```bash
npm run dev -- --email your_mail@example.com
```

#### 指定邮箱并手动输入验证码

```bash
npm run dev -- --email your_mail@example.com --otp
```

---

## Cloudflare Worker 部署

如果你还没有用于查询邮件的 Worker API，请先按这个文档部署：

- [MAIL_WORKER_DEPLOY.md](./MAIL_WORKER_DEPLOY.md)

部署完成后，把下面两项填入 `config.json`：

- Worker API 地址 -> `cloudflareApiBaseUrl`
- Worker API Key -> `cloudflareApiKey`

如果你已经给 Worker 绑定了自定义域，建议把该自定义域作为 `cloudflareApiBaseUrl`。

---

## 如何快速验证 Worker API 是否可用

假设：

- API 地址：`https://mail-api.your-domain.com`
- API key：`your_api_key`
- 测试邮箱：`admin@your-domain.com`

查询某个邮箱的邮件列表：

```bash
curl -H "x-api-key: your_api_key" "https://mail-api.your-domain.com/emails?to=admin@your-domain.com"
```

查询某个邮箱的最新邮件：

```bash
curl -H "x-api-key: your_api_key" "https://mail-api.your-domain.com/latest?to=admin@your-domain.com"
```

如果能正常返回 JSON，说明 Worker API 至少已经可访问且鉴权配置正确。
