import { execFileSync } from "node:child_process";

const run = (command, args, options = {}) => {
  const result = execFileSync(command, args, {
    encoding: "utf8",
    stdio: options.capture === false ? "inherit" : "pipe",
  });

  return typeof result === "string" ? result.trim() : "";
};

const fail = (message) => {
  console.error(`[promote:staging] ${message}`);
  process.exit(1);
};

const currentBranch = run("git", ["branch", "--show-current"]);
if (currentBranch !== "main") {
  fail(`Run this script from main. Current branch: ${currentBranch || "(detached)"}`);
}

const worktreeStatus = run("git", ["status", "--porcelain"]);
if (worktreeStatus) {
  fail("Working tree is not clean. Commit or stash changes before promoting staging.");
}

const head = run("git", ["rev-parse", "HEAD"]);

console.log(`[promote:staging] Preparing to publish main commit ${head}.`);
run("git", ["fetch", "origin", "main", "staging"], { capture: false });
run("git", ["push", "origin", "main"], { capture: false });

try {
  run("git", ["switch", "staging"], { capture: false });
  run("git", ["merge", "--ff-only", "main"], { capture: false });
  run("git", ["push", "origin", "staging"], { capture: false });
} finally {
  run("git", ["switch", "main"], { capture: false });
}

const stagingHead = run("git", ["rev-parse", "staging"]);
if (stagingHead !== head) {
  fail(`Local staging ended at ${stagingHead}, expected ${head}.`);
}

console.log(`[promote:staging] staging is now fast-forwarded to ${head}.`);
console.log('[promote:staging] Next: npm run smoke:staging -- "<vercel-share-url>"');
