import {createCloudflareProvider} from "./mail/cloudflare.js";

export interface EmailCodeProvider {
  getEmailAddress(): Promise<string>;
  getEmailVerificationCode(email: string): Promise<string>;
  getRecentMails(email: string, limit: number): Promise<Array<{
    id: string;
    sender: string;
    recipient: string;
    subject: string;
    content: string;
    timestamp: number;
  }>>;
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

export async function getRecentMails(email: string, limit: number) {
  return provider.getRecentMails(email, limit);
}
