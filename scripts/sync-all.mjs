import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIR, "..");
const OH_PLUGINS_ROOT = resolveOhPluginsRoot();
const DEFAULT_OPENHANAKO_URLS = [
  "http://127.0.0.1:3210",
  "http://localhost:3210",
  "http://127.0.0.1:3211",
  "http://localhost:3211",
];
const EXCLUDED_DIRS = new Set([".git", "node_modules"]);

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizePath(value) {
  const resolved = text(value);
  return resolved ? path.resolve(resolved) : null;
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    publish: false,
    skipOpenHanako: false,
    skipLocalMarketplace: false,
    skipOfficial: false,
    mode: "generate",
    pluginIds: [],
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--skip-openhanako") {
      options.skipOpenHanako = true;
      continue;
    }
    if (arg === "--skip-local-marketplace") {
      options.skipLocalMarketplace = true;
      continue;
    }
    if (arg === "--skip-official") {
      options.skipOfficial = true;
      continue;
    }
    if (arg === "--test") {
      options.mode = "test";
      continue;
    }
    if (arg === "--generate") {
      options.mode = "generate";
      continue;
    }
    if (arg === "--publish") {
      options.publish = true;
      continue;
    }
    if (arg.startsWith("--mode=")) {
      const value = arg.slice("--mode=".length);
      if (value !== "test" && value !== "generate") {
        throw new Error(`未知模式：${value}`);
      }
      options.mode = value;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`未知参数：${arg}`);
    }
    options.pluginIds.push(arg);
  }

  return options;
}

function resolveOhPluginsRoot() {
  const envRoot = normalizePath(process.env.OH_PLUGINS_ROOT);
  if (envRoot) return envRoot;
  return path.resolve(WORKSPACE_ROOT, "..", "OH-Plugins");
}

function resolveOpenHanakoHomes() {
  const homes = [];
  const add = (value) => {
    const resolved = normalizePath(value);
    if (resolved && !homes.includes(resolved)) homes.push(resolved);
  };

  add(process.env.HANA_HOME);
  add(process.env.OPENHANAKO_HOME);

  if (homes.length === 0) {
    add(path.join(os.homedir(), ".hanako"));
    add(path.join(os.homedir(), ".hanako-dev"));
  }

  return homes;
}

function resolveOpenHanakoBaseUrls() {
  const urls = [];
  const add = (value) => {
    const resolved = text(value);
    if (resolved && !urls.includes(resolved)) urls.push(resolved);
  };

  add(process.env.OPENHANAKO_BASE_URL);
  add(process.env.HANA_SERVER_URL);
  if (urls.length === 0) {
    for (const url of DEFAULT_OPENHANAKO_URLS) add(url);
  }

  return urls;
}

function stripGitSuffix(value) {
  return value.replace(/\.git$/i, "");
}

function toHttpsRepositoryUrl(value) {
  if (typeof value === "string") return stripGitSuffix(value);
  if (value && typeof value === "object" && typeof value.url === "string") return stripGitSuffix(value.url);
  return null;
}

function toAuthorName(value) {
  if (typeof value === "string") return value.trim() || null;
  if (value && typeof value === "object") {
    return text(value.name) || text(value.email) || null;
  }
  return null;
}

function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/.exec(text(version) || "");
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function assertSemver(version, label) {
  if (!parseSemver(version)) {
    throw new Error(`${label} 必须是 x.y.z 版本号：${version}`);
  }
  return version;
}

function compareSemver(a, b) {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (!left || !right) {
    return text(a) === text(b) ? 0 : (text(a) > text(b) ? 1 : -1);
  }
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  return left.patch - right.patch;
}

function bumpPatch(version) {
  const parsed = parseSemver(version);
  if (!parsed) {
    throw new Error(`无法递增非 semver 版本：${version}`);
  }
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((item) => text(String(item))).filter(Boolean))];
}

function inferContributions(pluginDir, manifest) {
  const contributions = new Set();
  const hasDir = (name) => fsSync.existsSync(path.join(pluginDir, name));
  const hasFile = (name) => fsSync.existsSync(path.join(pluginDir, name));

  if (hasDir("tools")) contributions.add("tools");
  if (hasDir("skills")) contributions.add("skills");
  if (hasDir("commands")) contributions.add("commands");
  if (hasDir("agents")) contributions.add("agents");
  if (hasDir("routes")) contributions.add("routes");
  if (hasDir("providers")) contributions.add("providers");
  if (hasDir("extensions")) contributions.add("extensions");
  if (manifest?.contributes?.configuration) contributions.add("configuration");
  if (manifest?.contributes?.page) contributions.add("page");
  if (manifest?.contributes?.widget) contributions.add("widget");
  if (manifest?.contributes?.settingsTab) contributions.add("settingsTab");
  if (hasFile("index.js")) contributions.add("lifecycle");

  return [...contributions];
}

function inferPermissions(manifest) {
  if (Array.isArray(manifest?.permissions)) return uniqueStrings(manifest.permissions);
  return [];
}

function normalizeManifestVersion(manifest, packageJson, pluginId) {
  const manifestVersion = text(manifest?.version);
  const packageVersion = text(packageJson?.version);
  const version = manifestVersion || packageVersion;
  if (!version) {
    throw new Error(`${pluginId}: 缺少版本号`);
  }
  assertSemver(version, `${pluginId}: version`);
  return version;
}

function latestMtimeMs(rootPath) {
  return walkLatestMtime(rootPath);
}

async function walkLatestMtime(dirPath) {
  const stat = await fs.stat(dirPath);
  let latest = stat.mtimeMs;
  if (!stat.isDirectory()) return latest;
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) continue;
    const childPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const childLatest = await walkLatestMtime(childPath);
      if (childLatest > latest) latest = childLatest;
    } else if (entry.isFile()) {
      const childStat = await fs.stat(childPath);
      if (childStat.mtimeMs > latest) latest = childStat.mtimeMs;
    }
  }
  return latest;
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
  if (!(await exists(filePath))) return null;
  return readJson(filePath);
}

async function readSharedLicenseInfo() {
  const candidates = [
    path.join(WORKSPACE_ROOT, "STAT-LICENSE"),
    path.join(WORKSPACE_ROOT, "LICENSE"),
  ];

  for (const filePath of candidates) {
    if (!(await exists(filePath))) continue;
    const text = await fs.readFile(filePath, "utf8");
    const projectUrlMatch = text.match(/^Project Url:\s*(\S+)\s*$/im);
    const titleMatch = text.match(/^\s*The Star And Thank Author License \(([^)]+)\)\s*$/im);
    const versionMatch = text.match(/^\s*Version\s+([0-9.]+)\s*,/im);
    const projectUrl = projectUrlMatch?.[1] || null;
    if (!projectUrl) {
      throw new Error(`${path.relative(WORKSPACE_ROOT, filePath)} is missing a Project Url line`);
    }
    const licenseLabel = titleMatch?.[1] && versionMatch?.[1]
      ? `${titleMatch[1]}-${versionMatch[1]}`
      : (titleMatch?.[1] || "SATA");
    return {
      filePath,
      projectUrl,
      licenseLabel,
      readmeUrl(pluginFolder) {
        return new URL(`blob/main/${pluginFolder}/README.md`, `${projectUrl.replace(/\/$/, "")}/`).toString();
      },
      releaseUrl(releaseTag, pluginId) {
        return new URL(`releases/download/${releaseTag}/${pluginId}.zip`, `${projectUrl.replace(/\/$/, "")}/`).toString();
      },
    };
  }

  throw new Error("找不到共享许可证文件：STAT-LICENSE 或 LICENSE");
}

async function writeJson(filePath, value, dryRun) {
  if (dryRun) return;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function copyDirectory(sourceDir, targetDir, dryRun) {
  if (dryRun) return;
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(targetDir), { recursive: true });
  await fs.cp(sourceDir, targetDir, {
    recursive: true,
    force: true,
    filter: (srcPath) => {
      const relative = path.relative(sourceDir, srcPath);
      if (!relative) return true;
      const parts = relative.split(path.sep);
      return !parts.some((part) => EXCLUDED_DIRS.has(part) || part === ".DS_Store");
    },
  });
}

async function runNodeScript(scriptPath, args, cwd) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${scriptPath} exited with code ${code}${stderr.trim() ? `\n${stderr.trim()}` : ""}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function runGitCommand(args, cwd) {
  return await new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`git ${args.join(" ")} exited with code ${code}${stderr.trim() ? `\n${stderr.trim()}` : ""}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function gitHasChanges(repoRoot, paths) {
  if (paths.length === 0) return false;
  const result = await runGitCommand(["status", "--porcelain", "--untracked-files=all", "--", ...paths], repoRoot);
  return result.stdout.trim().length > 0;
}

async function gitCurrentBranch(repoRoot) {
  const result = await runGitCommand(["branch", "--show-current"], repoRoot);
  return text(result.stdout);
}

async function gitTagExists(repoRoot, tag) {
  try {
    await runGitCommand(["rev-parse", "-q", "--verify", `refs/tags/${tag}`], repoRoot);
    return true;
  } catch {
    return false;
  }
}

async function publishGitChanges({ repoRoot, paths, releaseTags = [], commitMessage, remote = "origin", push = false }) {
  const uniquePaths = [...new Set(paths.map((value) => value.split(path.sep).join("/")).filter(Boolean))];
  if (uniquePaths.length === 0) {
    return { committed: false, pushed: false, tags: [] };
  }

  if (!(await gitHasChanges(repoRoot, uniquePaths))) {
    return { committed: false, pushed: false, tags: [] };
  }

  const branch = await gitCurrentBranch(repoRoot);
  assert(branch, `${path.relative(WORKSPACE_ROOT, repoRoot)}: 当前分支为空，无法自动发布`);

  await runGitCommand(["commit", "--only", "-m", commitMessage, "--", ...uniquePaths], repoRoot);

  const tags = [];
  for (const tag of releaseTags) {
    if (await gitTagExists(repoRoot, tag)) {
      throw new Error(`${path.relative(WORKSPACE_ROOT, repoRoot)}: tag 已存在，无法重复创建：${tag}`);
    }
    await runGitCommand(["tag", "-a", tag, "-m", tag], repoRoot);
    tags.push(tag);
  }

  if (push || tags.length > 0) {
    const pushArgs = ["push", remote, `HEAD:${branch}`];
    if (tags.length > 0) {
      pushArgs.push("--follow-tags");
    }
    await runGitCommand(pushArgs, repoRoot);
  }

  return { committed: true, pushed: push || tags.length > 0, tags };
}

function selectEntryFile(pluginsDir, pluginId) {
  const candidates = [
    path.join(pluginsDir, `${pluginId}.yaml`),
    path.join(pluginsDir, `${pluginId}.yml`),
    path.join(pluginsDir, `${pluginId}.json`),
  ];
  return candidates.find((filePath) => fsSync.existsSync(filePath)) || candidates[0];
}

function buildOfficialEntry(plugin, version, sha256, sharedLicense) {
  const releaseTag = `${plugin.id}-v${version}`;
  const githubRepo = sharedLicense.projectUrl;

  return {
    schemaVersion: 1,
    id: plugin.id,
    name: plugin.name,
    publisher: plugin.publisher,
    author: plugin.author || undefined,
    version,
    description: plugin.description,
    license: sharedLicense.licenseLabel,
    categories: plugin.categories,
    keywords: plugin.keywords,
    homepage: githubRepo,
    repository: githubRepo,
    readmeUrl: sharedLicense.readmeUrl(plugin.folderName),
    compatibility: {
      minAppVersion: plugin.minAppVersion,
    },
    trust: plugin.trust,
    permissions: plugin.permissions,
    contributions: plugin.contributions,
    distribution: {
      kind: "release",
      packageUrl: sharedLicense.releaseUrl(releaseTag, plugin.id),
      sha256,
    },
    install: {
      defaultEnabled: false,
    },
  };
}

function buildLocalEntry(plugin, version, sourcePath, sharedLicense) {
  return {
    schemaVersion: 1,
    id: plugin.id,
    name: plugin.name,
    publisher: plugin.publisher,
    author: plugin.author || undefined,
    version,
    description: plugin.description,
    license: sharedLicense.licenseLabel,
    categories: plugin.categories,
    keywords: plugin.keywords,
    homepage: sharedLicense.projectUrl,
    repository: sharedLicense.projectUrl,
    readmePath: path.join(sourcePath, "README.md"),
    compatibility: {
      minAppVersion: plugin.minAppVersion,
    },
    trust: plugin.trust,
    permissions: plugin.permissions,
    contributions: plugin.contributions,
    distribution: {
      kind: "source",
      path: sourcePath,
    },
    install: {
      defaultEnabled: false,
    },
  };
}

async function discoverWorkspacePlugins(pluginFilterIds, sharedLicense) {
  const entries = await fs.readdir(WORKSPACE_ROOT, { withFileTypes: true });
  const plugins = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;
    if (["dist", "scripts", "node_modules"].includes(entry.name)) continue;
    const pluginDir = path.join(WORKSPACE_ROOT, entry.name);
    const manifestPath = path.join(pluginDir, "manifest.json");
    if (!(await exists(manifestPath))) continue;

    const manifest = await readJson(manifestPath);
    const packagePath = path.join(pluginDir, "package.json");
    const packageJson = await readJsonIfExists(packagePath) || {};
    const id = text(manifest.id) || entry.name;
    if (pluginFilterIds.length > 0 && !pluginFilterIds.includes(id) && !pluginFilterIds.includes(entry.name)) continue;

    const version = normalizeManifestVersion(manifest, packageJson, id);
    const name = text(manifest.name) || text(packageJson.name) || id;
    const description = text(manifest.description) || text(packageJson.description) || "";
    const publisher = toAuthorName(manifest.author) || toAuthorName(packageJson.author) || "unknown";
    const author = toAuthorName(manifest.author) || toAuthorName(packageJson.author) || null;
    const keywords = uniqueStrings(manifest.keywords || packageJson.keywords);
    const categories = uniqueStrings(manifest.categories);
    const minAppVersion = text(manifest.minAppVersion) || text(packageJson.engines?.hanako) || "0.0.0";
    assertSemver(minAppVersion, `${id}: minAppVersion`);
    const trust = manifest.trust === "full-access" ? "full-access" : "restricted";
    const permissions = inferPermissions(manifest);
    const contributions = inferContributions(pluginDir, manifest);

    plugins.push({
      id,
      folderName: entry.name,
      pluginDir,
      manifestPath,
      packagePath,
      manifest,
      packageJson,
      version,
      name,
      description,
      license: sharedLicense.licenseLabel,
      publisher,
      author,
      homepage: sharedLicense.projectUrl,
      repository: sharedLicense.projectUrl,
      readmeUrl: sharedLicense.readmeUrl(entry.name),
      keywords,
      categories,
      minAppVersion,
      trust,
      permissions,
      contributions,
    });
  }

  plugins.sort((a, b) => a.id.localeCompare(b.id));
  return plugins;
}

function shouldBumpVersion(sourceIsNewer, workspaceVersion, officialVersion) {
  const comparison = compareSemver(workspaceVersion, officialVersion);
  if (!sourceIsNewer && comparison <= 0) return null;
  if (sourceIsNewer && comparison === 0) return bumpPatch(workspaceVersion);
  if (sourceIsNewer && comparison < 0) return bumpPatch(officialVersion);
  return workspaceVersion;
}

async function preparePackageSource(plugin, sharedLicense, dryRun) {
  if (dryRun) return { sourceDir: plugin.pluginDir, cleanup: async () => {} };
  const stagingRoot = await fs.mkdtemp(path.join(os.tmpdir(), `hanako-sync-${plugin.id}-`));
  const sourceDir = path.join(stagingRoot, plugin.id);
  await copyDirectory(plugin.pluginDir, sourceDir, false);
  await fs.copyFile(sharedLicense.filePath, path.join(sourceDir, "STAT-LICENSE"));
  return {
    sourceDir,
    cleanup: async () => {
      await fs.rm(stagingRoot, { recursive: true, force: true });
    },
  };
}

async function createPackageArtifact(plugin, sharedLicense, dryRun) {
  const packageScript = path.join(OH_PLUGINS_ROOT, "scripts", "package-plugin.mjs");
  const packageSource = await preparePackageSource(plugin, sharedLicense, dryRun);
  try {
    const packageResult = dryRun
      ? { sha256: "0".repeat(64), file: path.join("dist", `${plugin.id}.zip`) }
      : JSON.parse((await runNodeScript(packageScript, [plugin.id, packageSource.sourceDir], OH_PLUGINS_ROOT)).stdout.trim());
    return {
      packageResult,
      cleanup: packageSource.cleanup,
    };
  } catch (error) {
    await packageSource.cleanup();
    throw error;
  }
}

async function writeOfficialPluginEntry(plugin, finalVersion, packageResult, sharedLicense, dryRun) {
  const officialEntryPath = selectEntryFile(path.join(OH_PLUGINS_ROOT, "plugins"), plugin.id);
  const officialEntry = buildOfficialEntry(plugin, finalVersion, packageResult.sha256, sharedLicense);
  await writeJson(officialEntryPath, officialEntry, dryRun);
  await updateOfficialMarketplace([officialEntry], dryRun);
  return {
    officialEntryPath,
    releaseTag: `${plugin.id}-v${finalVersion}`,
  };
}

async function updateLocalMarketplace(homePath, plugins, dryRun, sharedLicense) {
  const marketplacePath = path.join(homePath, "plugin-marketplace", "marketplace.json");
  const existing = await readJsonIfExists(marketplacePath) || { schemaVersion: 1, plugins: [] };
  const managedIds = new Set(plugins.map((plugin) => plugin.id));
  const remaining = Array.isArray(existing.plugins)
    ? existing.plugins.filter((entry) => !managedIds.has(entry.id))
    : [];
  const mergedPlugins = [...remaining];

  for (const plugin of plugins) {
    const sourcePath = path.join(homePath, "plugin-dev-sources", plugin.id);
    await copyDirectory(plugin.pluginDir, sourcePath, dryRun);
    mergedPlugins.push(buildLocalEntry(plugin, plugin.version, sourcePath, sharedLicense));
  }

  mergedPlugins.sort((a, b) => a.id.localeCompare(b.id));
  await writeJson(marketplacePath, {
    ...existing,
    schemaVersion: 1,
    plugins: mergedPlugins,
  }, dryRun);

  return marketplacePath;
}

async function updateOfficialMarketplace(entries, dryRun) {
  const marketplacePath = path.join(OH_PLUGINS_ROOT, "marketplace.json");
  const existing = await readJsonIfExists(marketplacePath) || { schemaVersion: 1, plugins: [] };
  const managedIds = new Set(entries.map((entry) => entry.id));
  const remaining = Array.isArray(existing.plugins)
    ? existing.plugins.filter((entry) => !managedIds.has(entry.id))
    : [];
  const mergedPlugins = [...remaining, ...entries].sort((a, b) => a.id.localeCompare(b.id));
  await writeJson(marketplacePath, {
    ...existing,
    schemaVersion: 1,
    plugins: mergedPlugins,
  }, dryRun);
  return marketplacePath;
}

async function installToPluginsDir(homePath, plugin, dryRun) {
  const targetDir = path.join(homePath, "plugins", plugin.id);
  if (dryRun) {
    return { ok: true, skipped: true, targetDir };
  }
  try {
    // 先清理旧目录，再复制
    await fs.rm(targetDir, { recursive: true, force: true });
    await fs.mkdir(path.dirname(targetDir), { recursive: true });
    await fs.cp(plugin.pluginDir, targetDir, {
      recursive: true,
      force: true,
      filter: (srcPath) => {
        const relative = path.relative(plugin.pluginDir, srcPath);
        if (!relative) return true;
        const parts = relative.split(path.sep);
        return !parts.some((part) => EXCLUDED_DIRS.has(part) || part === ".DS_Store");
      },
    });
    // 同时复制许可文件
    const licenseSrc = path.join(WORKSPACE_ROOT, "STAT-LICENSE");
    if (await exists(licenseSrc)) {
      await fs.copyFile(licenseSrc, path.join(targetDir, "STAT-LICENSE"));
    }
    return { ok: true, targetDir };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function readServerInfo(homePath) {
  const infoPath = path.join(homePath, "server-info.json");
  try {
    const raw = fsSync.readFileSync(infoPath, "utf8");
    const parsed = JSON.parse(raw);
    const port = Number(parsed?.port);
    const token = typeof parsed?.token === "string" ? parsed.token.trim() : "";
    if (Number.isInteger(port) && port > 0 && token) {
      return { port, token, baseUrl: `http://127.0.0.1:${port}` };
    }
  } catch {}
  return null;
}

async function installToOpenHanako(baseUrl, homePath, plugin, dryRun) {
  const sourcePath = path.join(homePath, "plugin-dev-sources", plugin.id);
  if (dryRun) {
    return { ok: true, skipped: true, sourcePath, baseUrl };
  }

  // 优先从 server-info.json 拿 token
  const serverInfo = readServerInfo(homePath);
  const headers = { "content-type": "application/json" };
  if (serverInfo) {
    headers["Authorization"] = `Bearer ${serverInfo.token}`;
    // 用 server-info.json 的端口覆盖默认 URL
    baseUrl = serverInfo.baseUrl;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(new URL("/api/plugins/dev/install", baseUrl), {
      method: "POST",
      headers,
      body: JSON.stringify({
        sourcePath,
        pluginId: plugin.id,
        allowFullAccess: plugin.trust === "full-access",
      }),
      signal: controller.signal,
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload?.error || `HTTP ${res.status}`);
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

async function appendChangelog(runLines, dryRun) {
  const changelogPath = path.join(WORKSPACE_ROOT, "CHANGELOG.md");
  if (!(await exists(changelogPath))) return;
  const current = await fs.readFile(changelogPath, "utf8");
  const date = new Date().toISOString().slice(0, 10);
  const runText = runLines.map((line) => `- ${date} [${line.pluginId}] ${line.message}`).join("\n");

  const body = current
    .replace(/^#\s*更新日志\s*\n+/i, "")
    .trimStart();
  const next = `# 更新日志\n\n${runText}${body ? `\n${body}` : ""}`;

  if (!dryRun) {
    await fs.writeFile(changelogPath, next, "utf8");
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(`用法：node scripts/sync-all.mjs [--test|--generate] [--publish] [--dry-run] [--skip-openhanako] [--skip-local-marketplace] [--skip-official] [plugin-id ...]\n\n说明：\n  --test                  测试打包，不增长版本号\n  --generate              生成发布包，必要时自动增长版本号并写入 OH-Plugins 插件条目\n  --publish               生成结束后自动提交、打 tag，并推送当前仓库和 OH-Plugins 仓库\n  --dry-run               只预览，不写文件\n  --skip-openhanako       跳过本机 OpenHanako dev 安装\n  --skip-local-marketplace 跳过本机市场文件更新\n  --skip-official         跳过 OH-Plugins 插件条目写入`);
    return;
  }

  if (!fsSync.existsSync(OH_PLUGINS_ROOT)) {
    throw new Error(`找不到 OH-Plugins 仓库：${OH_PLUGINS_ROOT}`);
  }

  const sharedLicense = await readSharedLicenseInfo();
  const plugins = await discoverWorkspacePlugins(options.pluginIds, sharedLicense);
  if (plugins.length === 0) {
    console.log("没有找到可同步的插件目录。");
    return;
  }

  const localHomes = resolveOpenHanakoHomes();
  const openHanakoUrls = resolveOpenHanakoBaseUrls();
  const changelogLines = [];
  const workspacePublishPaths = new Set();
  const officialPublishPaths = new Set();
  const publishedTags = [];
  const changelogPath = path.join(WORKSPACE_ROOT, "CHANGELOG.md");

  console.log(`发现 ${plugins.length} 个插件，开始同步。`);
  console.log(`工作区：${WORKSPACE_ROOT}`);
  console.log(`OH-Plugins：${OH_PLUGINS_ROOT}`);
  console.log(`共享许可证：${path.relative(WORKSPACE_ROOT, sharedLicense.filePath)}`);

  const publishOfficial = options.mode === "generate" && !options.skipOfficial;

  for (const plugin of plugins) {
    const officialEntryPath = selectEntryFile(path.join(OH_PLUGINS_ROOT, "plugins"), plugin.id);
    const officialEntry = await readJsonIfExists(officialEntryPath);
    const officialMtime = await fs.stat(officialEntryPath).then((stat) => stat.mtimeMs).catch(() => 0);
    const workspaceMtime = await latestMtimeMs(plugin.pluginDir);
    const publishedVersion = officialEntry?.version ? text(officialEntry.version) : null;
    const sourceIsNewer = !!officialEntry && workspaceMtime > officialMtime;

    if (options.mode === "generate" && officialEntry && !sourceIsNewer && publishedVersion && compareSemver(plugin.version, publishedVersion) <= 0) {
      console.log(`- [${plugin.id}] 工作区没有新的修改，且版本未领先官方，跳过。`);
      continue;
    }

    const fallbackHomePath = localHomes[0];

    let finalVersion = plugin.version;
    let versionChanged = false;

    if (options.mode === "generate" && publishedVersion && sourceIsNewer) {
      const comparison = compareSemver(plugin.version, publishedVersion);
      if (comparison === 0) {
        finalVersion = bumpPatch(plugin.version);
        versionChanged = true;
      } else if (comparison < 0) {
        finalVersion = bumpPatch(publishedVersion);
        versionChanged = true;
      }
    }

    if (versionChanged && !options.dryRun) {
      const previousVersion = plugin.version;
      plugin.version = finalVersion;
      plugin.manifest.version = finalVersion;
      if (plugin.packagePath) {
        plugin.packageJson.version = finalVersion;
      }
      await writeJson(plugin.manifestPath, plugin.manifest, false);
      if (plugin.packagePath) {
        await writeJson(plugin.packagePath, plugin.packageJson, false);
      }
      plugin.previousVersion = previousVersion;
      workspacePublishPaths.add(path.relative(WORKSPACE_ROOT, plugin.manifestPath));
      if (plugin.packagePath) {
        workspacePublishPaths.add(path.relative(WORKSPACE_ROOT, plugin.packagePath));
      }
    }

    const packageArtifact = await createPackageArtifact(plugin, sharedLicense, options.dryRun);
    let officialResult = null;
    try {
      if (publishOfficial) {
        officialResult = await writeOfficialPluginEntry(plugin, finalVersion, packageArtifact.packageResult, sharedLicense, options.dryRun);
      }

      if (!options.skipLocalMarketplace) {
        for (const homePath of localHomes) {
          const marketplacePath = await updateLocalMarketplace(homePath, [plugin], options.dryRun, sharedLicense);
          console.log(`- [${plugin.id}] 已更新本机市场：${marketplacePath}`);
        }
      }

      if (!options.skipOpenHanako) {
        let syncedToOpenHanako = false;
        for (const homePath of localHomes) {
          for (const baseUrl of openHanakoUrls) {
            const mirrorPath = path.join(homePath, "plugin-dev-sources", plugin.id);
            const installPayload = await installToOpenHanako(baseUrl, homePath, plugin, options.dryRun).catch((error) => ({ ok: false, error: error.message }));
            if (installPayload?.ok) {
              console.log(`- [${plugin.id}] 已同步到本机 OpenHanako：${installPayload.devRunId ? `devRunId=${installPayload.devRunId}` : mirrorPath}`);
              syncedToOpenHanako = true;
              break;
            }
          }
          if (syncedToOpenHanako) break;
        }
        if (!syncedToOpenHanako) {
          // API 安装失败，文件级兜底：直接复制到 plugins 目录
          const fallbackResult = await installToPluginsDir(fallbackHomePath, plugin, options.dryRun);
          if (fallbackResult.ok) {
            console.log(`- [${plugin.id}] 已通过文件复制安装到本机 OpenHanako：${fallbackResult.targetDir}`);
            syncedToOpenHanako = true;
          } else {
            console.log(`- [${plugin.id}] 本机 OpenHanako 未连接，文件复制也失败：${fallbackResult.error}`);
          }
        }
      }

      if (officialResult) {
        officialPublishPaths.add(path.relative(OH_PLUGINS_ROOT, officialResult.officialEntryPath));
        officialPublishPaths.add(path.relative(OH_PLUGINS_ROOT, path.join(OH_PLUGINS_ROOT, "marketplace.json")));
        publishedTags.push(officialResult.releaseTag);
        console.log(`- [${plugin.id}] 已写入 OH-Plugins 插件条目：${officialResult.officialEntryPath}`);
        console.log(`- [${plugin.id}] 已打包发布包：${packageArtifact.packageResult.file}`);
        console.log(`- [${plugin.id}] 版本标签：${officialResult.releaseTag}`);
      } else {
        console.log(`- [${plugin.id}] 已完成测试打包：${packageArtifact.packageResult.file}`);
      }

      changelogLines.push({
        pluginId: plugin.id,
        message: options.mode === "generate"
          ? (versionChanged
            ? `生成包完成，版本从 ${plugin.previousVersion || plugin.version} 自动递增到 ${finalVersion}`
            : `生成包完成，版本保持 ${finalVersion}`)
          : `测试包完成，版本保持 ${finalVersion}`,
      });
    } finally {
      await packageArtifact.cleanup();
    }
  }

  if (changelogLines.length > 0) {
    await appendChangelog(changelogLines, options.dryRun);
    console.log(`已记录中文更新日志：${changelogPath}`);
    if (!options.dryRun) {
      workspacePublishPaths.add(path.relative(WORKSPACE_ROOT, changelogPath));
    }
  }

  if (options.publish && !options.dryRun) {
    const pluginIdsText = plugins.map((plugin) => plugin.id).join(", ");
    const workspacePublishResult = await publishGitChanges({
      repoRoot: WORKSPACE_ROOT,
      paths: [...workspacePublishPaths],
      releaseTags: publishedTags,
      commitMessage: `chore(release): ${pluginIdsText}`,
      remote: "origin",
      push: true,
    });

    const officialPublishResult = await publishGitChanges({
      repoRoot: OH_PLUGINS_ROOT,
      paths: [...officialPublishPaths],
      commitMessage: `chore(marketplace): ${pluginIdsText}`,
      remote: "origin",
      push: true,
    });

    if (workspacePublishResult.committed || officialPublishResult.committed) {
      console.log("已自动提交并推送生成结果。");
    }
  }

  if (options.dryRun) {
    console.log("预览完成：没有写入任何文件。");
  } else {
    console.log("同步完成。");
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
