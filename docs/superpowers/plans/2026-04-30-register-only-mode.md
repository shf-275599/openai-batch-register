# Register-Only Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `--register-only` CLI mode so the main program stops immediately after successful account registration without running login authorization, token exchange, auth file generation, or authorization-time phone verification.

**Architecture:** Keep the change narrowly scoped to the CLI entrypoint in `src/index.ts`. Reuse the existing `OpenAIClient.authRegisterHTTP()` registration flow unchanged, and branch in `runOnce()` so register-only mode exits after registration success while preserving existing `--auth` and `--sign` behavior.

**Tech Stack:** Node.js, TypeScript, tsx, tsup

---

### Task 1: Add register-only flag handling in the CLI entrypoint

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Write the failing test expectation as an executable manual check**

Expected behavior after the change:

```text
1. `npm run dev -- --register-only --n 1`
   - runs registration only
   - does not call authLoginHTTP
   - prints a registration success message

2. `npm run dev -- --email someone@example.com --register-only`
   - registers that email only
   - exits after registration success

3. Existing modes still work:
   - `--auth` still logs in and saves auth
   - `--sign` still registers and authorizes
   - no new behavior unless `--register-only` is present
```

- [ ] **Step 2: Add a local flag variable in `runOnce()`**

Insert a new boolean near the existing argument parsing:

```ts
async function runOnce(): Promise<void> {
    const email = readArgValue("--email").trim();
    const manualOtp = hasFlag("--otp");
    const directSignupAuth = hasFlag("--sign");
    const registerOnly = hasFlag("--register-only");
    const deviceProfile = generateRandomDeviceProfile();
```

- [ ] **Step 3: Short-circuit after successful registration**

Replace the registration/login sequence in `runOnce()` with this shape:

```ts
    const registerClient = new OpenAIClient({
        email: email || undefined,
        password: appConfig.defaultPassword,
        deviceProfile,
        manualMode: manualOtp,
        smsBroker,
    });
    await registerClient.authRegisterHTTP();

    if (registerOnly) {
        console.log(
            `[✅️注册成功] 邮箱：${registerClient.email} 密码：${appConfig.defaultPassword}`,
        );
        return;
    }

    const loginClient = new OpenAIClient({
        email: registerClient.email,
        password: appConfig.defaultPassword,
        deviceProfile,
        manualMode: manualOtp,
        smsBroker,
    });
    const result = await loginClient.authLoginHTTP();
    console.log(
        `[✅️授权成功] 邮箱：${loginClient.email} 密码：${appConfig.defaultPassword} 授权文件：${result.authFile ?? ""}`,
    );
```

- [ ] **Step 4: Keep `--sign` and `--auth` precedence unchanged**

Do not move the existing branches above or below different guards. The desired precedence is:

```text
1. --auth     -> auth-only login flow
2. --sign     -> direct register-and-authorize flow
3. --register-only -> register only, then stop
4. default    -> register, then login authorize
```

Concretely, keep:

```ts
if (directSignupAuth) {
    // existing authRegisterAndAuthorizeHTTP path
}
```

before the normal registration path in `runOnce()`, and keep:

```ts
if (authOnly) {
    // existing authLoginHTTP path
}
```

at the top of `main()`.

- [ ] **Step 5: Adjust failure labels in manual-email and auto loops**

Make the error label neutral so register-only failures are not mislabeled as authorization failures. Update these two sites in `src/index.ts`:

```ts
console.error(`[❌️执行失败]`, error);
```

for:
- the `manualEmail` one-shot catch block
- the auto loop catch block

Leave the `--auth` branch as `[❌️授权失败]` because that path is still auth-specific.

- [ ] **Step 6: Run the entrypoint type/build verification**

Run:

```bash
npm run build
```

Expected:

```text
tsup builds bundle/index.cjs, bundle/check-auth-quota.cjs, and bundle/batch-register.cjs successfully with no TypeScript errors
```

- [ ] **Step 7: Commit**

```bash
git add src/index.ts docs/superpowers/plans/2026-04-30-register-only-mode.md
git commit -m "feat: add register-only mode"
```

### Task 2: Document the new CLI behavior in the README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add the new flag to the main parameter list**

In the `## 主程序：npm run dev / npm run start` section, add:

```md
- `--register-only`
    - 只注册账号，注册成功后立即结束，不做登录授权，不生成 auth 文件
```

- [ ] **Step 2: Add a usage example**

In the examples section, add:

```md
#### 只注册账号，不做授权

```bash
npm run dev -- --register-only
```
```

and, if keeping the specified-email examples grouped together, also add:

```md
#### 指定邮箱，只注册不授权

```bash
npm run dev -- --email your_mail@example.com --register-only
```
```

- [ ] **Step 3: Clarify the output/result difference**

Add one short note near the new examples:

```md
说明：`--register-only` 模式只会输出注册成功信息，不会生成 `auth/*.json` 授权文件。
```

- [ ] **Step 4: Run a quick README consistency check**

Verify the README no longer implies that every non-`--auth` flow always produces an auth file.

Checklist:

```text
1. Parameter list mentions --register-only
2. Example commands include --register-only
3. Wording clearly says no auth file is generated
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: describe register-only mode"
```

### Task 3: Verify behavior end-to-end at the command interface

**Files:**
- Modify: none
- Test: manual CLI verification against `src/index.ts`

- [ ] **Step 1: Verify build still succeeds**

Run:

```bash
npm run build
```

Expected:

```text
Build completes successfully
```

- [ ] **Step 2: Verify flag parsing does not break auth-only mode**

Run a dry behavioral check of the code paths by reading `src/index.ts` after edits and confirm:

```text
--auth branch still returns before runOnce()
```

- [ ] **Step 3: Verify register-only path exits before auth login path**

Read the final `runOnce()` flow and confirm:

```text
authRegisterHTTP() completes
-> registerOnly check runs
-> function returns
-> authLoginHTTP() is not reached
```

- [ ] **Step 4: Verify default behavior still authorizes**

Read the same function and confirm:

```text
when registerOnly is false, execution still reaches authLoginHTTP()
```

- [ ] **Step 5: Commit if verification required code/doc touch-ups**

```bash
git add src/index.ts README.md
git commit -m "chore: finalize register-only flow"
```

If no verification fixes were needed, skip this commit.
