import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const gitDir = path.join(repoRoot, ".git");
const hooksDir = path.join(repoRoot, ".githooks");

if (!fs.existsSync(gitDir)) {
  console.log("Skipping git hook install because this directory is not a git checkout.");
  process.exit(0);
}

if (!fs.existsSync(hooksDir)) {
  console.log("Skipping git hook install because .githooks does not exist yet.");
  process.exit(0);
}

try {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
    cwd: repoRoot,
    stdio: "ignore",
  });

  console.log("Configured git to use repository hooks from .githooks.");
} catch (error) {
  console.error("Failed to configure git hooks automatically.");
  console.error("Run `git config core.hooksPath .githooks` manually if your environment blocks writes to .git/config.");
  throw error;
}
