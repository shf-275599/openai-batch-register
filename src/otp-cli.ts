import {appConfig} from "./config.js";
import {getEmailVerificationCode, getRecentMails} from "./mailbox.js";
import {findLatestVerificationMail} from "./mail/verification-matcher.js";

export interface RecentMailSummary {
    timestamp: number;
    sender: string;
    subject: string;
    verificationCode?: string;
}

export function normalizeOtpLookupEmail(input: string, defaultDomain: string): string {
    const trimmedInput = input.trim().toLowerCase();
    if (!trimmedInput) {
        throw new Error("请提供邮箱前缀或完整邮箱");
    }

    if (trimmedInput.includes("@")) {
        return trimmedInput;
    }

    const trimmedDomain = defaultDomain.trim().toLowerCase().replace(/^@+/, "");
    if (!trimmedDomain) {
        throw new Error("cloudflareEmailDomain 未配置，无法自动补全邮箱域名");
    }

    return `${trimmedInput}@${trimmedDomain}`;
}

export async function lookupOtpCode(input: string): Promise<{email: string; code: string}> {
    const email = normalizeOtpLookupEmail(input, appConfig.cloudflareEmailDomain);
    const code = await getEmailVerificationCode(email);
    return {email, code};
}

export function normalizeRecentMailLimit(input: string): number {
    const trimmedInput = input.trim();
    if (!trimmedInput) {
        return 10;
    }

    const value = Number.parseInt(trimmedInput, 10);
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error("最近邮件数量必须是 1 到 50 之间的整数");
    }

    return Math.min(value, 50);
}

export function formatRecentMailSummary(mail: RecentMailSummary): string {
    const date = new Date(mail.timestamp);
    const timestamp = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-") + ` ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;

    const otpPart = mail.verificationCode ? ` otp=${mail.verificationCode}` : " otp=-";
    return `[${timestamp}] from=${mail.sender || "-"}${otpPart} subject=${mail.subject || "-"}`;
}

export async function lookupRecentMails(input: string, rawLimit: string): Promise<{
    email: string;
    limit: number;
    mails: RecentMailSummary[];
}> {
    const email = normalizeOtpLookupEmail(input, appConfig.cloudflareEmailDomain);
    const limit = normalizeRecentMailLimit(rawLimit);
    const mails = await getRecentMails(email, limit);

    return {
        email,
        limit,
        mails: mails.map((mail) => ({
            timestamp: mail.timestamp,
            sender: mail.sender,
            subject: mail.subject,
            verificationCode: findLatestVerificationMail([mail], {
                targetEmail: email,
                rememberLastCode: false,
            })?.verificationCode,
        })),
    };
}
