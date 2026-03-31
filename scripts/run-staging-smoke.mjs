import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const shareUrl = process.argv[2];

const fail = (message) => {
  console.error(`[smoke:staging] ${message}`);
  process.exit(1);
};

const run = (command, args, options = {}) => {
  const result = execFileSync(command, args, {
    encoding: "utf8",
    stdio: options.capture === false ? "inherit" : "pipe",
  });

  return typeof result === "string" ? result.trim() : "";
};

if (!shareUrl) {
  fail('A Vercel share URL is required. Usage: npm run smoke:staging -- "<vercel-share-url>"');
}

const worktreeStatus = run("git", ["status", "--porcelain"]);
if (worktreeStatus) {
  fail("Working tree is not clean. Commit or stash changes before running staged smoke.");
}

run("git", ["fetch", "origin", "main", "staging"], { capture: false });

const head = run("git", ["rev-parse", "HEAD"]);
const originMain = run("git", ["rev-parse", "origin/main"]);
const originStaging = run("git", ["rev-parse", "origin/staging"]);

if (head !== originMain) {
  fail(
    `HEAD ${head} is not the commit on origin/main (${originMain}). Push main first so smoke verifies the published commit.`,
  );
}

if (originStaging !== originMain) {
  fail(
    `origin/staging (${originStaging}) is not aligned with origin/main (${originMain}). Run npm run promote:staging before smoke testing.`,
  );
}

console.log(`[smoke:staging] Verifying staged preview for commit ${originStaging}.`);

const previewSmokePath = fileURLToPath(new URL("./preview-smoke.mjs", import.meta.url));
const child = spawnSync(process.execPath, [previewSmokePath, shareUrl], {
  stdio: "inherit",
});

if (child.status !== 0) {
  process.exit(child.status ?? 1);
}
