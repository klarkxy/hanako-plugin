import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXCLUDED_DIRS = new Set(["tests", "ui", "node_modules"]);
const EXCLUDED_FILES = new Set([".DS_Store", "package-lock.json"]);
const RELEASE_TAG_RE = /^(?<pluginId>.+)-v(?<version>[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?)$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseReleaseTag(tag) {
  const normalized = text(tag);
  if (!normalized) return null;
  const match = normalized.match(RELEASE_TAG_RE);
  if (!match?.groups?.pluginId || !match.groups.version) return null;
  return {
    pluginId: match.groups.pluginId,
    version: match.groups.version,
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseArgs(argv) {
  const options = {
    pluginId: null,
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
      options.pluginId = argv[++index] || "";
      continue;
    }
    if (arg.startsWith("--plugin=")) {
      options.pluginId = arg.slice("--plugin=".length);
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

    if (!options.pluginId) {
      options.pluginId = arg;
      continue;
    }
    if (!options.tag) {
      options.tag = arg;
      continue;
    }

    throw new Error(`多余的参数：${arg}`);
  }

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

async function discoverPluginId() {
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

  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) {
    throw new Error("没有找到可发布的插件目录");
  }
  throw new Error(`检测到多个插件目录，请使用 --plugin 指定：${candidates.join(", ")}`);
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

async function buildReleaseNotes(changelogPath, pluginId, tag) {
  if (!(await exists(changelogPath))) {
    return `# ${tag}\n\nRelease for ${pluginId}.\n`;
  }

  const content = await fs.readFile(changelogPath, "utf8");
  const lines = content.split(/\r?\n/);
  const entryPattern = new RegExp(`^\\s*-\\s+(?<date>\\d{4}-\\d{2}-\\d{2})\\s+\\[(?<pluginId>[^\\]]+)\\]\\s+`);
  const notes = [];
  let started = false;
  let targetDate = null;

  for (const line of lines) {
    const match = line.match(entryPattern);

    if (!started) {
      if (match?.groups?.pluginId === pluginId) {
        started = true;
        targetDate = match.groups.date;
        notes.push(line);
      }
      continue;
    }

    if (match) {
      if (match.groups.date !== targetDate) {
        break;
      }
      if (match.groups.pluginId === pluginId) {
        notes.push(line);
      }
      continue;
    }

    if (line.trim() === "") {
      notes.push(line);
      continue;
    }

    break;
  }

  if (notes.length === 0) {
    return `# ${tag}\n\nRelease for ${pluginId}.\n`;
  }

  return [`# ${tag}`, "", ...notes].join("\n").trimEnd() + "\n";
}

function buildReleaseMetadata({ homepage, pluginId, version, tag, sha256, outFile }) {
  const baseUrl = `${homepage.replace(/\/$/, "")}/`;
  return {
    pluginId,
    version,
    tag,
    archivePath: path.relative(ROOT, outFile).split(path.sep).join("/"),
    assetName: `${pluginId}.zip`,
    sha256,
    packageUrl: new URL(`releases/download/${tag}/${pluginId}.zip`, baseUrl).toString(),
    releaseUrl: new URL(`releases/tag/${tag}`, baseUrl).toString(),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(`用法：node scripts/release.mjs [--plugin <id>] [--tag <tag>] [--out-dir <dir>]\n\n说明：\n  --plugin   要发布的插件 id；如果省略，则优先从 tag 解析，单插件仓库则自动识别\n  --tag      发布 tag，默认使用 <plugin-id>-v<version>\n  --out-dir  产物输出目录，默认 dist/releases/<plugin-id>/<tag>`);
    return;
  }

  const parsedTag = parseReleaseTag(options.tag);
  const pluginId = text(options.pluginId) || parsedTag?.pluginId || await discoverPluginId();
  assert(pluginId, "插件 id 不能为空");

  const pluginDir = path.join(ROOT, pluginId);
  assert(await exists(pluginDir), `${pluginId}: 找不到插件目录`);

  const manifestPath = path.join(pluginDir, "manifest.json");
  const packagePath = path.join(pluginDir, "package.json");
  const manifest = await readJson(manifestPath);
  const packageJson = await readJsonIfExists(packagePath) || {};

  assert(manifest.id === pluginId, `${pluginId}: manifest.id 必须与目录 id 一致`);

  const versionFromTag = parsedTag?.version || null;
  const version = versionFromTag || text(manifest.version) || text(packageJson.version);
  assert(version, `${pluginId}: 找不到版本号`);
  if (versionFromTag) {
    const sourceVersions = [text(manifest.version), text(packageJson.version)].filter(Boolean);
    const mismatched = sourceVersions.length > 0 && sourceVersions.some((item) => item !== versionFromTag);
    if (mismatched) {
      console.warn(`${pluginId}: 源码版本 ${sourceVersions.join(", ")} 与 tag 版本 ${versionFromTag} 不一致，将以 tag 版本打包。`);
    }
  } else {
    if (packageJson.version) {
      assert(text(packageJson.version) === version, `${pluginId}: manifest.version 与 package.json.version 不一致`);
    }
    if (text(manifest.version)) {
      assert(text(manifest.version) === version, `${pluginId}: manifest.version 必须与发布版本一致`);
    }
  }

  const expectedTag = `${pluginId}-v${version}`;
  const tag = text(options.tag) || expectedTag;
  assert(tag === expectedTag, `${pluginId}: tag 必须是 ${expectedTag}`);

  const homepage = text(manifest.homepage) || text(packageJson.homepage);
  assert(homepage, `${pluginId}: 找不到 homepage`);

  const outDir = path.resolve(options.outDir || path.join(ROOT, "dist", "releases", pluginId, tag));
  const outFile = path.join(outDir, `${pluginId}.zip`);
  const notesFile = path.join(outDir, `${tag}.notes.md`);
  const metadataFile = path.join(outDir, `${tag}.release.json`);
  const changelogPath = path.join(ROOT, "CHANGELOG.md");

  const stagingRoot = await fs.mkdtemp(path.join(os.tmpdir(), `hanako-release-${pluginId}-`));
  const stagingDir = path.join(stagingRoot, pluginId);

  try {
    await copyDirectory(pluginDir, stagingDir);
    await fs.copyFile(path.join(ROOT, "STAT-LICENSE"), path.join(stagingDir, "STAT-LICENSE"));
    await rewriteVersionIfPresent(path.join(stagingDir, "manifest.json"), version);
    await rewriteVersionIfPresent(path.join(stagingDir, "package.json"), version);

    const packageResult = await createStoredZip({ rootDir: stagingDir, prefix: pluginId, outFile });
    const releaseNotes = await buildReleaseNotes(changelogPath, pluginId, tag);
    await fs.writeFile(notesFile, releaseNotes, "utf8");

    const metadata = buildReleaseMetadata({
      homepage,
      pluginId,
      version,
      tag,
      sha256: packageResult.sha256,
      outFile,
    });

    await fs.writeFile(metadataFile, `${JSON.stringify({ ...metadata, notesFile: path.relative(ROOT, notesFile).split(path.sep).join("/") }, null, 2)}\n`, "utf8");

    console.log(JSON.stringify({
      ...metadata,
      notesFile: path.relative(ROOT, notesFile).split(path.sep).join("/"),
      metadataFile: path.relative(ROOT, metadataFile).split(path.sep).join("/"),
      fileCount: packageResult.fileCount,
      bytes: packageResult.bytes,
    }, null, 2));
  } finally {
    await fs.rm(stagingRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});