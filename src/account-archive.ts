import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";

export interface ArchiveAccountRecordInput {
    rootDir?: string;
    email: string;
    password: string;
    createdAt: string;
}

function pad2(value: number): string {
    return String(value).padStart(2, "0");
}

export function formatLocalTimestamp(date: Date): string {
    return [
        date.getFullYear(),
        pad2(date.getMonth() + 1),
        pad2(date.getDate()),
    ].join("-") + `_${pad2(date.getHours())}-${pad2(date.getMinutes())}-${pad2(date.getSeconds())}`;
}

function sanitizeEmailForFileName(email: string): string {
    return email.trim().toLowerCase().replace(/@/g, "_").replace(/[^a-z0-9._+-]+/g, "-");
}

function sanitizeTimestampForFileName(createdAt: string): string {
    return createdAt.replace(/:/g, "-");
}

function buildAccountFileContent(input: ArchiveAccountRecordInput): string {
    return [
        `email=${input.email}`,
        `password=${input.password}`,
        `created_at=${input.createdAt}`,
        "",
    ].join("\n");
}

export async function archiveAccountRecord(input: ArchiveAccountRecordInput): Promise<string> {
    const rootDir = input.rootDir ?? process.cwd();
    const accountsDir = path.join(rootDir, "accounts");
    await mkdir(accountsDir, {recursive: true});

    const fileName = `${sanitizeEmailForFileName(input.email)}__${sanitizeTimestampForFileName(input.createdAt)}.txt`;
    const filePath = path.join(accountsDir, fileName);

    await writeFile(filePath, buildAccountFileContent(input), "utf8");
    return filePath;
}
