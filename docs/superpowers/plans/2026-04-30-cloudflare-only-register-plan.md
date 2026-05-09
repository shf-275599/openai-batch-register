# Cloudflare-Only Register Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the minimized register-only repository into a Cloudflare-only register tool by deleting all non-Cloudflare mailbox providers and simplifying config, mailbox wiring, and docs around a single supported path.

**Architecture:** Keep the current registration flow intact while collapsing the mailbox layer to a single Cloudflare adapter. Reduce user-facing complexity by removing provider selection and rewriting configuration/docs to describe only the Cloudflare routing + Worker setup.

**Tech Stack:** Node.js, TypeScript, tsx, tsup, undici, fetch-cookie, tough-cookie, playwright-core

---

### Task 1: Remove non-Cloudflare provider source files and provider docs

**Files:**
- Delete: `src/mail/proxiedmail.ts`
- Delete: `src/mail/hotmail.ts`
- Delete: `src/mail/2925.ts`
- Delete: `src/mail/gmail.ts`
- Delete: `src/mail/gptmail.ts`
- Delete: `GMAIL_OAUTH_PLAYGROUND.md`

- [ ] **Step 1: Record the expected repository surface after deletion**

Expected state:

```text
1. src/mail/ only keeps cloudflare.ts, generate-email-name.ts, verification-matcher.ts
2. GMAIL_OAUTH_PLAYGROUND.md is removed
3. Build may fail temporarily until mailbox/config are updated in later tasks
```

- [ ] **Step 2: Delete the non-Cloudflare provider implementations**

Delete these files:

```text
src/mail/proxiedmail.ts
src/mail/hotmail.ts
src/mail/2925.ts
src/mail/gmail.ts
src/mail/gptmail.ts
```

- [ ] **Step 3: Delete the Gmail-specific doc**

Delete:

```text
GMAIL_OAUTH_PLAYGROUND.md
```

- [ ] **Step 4: Verify the remaining mail directory shape**

Confirm the remaining files under `src/mail/` are exactly:

```text
cloudflare.ts
generate-email-name.ts
verification-matcher.ts
```

- [ ] **Step 5: Commit**

```bash
git rm src/mail/proxiedmail.ts src/mail/hotmail.ts src/mail/2925.ts src/mail/gmail.ts src/mail/gptmail.ts GMAIL_OAUTH_PLAYGROUND.md
git commit -m "chore: remove non-cloudflare mail providers"
```

### Task 2: Collapse mailbox wiring to a single Cloudflare provider

**Files:**
- Modify: `src/mailbox.ts`

- [ ] **Step 1: Replace the multi-provider imports**

Change the top of `src/mailbox.ts` from multiple provider imports to just:

```ts
import {createCloudflareProvider} from "./mail/cloudflare.js";
```

- [ ] **Step 2: Remove provider name usage and switch logic**

Delete:

```ts
import {appConfig, type MailProviderName} from "./config.js";
```

and remove:

```ts
export const MAILBOX_CONFIG: {
  provider: MailProviderName;
} = {
  provider: appConfig.provider,
};

function createProvider(): EmailCodeProvider {
  switch (...) {
    ...
  }
}
```

- [ ] **Step 3: Replace with a Cloudflare-only mailbox module**

Make the full file shape:

```ts
import {createCloudflareProvider} from "./mail/cloudflare.js";

export interface EmailCodeProvider {
  getEmailAddress(): Promise<string>;
  getEmailVerificationCode(email: string): Promise<string>;
}

export const MAILBOX_CONFIG = {
  provider: "cloudflare",
} as const;

const provider = createCloudflareProvider();

export async function getEmailAddress(): Promise<string> {
  return provider.getEmailAddress();
}

export async function getEmailVerificationCode(email: string): Promise<string> {
  return provider.getEmailVerificationCode(email);
}
```

- [ ] **Step 4: Run build to verify mailbox wiring compiles**

Run:

```bash
npm run build
```

Expected:

```text
Build succeeds with no missing imports from deleted mail provider files
```

- [ ] **Step 5: Commit**

```bash
git add src/mailbox.ts
git commit -m "refactor: collapse mailbox layer to cloudflare"
```

### Task 3: Simplify config to Cloudflare-only fields

**Files:**
- Modify: `src/config.ts`
- Modify: `config.example.json`

- [ ] **Step 1: Remove provider selection from `src/config.ts`**

Delete:

```ts
export type MailProviderName = ...
```

and change the config interfaces so they no longer include `provider`, Gmail, GPTMail, Hotmail, or 2925-specific fields.

`AppConfigFile` should keep only:

```ts
defaultPassword?: unknown;
loopDelayMs?: unknown;
cloudflareEmailDomain?: unknown;
cloudflareApiBaseUrl?: unknown;
cloudflareApiKey?: unknown;
defaultProxyUrl?: unknown;
```

`AppConfig` should keep only:

```ts
defaultPassword: string;
loopDelayMs: number;
cloudflareEmailDomain: string;
cloudflareApiBaseUrl: string;
cloudflareApiKey: string;
defaultProxyUrl: string;
```

- [ ] **Step 2: Rewrite `DEFAULT_CONFIG` and `loadConfig()` to the reduced shape**

`DEFAULT_CONFIG` should become:

```ts
const DEFAULT_CONFIG: AppConfig = {
    defaultPassword: "kuaileshifu88",
    loopDelayMs: 120000,
    cloudflareEmailDomain: "",
    cloudflareApiBaseUrl: "",
    cloudflareApiKey: "",
    defaultProxyUrl: "http://127.0.0.1:10808",
};
```

and `loadConfig()` should return only those six fields.

- [ ] **Step 3: Rewrite `config.example.json` as a Cloudflare-only example**

Replace the whole file contents with:

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

- [ ] **Step 4: Run build to verify config simplification**

Run:

```bash
npm run build
```

Expected:

```text
Build succeeds with no references to removed provider-specific config fields
```

- [ ] **Step 5: Commit**

```bash
git add src/config.ts config.example.json
git commit -m "refactor: make config cloudflare-only"
```

### Task 4: Make the registration flow Cloudflare-specific but structurally stable

**Files:**
- Modify: `src/openai.ts`

- [ ] **Step 1: Remove residual multi-provider wording from the registration client**

Search `src/openai.ts` for wording that suggests provider variability and normalize it to Cloudflare-only assumptions where helpful.

Do not change behavior; only remove stale generalization if present in messages or comments.

- [ ] **Step 2: Keep mailbox usage through `mailbox.ts` unchanged**

Do not inline Cloudflare logic into `openai.ts`. Keep these calls as-is:

```ts
return getEmailVerificationCode(this.email);
return getEmailAddress();
```

This preserves one boundary: registration flow vs. mailbox implementation.

- [ ] **Step 3: Run build to verify no config/provider assumptions broke the client**

Run:

```bash
npm run build
```

Expected:

```text
Build succeeds and openai.ts continues to compile against mailbox.ts and config.ts
```

- [ ] **Step 4: Commit only if `src/openai.ts` changed**

```bash
git add src/openai.ts
git commit -m "refactor: align registration client with cloudflare-only flow"
```

If no edit was needed, skip this commit.

### Task 5: Rewrite README for a single Cloudflare-only product path

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Rewrite the summary and quick start to state the single supported mode**

The README opening should make this explicit:

```md
用于通过 Cloudflare 邮箱路由批量注册 OpenAI 账号，注册成功后立即结束。
```

Quick start config example should only show Cloudflare fields.

- [ ] **Step 2: Remove the multi-provider section and replace it with a Cloudflare-only section**

Delete the provider list and all subsections for:

```text
proxiedmail
gmail
hotmail
gptmail
2925
```

Replace with one concise section:

```md
## Cloudflare 配置

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
```

- [ ] **Step 3: Keep and tighten the Cloudflare Worker guidance**

Retain the reference to:

```md
[MAIL_WORKER_DEPLOY.md](./MAIL_WORKER_DEPLOY.md)
```

and make it the only mailbox setup path described in README.

- [ ] **Step 4: Rewrite config-field documentation to the reduced set**

The config explanation should mention only:

```text
defaultProxyUrl
defaultPassword
loopDelayMs
cloudflareEmailDomain
cloudflareApiBaseUrl
cloudflareApiKey
```

- [ ] **Step 5: Verify README no longer mentions removed providers**

Confirm `README.md` has no matches for:

```text
proxiedmail
gmail
hotmail
gptmail
2925
provider
```

except where `provider` may still appear inside historical filenames or no longer at all; prefer removing it entirely from user-facing docs.

- [ ] **Step 6: Run build after doc updates**

Run:

```bash
npm run build
```

Expected:

```text
Build still succeeds; README changes do not affect code
```

- [ ] **Step 7: Commit**

```bash
git add README.md config.example.json
git commit -m "docs: rewrite project for cloudflare-only usage"
```

### Task 6: Final verification of the Cloudflare-only repository shape

**Files:**
- Modify: none

- [ ] **Step 1: Install dependencies and build fresh**

Run:

```bash
npm install && npm run build
```

Expected:

```text
Install succeeds and build produces bundle/index.cjs successfully
```

- [ ] **Step 2: Verify removed files are gone**

Confirm all of these do not exist:

```text
src/mail/proxiedmail.ts
src/mail/hotmail.ts
src/mail/2925.ts
src/mail/gmail.ts
src/mail/gptmail.ts
GMAIL_OAUTH_PLAYGROUND.md
```

- [ ] **Step 3: Verify remaining mail layer shape**

Confirm `src/mail/` contains only:

```text
cloudflare.ts
generate-email-name.ts
verification-matcher.ts
```

- [ ] **Step 4: Verify code and docs are Cloudflare-only**

Confirm repository user-facing/config/runtime files have no matches for removed providers:

```text
proxiedmail
gmail
hotmail
gptmail
2925
```

Scope this check to:

```text
src/*.ts
src/**/*.ts
README.md
config.example.json
package.json
```

- [ ] **Step 5: Commit only if final touch-ups were needed**

```bash
git add src/mailbox.ts src/config.ts src/openai.ts README.md config.example.json
git commit -m "chore: finalize cloudflare-only cleanup"
```

If no touch-up was needed, skip this commit.
