import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXCLUDED_DIRS = new Set(["tests", "ui", "node_modules"]);
const EXCLUDED_FILES = new Set([".DS_Store", "package-lock.json"]);
const CHANGELOG_ENTRY_RE = /^\s*-\s+(?<date>\d{4}-\d{2}-\d{2})\s+\[(?<pluginId>[^\]]+)\]\s+(?<message>.+?)\s*$/;
const PACKAGE_CHANGE_RE = /(?:生成包完成|测试包完成)/;
const RELEASE_CHANGE_RE = /^生成包完成/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseArgs(argv) {
  const options = {
    pluginIds: [],
    tag: null,
    outDir: null,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--plugin") {
      options.pluginIds.push(argv[++index] || "");
      continue;
    }
    if (arg.startsWith("--plugin=")) {
      options.pluginIds.push(arg.slice("--plugin=".length));
      continue;
    }

    if (arg === "--tag") {
      options.tag = argv[++index] || "";
      continue;
    }
    if (arg.startsWith("--tag=")) {
      options.tag = arg.slice("--tag=".length);
      continue;
    }

    if (arg === "--out-dir") {
      options.outDir = argv[++index] || "";
      continue;
    }
    if (arg.startsWith("--out-dir=")) {
      options.outDir = arg.slice("--out-dir=".length);
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`未知参数：${arg}`);
    }

    options.pluginIds.push(arg);
  }

  options.pluginIds = unique(options.pluginIds.map((value) => text(value)).filter(Boolean));
  return options;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonIfExists(filePath) {
  return (await exists(filePath)) ? readJson(filePath) : null;
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function rewriteVersionIfPresent(filePath, version) {
  if (!(await exists(filePath))) return false;
  const value = await readJson(filePath);
  if (value && typeof value === "object" && value.version !== version) {
    value.version = version;
    await writeJson(filePath, value);
  }
  return true;
}

async function discoverPluginDirectories() {
  const entries = await fs.readdir(ROOT, { withFileTypes: true });
  const candidates = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;
    if (["dist", "scripts", "node_modules"].includes(entry.name)) continue;

    const manifestPath = path.join(ROOT, entry.name, "manifest.json");
    if (await exists(manifestPath)) {
      candidates.push(entry.name);
    }
  }

  return candidates.sort((a, b) => a.localeCompare(b));
}

async function loadPlugins(filterIds = []) {
  const filters = new Set(filterIds);
  const directories = await discoverPluginDirectories();
  const plugins = [];
  const matchedFilters = new Set();

  for (const directory of directories) {
    const pluginDir = path.join(ROOT, directory);
    const manifestPath = path.join(pluginDir, "manifest.json");
    const packagePath = path.join(pluginDir, "package.json");
    const manifest = await readJson(manifestPath);
    const packageJson = await readJsonIfExists(packagePath) || {};
    const pluginId = text(manifest.id) || directory;

    if (filters.size > 0 && !filters.has(pluginId) && !filters.has(directory)) {
      continue;
    }

    if (filters.has(pluginId)) matchedFilters.add(pluginId);
    if (filters.has(directory)) matchedFilters.add(directory);

    const manifestVersion = text(manifest.version);
    const packageVersion = text(packageJson.version);
    const version = manifestVersion || packageVersion;
    assert(version, `${pluginId}: 找不到版本号`);
    if (manifestVersion && packageVersion) {
      assert(manifestVersion === packageVersion, `${pluginId}: manifest.version 与 package.json.version 不一致`);
    }

    const homepage = text(manifest.homepage) || text(packageJson.homepage);
    assert(homepage, `${pluginId}: 找不到 homepage`);
    assert(pluginId === directory, `${directory}: manifest.id 必须与目录名一致，当前为 ${pluginId}`);

    plugins.push({
      pluginId,
      version,
      homepage,
      pluginDir,
      manifestPath,
      packagePath,
    });
  }

  if (filters.size > 0) {
    const unresolved = [...filters].filter((value) => !matchedFilters.has(value));
    assert(unresolved.length === 0, `找不到插件目录：${unresolved.join(", ")}`);
  }

  assert(plugins.length > 0, "没有找到可发布的插件目录");
  return plugins.sort((a, b) => a.pluginId.localeCompare(b.pluginId));
}

async function copyDirectory(sourceDir, targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) continue;
    if (entry.isFile() && EXCLUDED_FILES.has(entry.name)) continue;

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile()) {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

function crc32(buffer) {
  const table = (() => {
    const cached = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let value = i;
      for (let j = 0; j < 8; j += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      cached[i] = value >>> 0;
    }
    return cached;
  })();

  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function collectFiles(rootDir, dir = rootDir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) continue;
    if (entry.isFile() && EXCLUDED_FILES.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(rootDir, fullPath));
    } else if (entry.isFile()) {
      const relativePath = path.relative(rootDir, fullPath).split(path.sep).join("/");
      files.push({ fullPath, relativePath });
    }
  }

  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

async function createStoredZip({ rootDir, prefix, outFile }) {
  const files = await collectFiles(rootDir);
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const file of files) {
    const zipName = `${prefix}/${file.relativePath}`;
    const nameBuf = Buffer.from(zipName);
    const data = await fs.readFile(file.fullPath);
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + data.length;
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  const zip = Buffer.concat([...locals, ...centrals, end]);
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, zip);
  return {
    fileCount: files.length,
    bytes: zip.length,
    sha256: crypto.createHash("sha256").update(zip).digest("hex"),
  };
}

function parseChangelogEntries(lines) {
  const entries = [];
  for (const line of lines) {
    const match = line.match(CHANGELOG_ENTRY_RE);
    if (!match?.groups?.pluginId || !match.groups.date || !match.groups.message) {
      continue;
    }
    entries.push({
      raw: line.trim(),
      date: match.groups.date,
      pluginId: match.groups.pluginId,
      message: match.groups.message.trim(),
    });
  }
  return entries;
}

function splitChangelogBlocks(content) {
  const body = content.replace(/^#\s*更新日志\s*\r?\n+/i, "");
  const lines = body.split(/\r?\n/);

  while (lines.length > 0 && lines[0].trim() === "") {
    lines.shift();
  }

  const currentBlock = [];
  let index = 0;
  for (; index < lines.length; index += 1) {
    if (lines[index].trim() === "") {
      index += 1;
      break;
    }
    currentBlock.push(lines[index]);
  }

  return {
    currentBlockEntries: parseChangelogEntries(currentBlock),
    remainingEntries: parseChangelogEntries(lines.slice(index)),
  };
}

function collectChangedPluginIds(currentBlockEntries, packagedPluginIds) {
  const packagedSet = new Set(packagedPluginIds);
  const releaseEntries = currentBlockEntries.filter((entry) => packagedSet.has(entry.pluginId) && RELEASE_CHANGE_RE.test(entry.message));
  if (releaseEntries.length > 0) {
    return unique(releaseEntries.map((entry) => entry.pluginId));
  }

  const packagedEntries = currentBlockEntries.filter((entry) => packagedSet.has(entry.pluginId) && PACKAGE_CHANGE_RE.test(entry.message));
  if (packagedEntries.length > 0) {
    return unique(packagedEntries.map((entry) => entry.pluginId));
  }

  const directEntries = currentBlockEntries.filter((entry) => packagedSet.has(entry.pluginId));
  if (directEntries.length > 0) {
    return unique(directEntries.map((entry) => entry.pluginId));
  }

  return [...packagedPluginIds];
}

function collectPluginNotes(remainingEntries, pluginId, limit = 3) {
  const notes = [];
  for (const entry of remainingEntries) {
    if (entry.pluginId !== pluginId) continue;
    if (PACKAGE_CHANGE_RE.test(entry.message)) continue;
    notes.push(entry);
    if (notes.length >= limit) break;
  }
  return notes;
}

async function buildReleaseNotes(changelogPath, tag, plugins) {
  if (!(await exists(changelogPath))) {
    return `# ${tag}\n\nRelease for ${plugins.length} plugins.\n`;
  }

  const content = await fs.readFile(changelogPath, "utf8");
  const { currentBlockEntries, remainingEntries } = splitChangelogBlocks(content);
  const changedPluginIds = collectChangedPluginIds(currentBlockEntries, plugins.map((plugin) => plugin.pluginId));
  const currentEntryByPlugin = new Map();

  for (const entry of currentBlockEntries) {
    if (!currentEntryByPlugin.has(entry.pluginId)) {
      currentEntryByPlugin.set(entry.pluginId, entry);
    }
  }

  const lines = [
    `# ${tag}`,
    "",
    `本次 Release 附带 ${plugins.length} 个插件压缩包。`,
    "变更摘要根据 CHANGELOG.md 自动提取。",
    "",
    "## 打包资产",
    "",
  ];

  for (const plugin of plugins) {
    lines.push(`- ${plugin.pluginId} v${plugin.version}`);
  }

  lines.push("", "## 变更摘要", "");

  for (const pluginId of changedPluginIds) {
    const plugin = plugins.find((item) => item.pluginId === pluginId);
    const notes = collectPluginNotes(remainingEntries, pluginId);
    lines.push(`### ${pluginId}${plugin ? ` v${plugin.version}` : ""}`);
    if (notes.length > 0) {
      for (const note of notes) {
        lines.push(`- ${note.date} ${note.message}`);
      }
    } else {
      const fallback = currentEntryByPlugin.get(pluginId);
      lines.push(`- ${fallback ? `${fallback.date} ${fallback.message}` : "未找到对应的更新日志条目。"}`);
    }
    lines.push("");
  }

  const unchangedCount = plugins.length - changedPluginIds.length;
  if (unchangedCount > 0) {
    lines.push(`其余 ${unchangedCount} 个插件本次随 Release 一并重新打包，但 CHANGELOG 没有记录新的变更摘要。`, "");
  }

  return lines.join("\n").trimEnd() + "\n";
}

function buildAssetMetadata({ homepage, pluginId, version, tag, sha256, outFile, fileCount, bytes }) {
  const baseUrl = `${homepage.replace(/\/$/, "")}/`;
  return {
    pluginId,
    version,
    tag,
    assetName: `${pluginId}.zip`,
    archivePath: path.relative(ROOT, outFile).split(path.sep).join("/"),
    sha256,
    fileCount,
    bytes,
    packageUrl: new URL(`releases/download/${tag}/${pluginId}.zip`, baseUrl).toString(),
    releaseUrl: new URL(`releases/tag/${tag}`, baseUrl).toString(),
  };
}

function buildReleaseMetadata({ tag, outDir, notesFile, assets }) {
  return {
    tag,
    outDir: path.relative(ROOT, outDir).split(path.sep).join("/"),
    notesFile: path.relative(ROOT, notesFile).split(path.sep).join("/"),
    assets,
  };
}

async function packagePlugin(plugin, outDir) {
  const stagingRoot = await fs.mkdtemp(path.join(os.tmpdir(), `hanako-release-${plugin.pluginId}-`));
  const stagingDir = path.join(stagingRoot, plugin.pluginId);
  const outFile = path.join(outDir, `${plugin.pluginId}.zip`);

  try {
    await copyDirectory(plugin.pluginDir, stagingDir);

    const licensePath = path.join(ROOT, "STAT-LICENSE");
    if (await exists(licensePath)) {
      await fs.copyFile(licensePath, path.join(stagingDir, "STAT-LICENSE"));
    }

    await rewriteVersionIfPresent(path.join(stagingDir, "manifest.json"), plugin.version);
    await rewriteVersionIfPresent(path.join(stagingDir, "package.json"), plugin.version);

    const packageResult = await createStoredZip({
      rootDir: stagingDir,
      prefix: plugin.pluginId,
      outFile,
    });

    return { outFile, packageResult };
  } finally {
    await fs.rm(stagingRoot, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(`用法：node scripts/release.mjs [--plugin <id> ...] --tag <tag> [--out-dir <dir>]\n\n说明：\n  --plugin   只打包指定插件；省略时默认打包工作区里的全部插件\n  --tag      本次仓库级 Release tag，例如 release-20260519-120000-000\n  --out-dir  产物输出目录，默认 dist/releases/<tag>`);
    return;
  }

  const tag = text(options.tag);
  assert(tag, "发布 tag 不能为空");

  const plugins = await loadPlugins(options.pluginIds);
  const outDir = path.resolve(options.outDir || path.join(ROOT, "dist", "releases", tag));
  const notesFile = path.join(outDir, `${tag}.notes.md`);
  const metadataFile = path.join(outDir, `${tag}.release.json`);
  const changelogPath = path.join(ROOT, "CHANGELOG.md");
  const assets = [];

  for (const plugin of plugins) {
    const { outFile, packageResult } = await packagePlugin(plugin, outDir);
    assets.push(buildAssetMetadata({
      homepage: plugin.homepage,
      pluginId: plugin.pluginId,
      version: plugin.version,
      tag,
      sha256: packageResult.sha256,
      outFile,
      fileCount: packageResult.fileCount,
      bytes: packageResult.bytes,
    }));
  }

  const releaseNotes = await buildReleaseNotes(changelogPath, tag, plugins);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(notesFile, releaseNotes, "utf8");

  const metadata = buildReleaseMetadata({
    tag,
    outDir,
    notesFile,
    assets,
  });
  await fs.writeFile(metadataFile, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  console.log(JSON.stringify(metadata, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});