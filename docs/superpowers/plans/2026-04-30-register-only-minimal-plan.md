# Register-Only Minimal Version Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `codex-register` into a minimal register-only tool that stops after account registration succeeds and removes phone verification, authorization, auth-file, quota-check, CLIProxyAPI, and batch-registration functionality.

**Architecture:** Keep the current registration flow and mailbox provider layer, but trim the CLI and OpenAI client to a single responsibility: registering accounts. Remove unused files and configuration in discrete slices so the repository remains buildable after each task.

**Tech Stack:** Node.js, TypeScript, tsx, tsup, undici, fetch-cookie, tough-cookie, playwright-core

---

### Task 1: Remove obsolete CLI scripts and docs from the package surface

**Files:**
- Modify: `package.json`
- Modify: `tsup.config.ts`
- Delete: `src/check-auth-quota.ts`
- Delete: `src/batch-register.ts`
- Delete: `ADD_PHONE_HERO_SMS.md`

- [ ] **Step 1: Write the failing expectation as a repository-surface checklist**

Expected state after this task:

```text
1. package.json only exposes dev/build/start scripts
2. tsup.config.ts only builds src/index.ts
3. check-auth-quota and batch-register entry files are gone
4. ADD_PHONE_HERO_SMS.md is gone
```

- [ ] **Step 2: Replace the scripts block in `package.json`**

Change:

```json
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsup --config tsup.config.ts",
    "start": "node bundle/index.cjs",
    "check": "node bundle/check-auth-quota.cjs",
    "check:cpa": "node bundle/check-auth-quota.cjs --cpa",
    "batch": "node bundle/batch-register.cjs"
  },
```

to:

```json
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsup --config tsup.config.ts",
    "start": "node bundle/index.cjs"
  },
```

- [ ] **Step 3: Replace the entry map in `tsup.config.ts`**

Change:

```ts
    entry: {
        index: "src/index.ts",
        "check-auth-quota": "src/check-auth-quota.ts",
        "batch-register": "src/batch-register.ts",
    },
```

to:

```ts
    entry: {
        index: "src/index.ts",
    },
```

- [ ] **Step 4: Delete obsolete files**

Delete these files entirely:

```text
src/check-auth-quota.ts
src/batch-register.ts
ADD_PHONE_HERO_SMS.md
```

- [ ] **Step 5: Run build to verify the reduced entry surface**

Run:

```bash
npm run build
```

Expected:

```text
Build succeeds and only bundle/index.cjs is produced
```

- [ ] **Step 6: Commit**

```bash
git add package.json tsup.config.ts
git rm src/check-auth-quota.ts src/batch-register.ts ADD_PHONE_HERO_SMS.md
git commit -m "chore: remove non-registration entrypoints"
```

### Task 2: Remove SMS / HeroSMS support from configuration and entrypoint

**Files:**
- Modify: `src/config.ts`
- Modify: `config.example.json`
- Modify: `src/index.ts`
- Delete: `src/sms/activation-broker.ts`
- Delete: `src/sms/heroSMS.ts`
- Delete: `src/sms/index.ts`
- Delete: `src/sms/provider.ts`

- [ ] **Step 1: Remove SMS imports and broker creation from `src/index.ts`**

Delete:

```ts
import {createSMSBroker} from "./sms/index.js";
```

and remove the whole broker block:

```ts
const smsBroker = appConfig.heroSMSApiKey ? createSMSBroker({
    apiKey: appConfig.heroSMSApiKey,
    pollAttempts: appConfig.heroSMSPollAttempts,
    pollIntervalMs: appConfig.heroSMSPollIntervalMs,
    maxPrice: appConfig.heroSMSMaxPrice,
    country: appConfig.heroSMSCountry
}) : undefined
```

- [ ] **Step 2: Remove `smsBroker` from every `OpenAIClient` construction in `src/index.ts`**

Each construction should become this shape:

```ts
const client = new OpenAIClient({
    email: manualEmail,
    password: appConfig.defaultPassword,
    deviceProfile,
    manualMode: manualOtp,
});
```

and similarly for the register client / direct signup client / login client that still remain at this point in the file.

- [ ] **Step 3: Remove SMS config fields from `src/config.ts` type definitions**

Delete these properties from both `AppConfigFile` and `AppConfig`:

```ts
heroSMSApiKey
heroSMSCountry
heroSMSMaxPrice
heroSMSPollAttempts
heroSMSPollIntervalMs
```

Delete these defaults from `DEFAULT_CONFIG`:

```ts
heroSMSApiKey: undefined,
heroSMSCountry: 52,
heroSMSMaxPrice: 0.05,
heroSMSPollAttempts: 10,
heroSMSPollIntervalMs: 3000,
```

Delete the whole normalization block that maps those properties in `loadConfig()`.

- [ ] **Step 4: Remove SMS config fields from `config.example.json`**

Delete these lines:

```json
  "heroSMSApiKey": "",
  "heroSMSCountry": 52,
  "heroSMSMaxPrice": 0.05,
  "heroSMSPollAttempts": 10,
  "heroSMSPollIntervalMs": 3000,
```

- [ ] **Step 5: Delete the SMS implementation directory**

Delete these files:

```text
src/sms/activation-broker.ts
src/sms/heroSMS.ts
src/sms/index.ts
src/sms/provider.ts
```

- [ ] **Step 6: Run build to verify no SMS references remain**

Run:

```bash
npm run build
```

Expected:

```text
Build succeeds without unresolved ./sms imports or missing heroSMS config fields
```

- [ ] **Step 7: Commit**

```bash
git add src/config.ts config.example.json src/index.ts
git rm src/sms/activation-broker.ts src/sms/heroSMS.ts src/sms/index.ts src/sms/provider.ts
git commit -m "refactor: remove sms verification support"
```

### Task 3: Strip authorization and auth-file behavior from the CLI entrypoint

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Reduce `runOnce()` to registration-only behavior**

Replace the top of `runOnce()`:

```ts
    const email = readArgValue("--email").trim();
    const manualOtp = hasFlag("--otp");
    const directSignupAuth = hasFlag("--sign");
    const registerOnly = hasFlag("--register-only");
```

with:

```ts
    const email = readArgValue("--email").trim();
    const manualOtp = hasFlag("--otp");
```

Delete the whole `if (directSignupAuth) { ... }` branch.

Delete the login client branch entirely, so `runOnce()` becomes:

```ts
async function runOnce(): Promise<void> {
    const email = readArgValue("--email").trim();
    const manualOtp = hasFlag("--otp");
    const deviceProfile = generateRandomDeviceProfile();

    const registerClient = new OpenAIClient({
        email: email || undefined,
        password: appConfig.defaultPassword,
        deviceProfile,
        manualMode: manualOtp,
    });
    await registerClient.authRegisterHTTP();
    console.log(
        `[✅️注册成功] 邮箱：${registerClient.email} 密码：${appConfig.defaultPassword}`,
    );
}
```

- [ ] **Step 2: Remove auth-only handling from `main()`**

Delete:

```ts
    const authOnly = hasFlag("--auth");
```

and remove the whole branch:

```ts
    if (authOnly) {
        ...
        return;
    }
```

- [ ] **Step 3: Make error labels registration-oriented**

Update both catches in `src/index.ts` to:

```ts
console.error(`[❌️注册失败]`, error);
```

for:
- the `manualEmail` one-shot path
- the auto loop path

- [ ] **Step 4: Run a focused source review**

Confirm `src/index.ts` no longer contains these strings:

```text
--auth
--sign
--register-only
authLoginHTTP
授权文件
```

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected:

```text
Build succeeds and src/index.ts only drives registration
```

- [ ] **Step 6: Commit**

```bash
git add src/index.ts
git commit -m "refactor: make cli registration-only"
```

### Task 4: Reduce `OpenAIClient` to the registration state machine only

**Files:**
- Modify: `src/openai.ts`
- Modify: `src/constants.ts`

- [ ] **Step 1: Remove imports that exist only for authorization/auth persistence**

Delete from `src/openai.ts` any imports that are only used by removed auth behavior, including:

```ts
import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {shouldAutoUploadAuthToCLIProxyAPI, uploadAuthFileToCLIProxyAPI} from "./cliproxyapi.js";
import {
    AUTH_AUTHORIZE_CONTINUE_URL,
    AUTH_BASE_URL,
    AUTH_EMAIL_OTP_SEND_URL,
    AUTH_EMAIL_OTP_VALIDATE_URL,
    AUTH_OAUTH_TOKEN_URLS,
    AUTH_PASSWORD_VERIFY_URL,
    AUTH_REGISTER_URL,
    AUTH_WORKSPACE_SELECT_URL,
    CHATGPT_BASE_URL,
    DEFAULT_CLIENT_ID,
    DEFAULT_REDIRECT_URI,
    DEFAULT_USER_AGENT,
} from "./constants.js";
import {ISMSActivationBroker} from "./sms/activation-broker.js";
```

Then re-add only the constants still needed by registration.

- [ ] **Step 2: Remove unused auth-related types and option fields**

Delete these interfaces/types from `src/openai.ts`:

```ts
AuthSessionWorkspace
ClientAuthSessionPayload
OAuthTokenResponse
JwtPayload
AuthLoginResult
SavedAuthRecord
```

Delete these option fields from `OpenAIClientOptions` and the class:

```ts
signupScreenHint?: string;
smsBroker?: ISMSActivationBroker;
readonly signupScreenHint: string;
readonly smsBroker?: ISMSActivationBroker;
```

Delete the corresponding constructor assignments.

- [ ] **Step 3: Delete auth-only methods and phone methods**

Delete these methods entirely from `src/openai.ts`:

```ts
authLoginHTTP
authRegisterAndAuthorizeHTTP
prepareManualLogin
authorizeContinue
passwordVerify
validatePhone
sendPhoneOtp
selectWorkspace
followOAuthRedirects
finalizeAuthorizationFromContinueURL
exchangeCodeForToken
resolveWorkspaceID
decodeSignedJson
normalizeAuthRecord
decodeJwtPayload
extractAuthResult
saveAuthRecord
```

Also delete the add-phone branch inside `authRegisterHTTP()`:

```ts
        if (continueURL === `${AUTH_BASE_URL}/add-phone`) {
            ...
        }
```

- [ ] **Step 4: Keep only the registration helpers and make them compile cleanly**

After cleanup, `src/openai.ts` should keep the registration path built around:

```text
authRegisterHTTP
authorizeContinueForSignup
registerPassword
sendEmailOtp
emailOtpValidate
resolveEmailOtpCode
generateRegisterEmail
promptEmailOtp
completeAboutYou
finishChatGPTRegistration
bootChatGPTSession
openSignupPage
postJSON
readCookie
createBrowserHeaders
formatErrorResponse
fetchWithRetry and transport helpers
```

If `src/constants.ts` still contains auth-only constants after this cleanup, remove them so it exports only values still referenced by the registration flow.

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected:

```text
Build succeeds with no references to cliproxy, OAuth token exchange, auth file persistence, or sms activation types
```

- [ ] **Step 6: Commit**

```bash
git add src/openai.ts src/constants.ts
git commit -m "refactor: trim openai client to registration flow"
```

### Task 5: Remove CLIProxyAPI support from configuration and source tree

**Files:**
- Modify: `src/config.ts`
- Modify: `config.example.json`
- Delete: `src/cliproxyapi.ts`

- [ ] **Step 1: Remove CLIProxyAPI fields from `src/config.ts`**

Delete these properties from `AppConfigFile`, `AppConfig`, `DEFAULT_CONFIG`, and `loadConfig()`:

```ts
cliproxyApiAutoUploadAuth
cliproxyApiBaseUrl
cliproxyApiManagementKey
```

- [ ] **Step 2: Remove CLIProxyAPI fields from `config.example.json`**

Delete:

```json
  "cliproxyApiAutoUploadAuth": false,
  "cliproxyApiBaseUrl": "http://localhost:8317",
  "cliproxyApiManagementKey": ""
```

- [ ] **Step 3: Delete the implementation file**

Delete:

```text
src/cliproxyapi.ts
```

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected:

```text
Build succeeds without cliproxy references
```

- [ ] **Step 5: Commit**

```bash
git add src/config.ts config.example.json
git rm src/cliproxyapi.ts
git commit -m "chore: remove cliproxy integration"
```

### Task 6: Rewrite README for the register-only product shape

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the project summary**

Change the opening description from auth/quota-oriented wording to registration-only wording:

```md
用于批量注册 OpenAI 账号，注册成功后立即结束。
```

- [ ] **Step 2: Rewrite the command section**

The main command section should keep only:

```md
- `--n <次数>`
- `--email <邮箱>`
- `--otp`
- `--st`
```

Remove all mentions of:

```text
--auth
--sign
--register-only
check
check:cpa
batch
auth 文件
授权额度
CLIProxyAPI
HeroSMS
```

- [ ] **Step 3: Rewrite examples to registration-only examples**

Keep examples like:

```md
#### 自动模式只跑 1 次
```bash
npm run dev -- --n 1
```

#### 指定邮箱注册
```bash
npm run dev -- --email your_mail@example.com
```

#### 指定邮箱，手动输入验证码
```bash
npm run dev -- --email your_mail@example.com --otp
```
```

Remove examples for auth, sign, check, and batch.

- [ ] **Step 4: Rewrite config documentation**

The config section must no longer mention removed fields. Keep only:

```text
provider
defaultProxyUrl
defaultPassword
loopDelayMs
gmailAccessToken
gmailEmailAddress
gptMailApiKey
gptMailDomain
2925EmailAddress
2925Password
cloudflareEmailDomain
cloudflareApiBaseUrl
cloudflareApiKey
```

- [ ] **Step 5: Run a content sanity check**

Verify `README.md` no longer contains these strings:

```text
授权
auth/
额度
check:cpa
cliproxy
HeroSMS
batch-register
```

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: rewrite readme for register-only usage"
```

### Task 7: Final verification of the minimized repository

**Files:**
- Modify: none

- [ ] **Step 1: Install dependencies fresh if needed**

Run:

```bash
npm install
```

Expected:

```text
Dependencies install successfully with no missing package metadata errors
```

- [ ] **Step 2: Run the final build**

Run:

```bash
npm run build
```

Expected:

```text
Build succeeds and produces only bundle/index.cjs
```

- [ ] **Step 3: Verify repository surface matches the spec**

Confirm all of the following are true:

```text
1. package.json only has dev/build/start scripts
2. src/sms directory is gone
3. src/check-auth-quota.ts is gone
4. src/batch-register.ts is gone
5. src/cliproxyapi.ts is gone
6. src/index.ts no longer references auth-only flags or login authorization
7. README only describes registration behavior
```

- [ ] **Step 4: Commit if any final touch-up was required**

```bash
git add package.json tsup.config.ts src/index.ts src/openai.ts src/constants.ts src/config.ts config.example.json README.md
git commit -m "chore: finalize register-only cleanup"
```

If no touch-up was needed after verification, skip this commit.
