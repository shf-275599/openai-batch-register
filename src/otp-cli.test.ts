import test from "node:test";
import assert from "node:assert/strict";

import {formatRecentMailSummary, normalizeOtpLookupEmail, normalizeRecentMailLimit} from "./otp-cli.js";

test("normalizeOtpLookupEmail appends configured domain for bare local part", () => {
    assert.equal(normalizeOtpLookupEmail("abc123", "shfhub.com"), "abc123@shfhub.com");
});

test("normalizeOtpLookupEmail preserves full email input", () => {
    assert.equal(
        normalizeOtpLookupEmail("abc123@shfhub.com", "shfhub.com"),
        "abc123@shfhub.com",
    );
});

test("normalizeOtpLookupEmail rejects empty input", () => {
    assert.throws(
        () => normalizeOtpLookupEmail("   ", "shfhub.com"),
        /请提供邮箱前缀或完整邮箱/,
    );
});

test("normalizeRecentMailLimit uses default for empty input", () => {
    assert.equal(normalizeRecentMailLimit(""), 10);
});

test("normalizeRecentMailLimit rejects zero and negatives", () => {
    assert.throws(() => normalizeRecentMailLimit("0"), /最近邮件数量必须是 1 到 50 之间的整数/);
    assert.throws(() => normalizeRecentMailLimit("-3"), /最近邮件数量必须是 1 到 50 之间的整数/);
});

test("normalizeRecentMailLimit caps values above fifty", () => {
    assert.equal(normalizeRecentMailLimit("99"), 50);
});

test("formatRecentMailSummary includes otp when present", () => {
    assert.equal(
        formatRecentMailSummary({
            timestamp: 1714543200000,
            sender: "noreply@openai.com",
            subject: "Your code is 123456",
            verificationCode: "123456",
        }),
        "[2024-05-01 14:00:00] from=noreply@openai.com otp=123456 subject=Your code is 123456",
    );
});
