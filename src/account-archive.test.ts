import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, readFile, readdir} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {archiveAccountRecord, formatLocalTimestamp} from "./account-archive.js";

test("formatLocalTimestamp converts UTC date into local wall-clock timestamp", () => {
    const date = new Date("2026-05-01T06:12:01.410Z");

    assert.equal(formatLocalTimestamp(date), "2026-05-01_14-12-01");
});

test("archiveAccountRecord writes one txt file under accounts with sanitized email and timestamp", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "codex-register-archive-"));
    const createdAt = "2026-05-01_14-23-45";

    const filePath = await archiveAccountRecord({
        rootDir: tempRoot,
        email: "a+b@example.com",
        password: "secret123",
        createdAt,
    });

    assert.match(path.basename(filePath), /^a\+b_example\.com__2026-05-01_14-23-45\.txt$/);

    const accountDirEntries = await readdir(path.join(tempRoot, "accounts"));
    assert.equal(accountDirEntries.length, 1);
    assert.equal(accountDirEntries[0], path.basename(filePath));

    const content = await readFile(filePath, "utf8");
    assert.equal(
        content,
        [
            "email=a+b@example.com",
            "password=secret123",
            `created_at=${createdAt}`,
            "",
        ].join("\n"),
    );
});
