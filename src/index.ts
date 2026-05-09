import {appConfig} from "./config.js";
import {generateRandomDeviceProfile} from "./device-profile.js";
import {OpenAIClient} from "./openai.js";
import {formatRecentMailSummary, lookupOtpCode, lookupRecentMails} from "./otp-cli.js";

function readArgValue(flag: string): string {
    const index = process.argv.indexOf(flag);
    if (index === -1) {
        return "";
    }
    return process.argv[index + 1] ?? "";
}

function hasFlag(flag: string): boolean {
    return process.argv.includes(flag);
}

function readNumberArg(flag: string): number | null {
    const raw = readArgValue(flag).trim();
    if (!raw) {
        return null;
    }
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) && value > 0 ? value : null;
}

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

async function main() {
    let round = 0;
    let successCount = 0;
    let failCount = 0;
    const manualEmail = readArgValue("--email").trim();
    const manualOtp = hasFlag("--otp");
    const maxRounds = readNumberArg("--n");
    const otpLookupInput = readArgValue("--check-otp").trim();
    const recentMailInput = readArgValue("--recent-mails").trim();
    const recentMailLimit = readArgValue("--limit").trim();

    if (otpLookupInput) {
        const {email, code} = await lookupOtpCode(otpLookupInput);
        console.log(`email=${email}`);
        console.log(`otp=${code}`);
        return;
    }

    if (recentMailInput) {
        const result = await lookupRecentMails(recentMailInput, recentMailLimit);
        console.log(`email=${result.email}`);
        console.log(`limit=${result.limit}`);
        if (result.mails.length === 0) {
            console.log("最近邮件为空");
            return;
        }
        for (const mail of result.mails) {
            console.log(formatRecentMailSummary(mail));
        }
        return;
    }

    if (manualEmail) {
        try {
            await runOnce();
        } catch (error) {
            console.error(`[❌️注册失败]`, error);
        }
        return;
    }

    while (!maxRounds || round < maxRounds) {
        round += 1;
        console.log(
            `第 ${round} 轮开始: 成功=${successCount} 失败=${failCount} 模式=自动`,
        );
        try {
            await runOnce();
            successCount += 1;
        } catch (error) {
            failCount += 1;
            console.error(`[❌️注册失败]`, error);
        }

        if (appConfig.loopDelayMs > 0) {
            console.log(`[延迟] 轮次间等待 ${appConfig.loopDelayMs}ms`);
            await new Promise((resolve) => setTimeout(resolve, appConfig.loopDelayMs));
        }
    }

    console.log(
        `自动模式结束: 已执行=${round} 成功=${successCount} 失败=${failCount}`,
    );
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
