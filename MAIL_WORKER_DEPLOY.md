# 自建邮箱 Worker 手动部署教程

## 前置条件

你需要准备好：

- 一个 Cloudflare 账号
- 一个已接入 Cloudflare 的域名
- 一个 D1 数据库

## 第一步：创建 D1 数据库

进 Cloudflare 后台：

1. 打开 `Storage & Databases`
2. 找到 `D1`
3. 新建一个数据库

名字随便起，建议：

```text
mail-db
```

## 第二步：初始化表结构

进入这个 D1 数据库，打开控制台或查询页面，执行下面这段 SQL：

```sql
CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mailbox TEXT NOT NULL,
  from_email TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  message_id TEXT NOT NULL DEFAULT '',
  raw_text TEXT NOT NULL DEFAULT '',
  received_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_emails_mailbox_received_at
ON emails (mailbox, received_at DESC, id DESC);
```

这里的设计就是：

- 一封邮件 = 一行
- `raw_text` 优先存解析后的正文文本
- 如果正文解析失败，就退回存原始 MIME 文本
- 按 `mailbox + received_at` 查最新邮件

## 第三步：创建 Worker

进入 Cloudflare 后台：

1. 打开 `Workers & Pages`
2. 点 `Create`
3. 点 `从 Hello World! 开始`
4. Worker 名字建议填：

```text
mail-d1-api
```

## 第四步：粘贴单文件代码

创建完成后，进入 Worker 的代码编辑页。

把默认 Hello World 代码全部删掉，再把 [`MAIL_WORKER_UPLOAD.js`](MAIL_WORKER_UPLOAD.js) 的全部内容粘进去。

```json
function normalizeEmailAddress(value) {
  return (value || "").trim().toLowerCase();
}

function unauthorized() {
  return new Response("unauthorized", { status: 401 });
}

function notFound() {
  return new Response("not found", { status: 404 });
}

function badRequest(message) {
  return new Response(message, { status: 400 });
}

function json(data, init) {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
  });
}

function getHeaderValue(headers, name) {
  return headers.get(name) || "";
}

function splitHeaderAndBody(source) {
  const normalized = source.replace(/\r\n/g, "\n");
  const dividerIndex = normalized.indexOf("\n\n");
  if (dividerIndex === -1) {
    return {
      headerText: normalized,
      bodyText: "",
    };
  }

  return {
    headerText: normalized.slice(0, dividerIndex),
    bodyText: normalized.slice(dividerIndex + 2),
  };
}

function parseHeaderLines(headerText) {
  const headers = new Map();
  const lines = headerText.split("\n");
  let currentName = "";
  let currentValue = "";

  for (const line of lines) {
    if (!line) {
      continue;
    }

    if (/^[ \t]/.test(line) && currentName) {
      currentValue += ` ${line.trim()}`;
      headers.set(currentName, currentValue);
      continue;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }

    currentName = line.slice(0, colonIndex).trim().toLowerCase();
    currentValue = line.slice(colonIndex + 1).trim();
    headers.set(currentName, currentValue);
  }

  return headers;
}

function getBoundary(contentType) {
  const match = /boundary="?([^";]+)"?/i.exec(contentType || "");
  return match ? match[1] : "";
}

function getCharset(contentType) {
  const match = /charset="?([^";]+)"?/i.exec(contentType || "");
  return (match ? match[1] : "utf-8").trim().toLowerCase();
}

function decodeBytes(bytes, charset) {
  const normalizedCharset = charset || "utf-8";

  try {
    return new TextDecoder(normalizedCharset).decode(bytes);
  } catch {}

  try {
    return new TextDecoder("utf-8").decode(bytes);
  } catch {}

  return String.fromCharCode(...bytes);
}

function decodeQuotedPrintable(text, charset) {
  const input = (text || "").replace(/=\r?\n/g, "");
  const bytes = [];

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === "=" && /^[A-Fa-f0-9]{2}$/.test(input.slice(index + 1, index + 3))) {
      bytes.push(parseInt(input.slice(index + 1, index + 3), 16));
      index += 2;
      continue;
    }
    bytes.push(char.charCodeAt(0));
  }

  return decodeBytes(Uint8Array.from(bytes), charset);
}

function decodeBase64(text, charset) {
  const cleaned = text.replace(/\s+/g, "");
  if (!cleaned) {
    return "";
  }

  try {
    const binary = atob(cleaned);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return decodeBytes(bytes, charset);
  } catch {
    return text;
  }
}

function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function decodeMimeBody(bodyText, transferEncoding, contentType) {
  let decoded = bodyText || "";
  const charset = getCharset(contentType);

  if (/quoted-printable/i.test(transferEncoding || "")) {
    decoded = decodeQuotedPrintable(decoded, charset);
  } else if (/base64/i.test(transferEncoding || "")) {
    decoded = decodeBase64(decoded, charset);
  }

  if (/text\/html/i.test(contentType || "")) {
    return stripHtml(decoded);
  }

  return decoded.trim();
}

function extractTextFromMimePart(partSource) {
  const { headerText, bodyText } = splitHeaderAndBody(partSource);
  const headers = parseHeaderLines(headerText);
  const contentType = headers.get("content-type") || "text/plain";
  const transferEncoding = headers.get("content-transfer-encoding") || "";

  if (/multipart\//i.test(contentType)) {
    return extractBestBodyText(partSource);
  }

  if (/text\/plain/i.test(contentType) || /text\/html/i.test(contentType)) {
    return decodeMimeBody(bodyText, transferEncoding, contentType);
  }

  return "";
}

function extractMultipartParts(bodyText, boundary) {
  const marker = `--${boundary}`;
  const endMarker = `--${boundary}--`;
  const lines = bodyText.replace(/\r\n/g, "\n").split("\n");
  const parts = [];
  let current = [];
  let collecting = false;

  for (const line of lines) {
    if (line === marker || line === endMarker) {
      if (collecting && current.length > 0) {
        parts.push(current.join("\n").trim());
        current = [];
      }
      collecting = line !== endMarker;
      continue;
    }

    if (collecting) {
      current.push(line);
    }
  }

  if (current.length > 0) {
    parts.push(current.join("\n").trim());
  }

  return parts.filter(Boolean);
}

function extractBestBodyText(rawSource) {
  const { headerText, bodyText } = splitHeaderAndBody(rawSource);
  const headers = parseHeaderLines(headerText);
  const contentType = headers.get("content-type") || "text/plain";

  if (!/multipart\//i.test(contentType)) {
    return extractTextFromMimePart(rawSource);
  }

  const boundary = getBoundary(contentType);
  if (!boundary) {
    return bodyText.trim();
  }

  const parts = extractMultipartParts(bodyText, boundary);
  const textParts = [];
  const htmlParts = [];

  for (const part of parts) {
    const { headerText: partHeaderText } = splitHeaderAndBody(part);
    const partHeaders = parseHeaderLines(partHeaderText);
    const partContentType = partHeaders.get("content-type") || "";
    const extracted = extractTextFromMimePart(part);

    if (!extracted) {
      continue;
    }

    if (/text\/plain/i.test(partContentType)) {
      textParts.push(extracted);
      continue;
    }

    if (/text\/html/i.test(partContentType)) {
      htmlParts.push(extracted);
    }
  }

  if (textParts.length > 0) {
    return textParts.join("\n\n").trim();
  }

  if (htmlParts.length > 0) {
    return htmlParts.join("\n\n").trim();
  }

  return bodyText.trim();
}

async function readRawMessage(message) {
  try {
    if (typeof message.raw === "string") {
      return message.raw;
    }
  } catch {}

  try {
    if (message.raw) {
      return await new Response(message.raw).text();
    }
  } catch {}

  return "";
}

async function insertEmail(env, record) {
  await env.DB.prepare(
    `INSERT INTO emails (
      mailbox,
      from_email,
      subject,
      message_id,
      raw_text,
      received_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      record.mailbox,
      record.fromEmail,
      record.subject,
      record.messageId,
      record.rawText,
      record.receivedAt,
    )
    .run();
}

async function listEmails(env, mailbox, limit, offset) {
  const result = await env.DB.prepare(
    `SELECT
      id,
      mailbox,
      from_email,
      subject,
      message_id,
      raw_text,
      received_at
    FROM emails
    WHERE mailbox = ?
    ORDER BY received_at DESC, id DESC
    LIMIT ? OFFSET ?`,
  )
    .bind(mailbox, limit, offset)
    .all();

  return Array.isArray(result.results) ? result.results : [];
}

async function getLatestEmail(env, mailbox) {
  const result = await env.DB.prepare(
    `SELECT
      id,
      mailbox,
      from_email,
      subject,
      message_id,
      raw_text,
      received_at
    FROM emails
    WHERE mailbox = ?
    ORDER BY received_at DESC, id DESC
    LIMIT 1`,
  )
    .bind(mailbox)
    .first();

  return result || null;
}

async function getEmailById(env, id) {
  const result = await env.DB.prepare(
    `SELECT
      id,
      mailbox,
      from_email,
      subject,
      message_id,
      raw_text,
      received_at
    FROM emails
    WHERE id = ?`,
  )
    .bind(id)
    .first();

  return result || null;
}

async function deleteEmailById(env, id) {
  await env.DB.prepare("DELETE FROM emails WHERE id = ?").bind(id).run();
}

export default {
  async email(message, env) {
    const mailbox = normalizeEmailAddress(message.to);
    const fromEmail = normalizeEmailAddress(message.from);
    const subject = getHeaderValue(message.headers, "subject");
    const messageId = getHeaderValue(message.headers, "message-id");
    const rawSource = await readRawMessage(message);
    const bodyText = extractBestBodyText(rawSource);
    const rawText = bodyText || rawSource;
    const receivedAt = Date.now();

    await insertEmail(env, {
      mailbox,
      fromEmail,
      subject,
      messageId,
      rawText,
      receivedAt,
    });
  },

  async fetch(request, env) {
    if (request.headers.get("x-api-key") !== env.API_KEY) {
      return unauthorized();
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/emails") {
      const mailbox = normalizeEmailAddress(url.searchParams.get("to"));
      if (!mailbox) {
        return badRequest("missing to query parameter");
      }

      const limitParam = Number(url.searchParams.get("limit") || 20);
      const offsetParam = Number(url.searchParams.get("offset") || 0);
      const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 100)) : 20;
      const offset = Number.isFinite(offsetParam) ? Math.max(0, offsetParam) : 0;
      const emails = await listEmails(env, mailbox, limit, offset);

      return json({
        mailbox,
        emails,
        limit,
        offset,
      });
    }

    if (request.method === "GET" && url.pathname === "/latest") {
      const mailbox = normalizeEmailAddress(url.searchParams.get("to"));
      if (!mailbox) {
        return badRequest("missing to query parameter");
      }

      const latest = await getLatestEmail(env, mailbox);
      if (!latest) {
        return notFound();
      }

      return json(latest);
    }

    if (request.method === "GET" && url.pathname.startsWith("/emails/")) {
      const id = Number(url.pathname.slice("/emails/".length));
      if (!Number.isInteger(id) || id <= 0) {
        return badRequest("invalid email id");
      }

      const email = await getEmailById(env, id);
      if (!email) {
        return notFound();
      }

      return json(email);
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/emails/")) {
      const id = Number(url.pathname.slice("/emails/".length));
      if (!Number.isInteger(id) || id <= 0) {
        return badRequest("invalid email id");
      }

      await deleteEmailById(env, id);
      return new Response("deleted");
    }

    return notFound();
  },
};

```

这份文件是纯 JS 单文件，不需要构建。

## 第五步：绑定 D1

在 Worker 设置里添加 D1 binding：

- Variable name: `DB`
- Database: 选择你刚创建的 D1 数据库

变量名必须是 `DB`，因为脚本里就是按这个名字读的。

## 第六步：配置 API_KEY

在 Worker 设置里添加一个 Secret：

- Name: `API_KEY`
- Value: 你自己定义的一串 key

这个 key 用于接口鉴权。

## 第七步：保存并部署

在 Cloudflare 编辑器里点保存并部署。

部署成功后会得到一个 Worker 地址，例如：

```text
https://mail-d1-api.xxx.workers.dev
```

## 第八步：绑定 Email Routing

去 Cloudflare 控制台配置 Email Routing，把你的域名邮件转到这个 Worker。

建议：

- 直接用 catch-all

这样程序生成任意随机前缀邮箱时，都能收到邮件。

## 第九步：测试接口

假设：

- Worker 地址：`https://mail-d1-api.xxx.workers.dev`
- API key：`your_api_key`
- 测试邮箱：`邮件名@网址名.域名`

查询某个邮箱的最新邮件：

```bash
curl -H "x-api-key: your_api_key" "https://mail-d1-api.xxx.workers.dev/latest?to=admin@example.com"
```

查询某个邮箱的邮件列表：

```bash
curl -H "x-api-key: your_api_key" "https://mail-d1-api.xxx.workers.dev/emails?to=admin@example.com"
```

查询某一封邮件：

```bash
curl -H "x-api-key: your_api_key" "https://mail-d1-api.xxx.workers.dev/emails/1"
```

删除某一封邮件：

```bash
curl -X DELETE -H "x-api-key: your_api_key" "https://mail-d1-api.xxx.workers.dev/emails/1"
```

除了直接用上面的接口验证，你也可以在 Cloudflare 后台辅助观察邮件是否已经进入 Worker：

- 打开 **Workers & Pages**
- 进入你部署的这个 Worker
- 查看 **Observability / Workers Logs**

如果测试邮件已经被 Email Routing 转发到 Worker，通常可以在这里看到对应的请求或处理日志。

不过，**最终是否写入成功、正文是否解析成功，还是以接口返回结果为准**；Cloudflare 后台更适合做“邮件有没有进来”的辅助确认。

如果你想进一步确认“邮件是不是已经真的写进 D1 数据库”，可以直接去 Cloudflare 的 D1 后台执行 SQL：

- 打开 **Storage & Databases**
- 进入你绑定给 Worker 的那个 **D1**
- 打开 **Console / Query**

例如，查询某个邮箱的最近 n 封邮件：

```sql
SELECT id, mailbox, from_email, subject, received_at
FROM emails
WHERE mailbox = '邮件名@网址名.域名'
ORDER BY received_at DESC
LIMIT n;
```

如果你想连正文一起看：

```sql
SELECT id, mailbox, from_email, subject, raw_text, received_at
FROM emails
WHERE mailbox = '邮件名@网址名.域名'
ORDER BY received_at DESC
LIMIT 1;
```

只要能在 D1 里查到对应记录，就说明邮件已经被 Worker 成功写入数据库。

## 返回格式

`GET /latest?to=xxx@example.com` 返回类似：

```json
{
  "id": 1,
  "mailbox": "xxx@example.com",
  "from_email": "noreply@example.com",
  "subject": "Your verification code",
  "message_id": "<abc@example.com>",
  "raw_text": "Your verification code is 123456",
  "received_at": 1770000000000
}
```

`GET /emails?to=xxx@example.com` 返回类似：

```json
{
  "mailbox": "xxx@example.com",
  "emails": [
    {
      "id": 1,
      "mailbox": "xxx@example.com",
      "from_email": "noreply@example.com",
      "subject": "Your verification code",
      "message_id": "<abc@example.com>",
      "raw_text": "Your verification code is 123456",
      "received_at": 1770000000000
    }
  ],
  "limit": 20,
  "offset": 0
}
```

## 接入当前项目

项目侧仍然在 [`config.json`](/H:/go/codex-register/config.json) 保持：

```json
{
  "defaultProxyUrl": "http://127.0.0.1:10808",
  "defaultPassword": "kuaileshifu88",
  "loopDelayMs": 30000,
  "cloudflareEmailDomain": "your-domain.com",
  "cloudflareApiBaseUrl": "https://mail-d1-api.xxx.workers.dev",
  "cloudflareApiKey": "your_api_key"
}
```

程序会生成：

```text
随机前缀@your-domain.com
```

然后去你这个 Worker 的接口里轮询该邮箱的最新邮件。

## 常见问题

### 1. 一封邮件真的只写一行吗

是。

当前表结构就是每封邮件插入 `emails` 表中的 1 行，没有拆附件表、头信息表、索引表。

### 2. 邮件原文会不会太大

验证码邮件一般都很小，通常没问题。

如果后面你想再省空间，可以把 `raw_text` 改成只保留正文摘要，或者只提取验证码后存结构化字段。

### 3. 现在验证码只在正文里也能存吗

可以。

当前脚本会先尝试从原始 MIME 邮件里解析 `text/plain` 或 `text/html` 正文，再写入 `raw_text`。

如果解析失败，至少也会把原始 MIME 文本写进去，不会像之前那样直接是空字符串。

## 后续可扩展方向

你现在配好的这套 Cloudflare 结构，不只是“给当前项目收验证码”的配套设施，也可以作为后续扩展的基础：

- Email Routing 负责接收域名邮件
- Worker 负责处理邮件事件
- D1 负责结构化存储
- 自定义域 + `API_KEY` 负责对外提供安全查询接口

也就是说，这套结构除了服务当前项目，还可以继续扩展到其他相近场景。

### 架构图

```text
                           ┌─────────────────────────────┐
                           │      你的域名邮箱入口        │
                           │   catch-all / aliases       │
                           └──────────────┬──────────────┘
                                          │
                                          ▼
                           ┌─────────────────────────────┐
                           │ Cloudflare Email Routing    │
                           │ 收信、转发到 Worker          │
                           └──────────────┬──────────────┘
                                          │
                                          ▼
                    ┌────────────────────────────────────────────┐
                    │ Cloudflare Worker                          │
                    │ - 解析邮件                                 │
                    │ - 提取验证码 / 链接 / 关键字段             │
                    │ - 可扩展到分类、过滤、转发等处理能力       │
                    └──────────────┬─────────────────────────────┘
                                   │
                     ┌─────────────┴─────────────┐
                     ▼                           ▼
       ┌─────────────────────────┐   ┌──────────────────────────┐
       │ D1 数据库存储            │   │ 自定义域 HTTP API         │
       │ - 邮件正文               │   │ - /latest                │
       │ - 发件人/主题/时间       │   │ - /emails                │
       │ - 验证码/状态            │   │ - x-api-key 鉴权         │
       └─────────────┬───────────┘   └─────────────┬────────────┘
                     │                             │
                     └─────────────┬───────────────┘
                                   ▼
                 ┌──────────────────────────────────────────────┐
                  │ 上层可扩展场景                                │
                 │                                              │
                  │ 1. 验证码 / OTP 采集                         │
                  │ 2. 临时邮箱 / catch-all 查询                 │
                  │ 3. 邮件通知转 Webhook / Slack                │
                  │ 4. 邮件归档 / 简单查询接口                   │
                  └──────────────────────────────────────────────┘
```

### 比较贴近当前链路的扩展方向

#### 1. 验证码 / OTP 采集

把当前“收验证码邮件 -> 提取验证码 -> API 查询”的链路通用化，就可以变成一个统一的验证码采集能力。

适合：

- 自动化注册
- QA 测试环境
- 登录验证码收集
- 密码重置邮件提取

#### 2. 临时邮箱 / catch-all 查询

因为你已经有了 Email Routing 和 catch-all，这套东西可以继续扩展为：

- 任意前缀邮箱接收
- 按前缀归类
- 按邮箱隔离不同业务来源
- 临时邮箱查询接口

这类能力很适合做测试、自动化和来源追踪。

#### 3. 邮件通知转 Webhook / Slack / Discord

有些平台不会发 webhook，只会发邮件。这时可以把邮件当成事件源：

- Worker 收到邮件
- 解析主题、正文、发件人
- 转发到 Slack / Discord / 企业微信 / 自定义 Webhook

这样就可以把“邮件通知”进一步转成结构化事件。

#### 4. 邮件归档 / 简单查询接口

如果你不只收验证码，而是把它用于：

- 域名安全报告
- 系统告警邮件
- 平台通知邮件
- 第三方账单邮件

那么这套结构就可以继续扩展成一个低成本的归档和查询接口。

### 一句话理解

当前你部署出来的，不只是一个“给当前项目使用的 Worker”，也可以理解成一套后续可复用的 Cloudflare 事件底座：

```text
邮件进入口 + Worker 处理层 + D1 存储层 + 安全 API 层
```

当这四层稳定下来后，很多和“邮件接收、事件处理、状态查询、自动化流转”有关的相近需求，都可以直接复用这套基础结构。
