import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".css"]);

const toPosix = (value) => value.split(path.sep).join("/");

const walkFiles = (dirPath, files) => {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const nextPath = path.join(dirPath, entry.name);
    const relative = toPosix(path.relative(ROOT, nextPath));

    if (
      relative.startsWith(".next/") ||
      relative.startsWith("node_modules/") ||
      relative.startsWith(".git/")
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      walkFiles(nextPath, files);
      continue;
    }

    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(nextPath);
    }
  }
};

const files = [];
for (const dir of SCAN_DIRS) {
  walkFiles(path.join(ROOT, dir), files);
}

const inlineStyleRegex = /style=\{\{/g;
const rawHexClassRegex = /className\s*=\s*(?:"[^"]*#[0-9a-fA-F]{3,8}[^"]*"|`[^`]*#[0-9a-fA-F]{3,8}[^`]*`)/gs;
const arbitraryClassRegex = /className\s*=\s*(?:"[^"]*\[[^\]]+\][^"]*"|`[^`]*\[[^\]]+\][^`]*`)/gs;

const countsByType = {
  inlineStyle: 0,
  rawHexClass: 0,
  arbitraryClass: 0,
};

const filesByType = {
  inlineStyle: new Map(),
  rawHexClass: new Map(),
  arbitraryClass: new Map(),
};

const increment = (kind, filePath, count) => {
  if (!count) {
    return;
  }

  countsByType[kind] += count;
  filesByType[kind].set(filePath, (filesByType[kind].get(filePath) ?? 0) + count);
};

for (const filePath of files) {
  const source = fs.readFileSync(filePath, "utf8");

  const inlineStyleMatches = source.match(inlineStyleRegex)?.length ?? 0;
  const rawHexClassMatches = source.match(rawHexClassRegex)?.length ?? 0;
  const arbitraryClassMatches = source.match(arbitraryClassRegex)?.length ?? 0;

  increment("inlineStyle", filePath, inlineStyleMatches);
  increment("rawHexClass", filePath, rawHexClassMatches);
  increment("arbitraryClass", filePath, arbitraryClassMatches);
}

const cssFiles = [];
walkFiles(ROOT, cssFiles);
const customCssFiles = cssFiles
  .map((filePath) => toPosix(path.relative(ROOT, filePath)))
  .filter((filePath) => filePath.endsWith(".css") || filePath.endsWith(".scss") || filePath.endsWith(".sass"))
  .filter((filePath) => filePath !== "app/globals.css");

const formatTopFiles = (entries) =>
  entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([filePath, count]) => `  - ${toPosix(path.relative(ROOT, filePath))}: ${count}`)
    .join("\n");

console.log("Style audit report");
console.log("==================");
console.log(`Inline style usage: ${countsByType.inlineStyle}`);
console.log(`Raw hex in className: ${countsByType.rawHexClass}`);
console.log(`Arbitrary utility usage: ${countsByType.arbitraryClass}`);
console.log(`Custom stylesheet files (excluding app/globals.css): ${customCssFiles.length}`);

if (countsByType.inlineStyle > 0) {
  console.log("\nTop inline style files:");
  console.log(formatTopFiles([...filesByType.inlineStyle.entries()]));
}

if (countsByType.rawHexClass > 0) {
  console.log("\nTop raw hex class files:");
  console.log(formatTopFiles([...filesByType.rawHexClass.entries()]));
}

if (customCssFiles.length > 0) {
  console.log("\nCustom stylesheet files:");
  customCssFiles.slice(0, 20).forEach((filePath) => {
    console.log(`  - ${filePath}`);
  });
}

console.log("\nNote: This report is informational and does not fail CI.");
