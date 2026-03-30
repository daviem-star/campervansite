import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const checkMode = process.argv.includes("--check");

function runGit(args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
  }).trimEnd();
}

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function walk(relativeDir, predicate) {
  const baseDir = path.join(repoRoot, relativeDir);
  const results = [];

  function visit(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === ".next" || entry.name === "node_modules") {
        continue;
      }

      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }

      const relativePath = path.relative(repoRoot, absolutePath).split(path.sep).join("/");

      if (predicate(relativePath)) {
        results.push(relativePath);
      }
    }
  }

  if (fs.existsSync(baseDir)) {
    visit(baseDir);
  }

  return results.sort();
}

function formatList(items) {
  return items.map((item) => `\`${item}\``).join(", ");
}

function groupPath(relativePath) {
  const parts = relativePath.split("/");

  if (parts.length === 1) {
    return "repo-root";
  }

  if (parts[0] === "app" && parts[1] === "api") {
    return "app/api";
  }

  if (parts[0] === "components" && parts[1] === "planner") {
    return "components/planner";
  }

  if (parts[0] === "tests" && parts[1] === "e2e") {
    return "tests/e2e";
  }

  if (parts[0] === "supabase" && parts[1] === "migrations") {
    return "supabase/migrations";
  }

  return parts[0];
}

function normalizeSubject(subject) {
  return subject.replace(/\s+/g, " ").trim();
}

function routeFromPage(relativePath) {
  const raw = relativePath.replace(/^app\//, "").replace(/\/page\.tsx$/, "");

  if (!raw || raw === "page.tsx") {
    return "/";
  }

  return `/${raw}`
    .replace(/\/\([^/]+\)/g, "")
    .replace(/\/@[^/]+/g, "")
    .replace(/\/+/g, "/");
}

function routeFromApi(relativePath) {
  const raw = relativePath.replace(/^app\/api\//, "").replace(/\/route\.ts$/, "");
  return `/api/${raw}`.replace(/\/+/g, "/");
}

function getCommitEntries({ limit, reverse = false, noMerges = false } = {}) {
  const args = ["log"];

  if (reverse) {
    args.push("--reverse");
  }

  if (noMerges) {
    args.push("--no-merges");
  }

  args.push("--date=short", "--format=__COMMIT__%n%H%n%h%n%ad%n%s", "--name-only");

  if (typeof limit === "number") {
    args.push(`-${limit}`);
  }

  const output = runGit(args);

  return output
    .split("__COMMIT__\n")
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      const [hash, shortHash, date, ...rest] = lines;
      const subject = rest.shift()?.trim() ?? "";
      const files = rest.filter(Boolean);

      return {
        hash,
        shortHash,
        date,
        subject,
        files,
      };
    });
}

function summarizeAreas(files, maxItems = 4) {
  const counts = new Map();

  for (const file of files) {
    const area = groupPath(file);
    counts.set(area, (counts.get(area) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, maxItems)
    .map(([area]) => area);
}

function aggregateAreas(entries) {
  const counts = new Map();

  for (const entry of entries) {
    for (const file of entry.files) {
      const area = groupPath(file);
      counts.set(area, (counts.get(area) ?? 0) + 1);
    }
  }

  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

function parseEnvVars() {
  return readText(".env.example")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("=")[0]);
}

function parseQaChecklist() {
  const lines = readText("docs/QA_NOTES.md").split(/\r?\n/);
  const sections = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith("### ")) {
      current = {
        name: line.slice(4).trim(),
        open: 0,
        total: 0,
      };
      sections.push(current);
      continue;
    }

    if (!current || !line.startsWith("- [")) {
      continue;
    }

    current.total += 1;

    if (line.startsWith("- [ ]")) {
      current.open += 1;
    }
  }

  return sections.filter((section) => section.total > 0);
}

function parseProductPlan() {
  const text = readText("docs/PRODUCT_PLAN.md");
  const lines = text.split(/\r?\n/);

  function readStatus(label) {
    const index = lines.findIndex((line) => line.trim() === label);

    if (index === -1) {
      return "Unknown";
    }

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor].trim();

      if (!line) {
        continue;
      }

      if (line.startsWith("Status:")) {
        return line.replace(/^Status:\s*/, "");
      }

      if (line.startsWith("## ")) {
        break;
      }
    }

    return "Unknown";
  }

  function readTopLevelBullets(startLine) {
    const index = lines.findIndex((line) => line.trim() === startLine);

    if (index === -1) {
      return [];
    }

    const items = [];

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      const trimmed = line.trim();

      if (trimmed.startsWith("## ") || trimmed.startsWith("### ")) {
        break;
      }

      if (line.startsWith("- ")) {
        items.push(trimmed.slice(2));
      }
    }

    return items;
  }

  function readOutlineBullets(startLine) {
    const index = lines.findIndex((line) => line.trim() === startLine);

    if (index === -1) {
      return [];
    }

    const items = [];
    let current = null;

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      const trimmed = line.trim();

      if (trimmed.startsWith("## ") || trimmed.startsWith("### ")) {
        break;
      }

      if (line.startsWith("- ")) {
        if (current) {
          items.push(current);
        }

        current = trimmed.slice(2);
        continue;
      }

      if (line.startsWith("  - ") && current) {
        const child = trimmed.slice(2);

        if (current.endsWith(":")) {
          current = `${current} ${child}`;
        } else {
          current = `${current}; ${child}`;
        }
      }
    }

    if (current) {
      items.push(current);
    }

    return items;
  }

  return {
    phase1Status: readStatus("## Phase 1: Foundation And Trust"),
    phase2Status: readStatus("## Phase 2: Planning Quality"),
    phase3Status: readStatus("## Phase 3: On-Road Readiness"),
    phase1Remaining: readOutlineBullets("### What Still Remains"),
    phase2Priorities: readTopLevelBullets("Priority areas:"),
  };
}

function detectKind(subject) {
  const trimmed = subject.trim();

  if (trimmed.startsWith("Merge pull request")) {
    return "merge";
  }

  const match = trimmed.match(/^([a-z]+)(?:\([^)]*\))?:/);
  return match ? match[1] : "other";
}

function generateProjectStatus() {
  const latestCommit = getCommitEntries({ limit: 1 })[0];
  const allCommits = getCommitEntries();
  const recentNonMergeCommits = getCommitEntries({ limit: 8, noMerges: true });
  const hotAreaCounts = aggregateAreas(getCommitEntries({ limit: 10, noMerges: true })).slice(0, 6);
  const qaChecklist = parseQaChecklist();
  const productPlan = parseProductPlan();
  const envVars = parseEnvVars();
  const pageRoutes = walk("app", (file) => file.endsWith("/page.tsx") || file === "app/page.tsx").map(routeFromPage);
  const apiRoutes = walk("app/api", (file) => file.endsWith("/route.ts")).map(routeFromApi);
  const plannerComponents = walk("components/planner", (file) => file.endsWith(".tsx")).map((file) =>
    path.basename(file, path.extname(file)),
  );
  const vitestFiles = walk(".", (file) => file.endsWith(".test.ts") || file.endsWith(".test.tsx"));
  const playwrightSpecs = walk("tests", (file) => file.endsWith(".spec.ts") || file.endsWith(".spec.tsx"));
  const generatedAt = runGit(["log", "-1", "--format=%cI"]);

  const keyFiles = [
    ["store/useTripStore.ts", "central trip state, edit locking, sync flow"],
    ["components/planner/PlannerApp.tsx", "main planner shell and responsive orchestration"],
    ["components/planner/PlannerMap.tsx", "map framing, selection, and route rendering"],
    ["components/planner/StopEditorModal.tsx", "stop editing, search, and metadata capture"],
    ["lib/repository.ts", "trip persistence adapter and storage coordination"],
    ["lib/tripDerived.ts", "derived itinerary, warnings, and planner calculations"],
    ["app/api/trips/[tripId]/route.ts", "cloud trip read/write endpoint"],
    ["app/api/route-estimates/route.ts", "routing estimates and fallback behavior"],
    ["app/api/route-access/route.ts", "snapped route-access lookup"],
  ].filter(([relativePath]) => fs.existsSync(path.join(repoRoot, relativePath)));

  const docMap = [
    ["README.md", "entrypoint summary and setup"],
    ["docs/PROJECT_STATUS.md", "generated current-state snapshot"],
    ["docs/RECENT_WORK.md", "generated git-history breadcrumb trail"],
    ["docs/PRODUCT_PLAN.md", "manual roadmap and milestone order"],
    ["docs/FOUNDATION_ACTIVATION.md", "manual activation and hosted smoke runbook"],
    ["docs/QA_NOTES.md", "manual QA checklist and issue log"],
    ["docs/DOCS_AUTOMATION.md", "how this documentation system works"],
  ];

  return `# Project Status

This file is generated by \`scripts/docs/generate-project-status.mjs\`. Edit the source docs instead of hand-editing this snapshot.

## Snapshot

- Generated at: ${generatedAt}
- Branch: \`${runGit(["rev-parse", "--abbrev-ref", "HEAD"])}\`
- Latest commit: \`${latestCommit.shortHash}\` (${latestCommit.date}) ${normalizeSubject(latestCommit.subject)}
- Total commits on \`HEAD\`: ${runGit(["rev-list", "--count", "HEAD"])}
- History span: ${allCommits[allCommits.length - 1]?.date ?? "unknown"} -> ${latestCommit.date}

## Product Position

- Phase 1: ${productPlan.phase1Status}
- Phase 2: ${productPlan.phase2Status}
- Phase 3: ${productPlan.phase3Status}

## Current Surface Area

- App routes: ${formatList(pageRoutes)}
- API routes: ${formatList(apiRoutes)}
- Planner components (${plannerComponents.length}): ${formatList(plannerComponents)}
- Test files: ${vitestFiles.length} Vitest-style files, ${playwrightSpecs.length} Playwright specs
- Service env vars: ${formatList(envVars)}

## Key Files To Re-Orient Quickly

${keyFiles.map(([relativePath, description]) => `- \`${relativePath}\`: ${description}`).join("\n")}

## Open Phase 1 Work

${productPlan.phase1Remaining.map((item) => `- ${item}`).join("\n")}

## Phase 2 Queue

${productPlan.phase2Priorities.map((item) => `- ${item}`).join("\n")}

## Manual QA Still Open

${qaChecklist.map((section) => `- ${section.name}: ${section.open}/${section.total} checklist items still open`).join("\n")}

## Most Active Areas In Recent Work

${hotAreaCounts.map(([area, count]) => `- \`${area}\`: ${count} file touches across the last 10 non-merge commits`).join("\n")}

## Recent Substantive Commits

| Date | Commit | Summary | Areas |
| --- | --- | --- | --- |
${recentNonMergeCommits
  .map((entry) => {
    const areas = summarizeAreas(entry.files).map((area) => `\`${area}\``).join(", ");
    return `| ${entry.date} | \`${entry.shortHash}\` | ${normalizeSubject(entry.subject).replace(/\|/g, "\\|")} | ${areas || "-"} |`;
  })
  .join("\n")}

## Docs Reading Order For The Next Session

1. \`docs/PROJECT_STATUS.md\`
2. \`docs/RECENT_WORK.md\`
3. \`docs/PRODUCT_PLAN.md\`
4. \`docs/FOUNDATION_ACTIVATION.md\`
5. \`docs/QA_NOTES.md\`

## Docs Map

${docMap.map(([relativePath, description]) => `- \`${relativePath}\`: ${description}`).join("\n")}
`;
}

function generateRecentWork() {
  const commits = getCommitEntries({ reverse: true });
  const totalCommits = commits.length;
  const mergeCommits = commits.filter((entry) => detectKind(entry.subject) === "merge").length;
  const nonMergeCommits = totalCommits - mergeCommits;
  const activeAreas = aggregateAreas(commits).slice(0, 8);

  return `# Recent Work

This file is generated from \`git log\`. It is meant to leave a fast breadcrumb trail for the next development session and for quick GitHub checks.

## History Snapshot

- Total commits: ${totalCommits}
- Merge commits: ${mergeCommits}
- Direct commits: ${nonMergeCommits}
- History span: ${commits[0]?.date ?? "unknown"} -> ${commits[commits.length - 1]?.date ?? "unknown"}

## Most Active Areas Across Repo History

${activeAreas.map(([area, count]) => `- \`${area}\`: ${count} file touches`).join("\n")}

## Delivery Timeline

| Date | Commit | Kind | Summary | Areas |
| --- | --- | --- | --- | --- |
${commits
  .map((entry) => {
    const areas = summarizeAreas(entry.files).map((area) => `\`${area}\``).join(", ");
    return `| ${entry.date} | \`${entry.shortHash}\` | ${detectKind(entry.subject)} | ${normalizeSubject(entry.subject).replace(/\|/g, "\\|")} | ${areas || "-"} |`;
  })
  .join("\n")}
`;
}

function syncFile(relativePath, nextContent) {
  const absolutePath = path.join(repoRoot, relativePath);
  const normalized = `${nextContent.trimEnd()}\n`;
  const current = fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : null;

  if (current === normalized) {
    return false;
  }

  if (!checkMode) {
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, normalized);
  }

  return true;
}

const targets = [
  ["docs/PROJECT_STATUS.md", generateProjectStatus()],
  ["docs/RECENT_WORK.md", generateRecentWork()],
];

const changedFiles = targets
  .filter(([relativePath, content]) => syncFile(relativePath, content))
  .map(([relativePath]) => relativePath);

if (checkMode) {
  if (changedFiles.length > 0) {
    console.error(`Documentation is out of date: ${changedFiles.join(", ")}`);
    process.exit(1);
  }

  console.log("Generated documentation is up to date.");
  process.exit(0);
}

if (changedFiles.length === 0) {
  console.log("Generated documentation already up to date.");
} else {
  console.log(`Updated generated documentation: ${changedFiles.join(", ")}`);
}
