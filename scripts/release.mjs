#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_OUT_DIR = path.join(REPO_DIR, "dist", "releases");
const LOCAL_RELEASE_CONFIG = loadLocalReleaseConfig();

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || "plan";

  if (args.help || command === "help") {
    printHelp();
    return;
  }

  const gitState = loadGitState();
  const plugins = loadPlugins(args.plugin);
  const plans = plugins.map((plugin) => buildReleasePlan(plugin, gitState));

  if (["plan", "check", "smoke", "pack", "publish", "sync"].includes(command) === false) {
    throw new Error(`Unknown command: ${command}`);
  }

  if (command === "plan") {
    printPlans(plans, gitState);
    return;
  }

  await validatePlans(plans, {
    smoke: args.smoke || command === "smoke" || command === "publish",
  });

  if (command === "check" || command === "smoke") {
    printCheckSummary(plans);
    return;
  }

  if (command === "sync") {
    await syncLocalMarketplaceIfConfigured(plans, gitState, LOCAL_RELEASE_CONFIG);
    return;
  }

  const packaged = packagePendingPlans(plans, {
    outDir: args.outDir || DEFAULT_OUT_DIR,
    repoInfo: gitState.repoInfo,
    remoteUrl: gitState.remoteUrl,
  });

  if (command === "pack") {
    printPackageSummary(packaged);
    return;
  }

  assertPublishReady(gitState, args);
  await publishPackages(packaged, gitState, LOCAL_RELEASE_CONFIG);
  printPublishSummary(packaged);
}

function parseArgs(argv) {
  const result = {
    _: [],
    plugin: [],
    smoke: false,
    help: false,
    allowDirty: false,
    outDir: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--plugin") {
      result.plugin.push(requireValue(argv, ++index, "--plugin"));
      continue;
    }
    if (arg === "--out-dir") {
      result.outDir = path.resolve(REPO_DIR, requireValue(argv, ++index, "--out-dir"));
      continue;
    }
    if (arg === "--smoke") {
      result.smoke = true;
      continue;
    }
    if (arg === "--allow-dirty") {
      result.allowDirty = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      result.help = true;
      continue;
    }
    result._.push(arg);
  }

  return result;
}

function requireValue(argv, index, flagName) {
  const value = argv[index];
  if (!value) {
    throw new Error(`${flagName} requires a value`);
  }
  return value;
}

function printHelp() {
  console.log([
    "Usage:",
    "  node scripts/release.mjs plan [--plugin <id>]",
    "  node scripts/release.mjs check [--plugin <id>] [--smoke]",
    "  node scripts/release.mjs smoke [--plugin <id>]",
    "  node scripts/release.mjs sync [--plugin <id>] [--smoke]",
    "  node scripts/release.mjs pack [--plugin <id>] [--smoke] [--out-dir <path>]",
    "  node scripts/release.mjs publish [--plugin <id>] [--out-dir <path>] [--allow-dirty]",
    "",
    "Conventions:",
    "  - A published plugin version is tracked by the git tag <pluginId>-v<version>.",
    "  - Incremental packaging and publishing only process plugin versions whose tags do not exist yet.",
    "  - sync updates the local OpenHanako marketplace file at ~/.hanako/plugin-marketplace/marketplace.json by default.",
    "  - publish remains available for GitHub Release workflows, but is optional.",
  ].join("\n"));
}

function loadPlugins(filterIds) {
  const wanted = new Set(filterIds || []);
  const plugins = fs.readdirSync(REPO_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => path.join(REPO_DIR, entry.name))
    .filter((pluginDir) => fs.existsSync(path.join(pluginDir, "manifest.json")))
    .map(readPlugin)
    .filter((plugin) => wanted.size === 0 || wanted.has(plugin.id));

  if (plugins.length === 0) {
    throw new Error(wanted.size > 0 ? `No plugins matched: ${[...wanted].join(", ")}` : "No plugin folders found");
  }

  return plugins.sort((left, right) => left.id.localeCompare(right.id));
}

function readPlugin(pluginDir) {
  const manifestPath = path.join(pluginDir, "manifest.json");
  const packagePath = path.join(pluginDir, "package.json");
  const manifest = readJson(manifestPath);
  const packageJson = readJson(packagePath);
  return {
    dir: pluginDir,
    relDir: toPosix(path.relative(REPO_DIR, pluginDir)),
    folderName: path.basename(pluginDir),
    manifestPath,
    packagePath,
    manifest,
    packageJson,
    id: manifest.id || path.basename(pluginDir),
    name: manifest.name || manifest.id || path.basename(pluginDir),
    version: manifest.version || packageJson.version || "0.0.0",
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadLocalReleaseConfig() {
  const configPath = resolveLocalReleaseConfigPath();
  if (!configPath || !fs.existsSync(configPath)) {
    return {};
  }

  try {
    const text = fs.readFileSync(configPath, "utf8");
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Unable to read local release config at ${configPath}: ${error.message}`);
  }
}

function resolveLocalReleaseConfigPath() {
  if (typeof process.env.HANAKO_RELEASE_CONFIG === "string" && process.env.HANAKO_RELEASE_CONFIG.trim()) {
    return path.resolve(process.env.HANAKO_RELEASE_CONFIG.trim());
  }

  const candidates = [
    path.join(os.homedir(), ".config", "hanako-plugin", "release.json"),
    path.join(os.homedir(), ".hanako-plugin", "release.json"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function loadGitState() {
  const localTags = parseLines(runGit(["tag", "--list"]).stdout);
  const remoteUrl = runGit(["remote", "get-url", "origin"], { allowFailure: true }).stdout.trim();
  const remoteTagResult = runGit(["ls-remote", "--tags", "origin"], { allowFailure: true, timeout: 20000 });
  const remoteTags = remoteTagResult.ok ? parseRemoteTags(remoteTagResult.stdout) : [];
  const repoInfo = parseGitHubRepo(remoteUrl);
  const statusLines = parseLines(runGit(["status", "--porcelain"]).stdout);

  return {
    head: runGit(["rev-parse", "HEAD"]).stdout.trim(),
    remoteUrl,
    repoInfo,
    tags: new Set([...localTags, ...remoteTags]),
    remoteTagsAvailable: remoteTagResult.ok,
    repoDirty: statusLines.length > 0,
    repoDirtyFiles: parseStatusLines(statusLines),
  };
}

function buildReleasePlan(plugin, gitState) {
  const currentTag = `${plugin.id}-v${plugin.version}`;
  const releaseTags = [...gitState.tags]
    .map((tag) => parseReleaseTag(tag, plugin.id))
    .filter(Boolean)
    .sort((left, right) => compareSemver(right.version, left.version));

  const latestRelease = releaseTags[0] || null;
  const diffFiles = latestRelease ? gitDiffFiles(latestRelease.tag, plugin.relDir) : [];
  const workingTreeFiles = gitStatusFiles(plugin.relDir);
  const publishedCurrent = gitState.tags.has(currentTag);
  const issues = [];
  const warnings = [];
  const versionCompare = latestRelease ? compareSemver(plugin.version, latestRelease.version) : 1;

  if (!gitState.remoteTagsAvailable) {
    warnings.push("Remote tags are unavailable; incremental release detection fell back to local tags only.");
  }
  if (plugin.folderName !== plugin.id) {
    issues.push(`Plugin folder name must match manifest id: expected ${plugin.id}, got ${plugin.folderName}.`);
  }
  if ((plugin.packageJson.name || "") !== plugin.id) {
    issues.push(`package.json name must match plugin id: expected ${plugin.id}, got ${plugin.packageJson.name || "(empty)"}.`);
  }
  if ((plugin.packageJson.version || "") !== plugin.version) {
    issues.push(`manifest.json and package.json versions must match: ${plugin.version} vs ${plugin.packageJson.version || "(empty)"}.`);
  }
  if (latestRelease && versionCompare < 0) {
    issues.push(`Current version ${plugin.version} is lower than released version ${latestRelease.version}.`);
  }
  if (publishedCurrent && workingTreeFiles.length > 0) {
    issues.push(`Version ${plugin.version} is already released. Bump the version before publishing new changes.`);
  }
  if (latestRelease && versionCompare === 0 && !publishedCurrent && diffFiles.length > 0) {
    issues.push(`Plugin changed since ${latestRelease.tag} but version stayed at ${plugin.version}. Bump the version first.`);
  }

  return {
    plugin,
    currentTag,
    latestRelease,
    publishedCurrent,
    diffFiles,
    workingTreeFiles,
    issues,
    warnings,
    pending: !publishedCurrent && issues.length === 0,
    packaged: null,
  };
}

async function validatePlans(plans, options = {}) {
  for (const plan of plans) {
    validateReadmes(plan);
    validateJavaScript(plan);
    if ((options.smoke === true) && fs.existsSync(path.join(plan.plugin.dir, "tests", "smoke.mjs"))) {
      await runSmokeTest(plan);
    }
  }

  const failingPlans = plans.filter((plan) => plan.issues.length > 0);
  if (failingPlans.length > 0) {
    printCheckSummary(plans);
    throw new Error(`Validation failed for ${failingPlans.map((plan) => plan.plugin.id).join(", ")}`);
  }
}

function validateReadmes(plan) {
  const chineseReadme = path.join(plan.plugin.dir, "README.md");
  const englishReadme = path.join(plan.plugin.dir, "README_EN.md");
  if (!fs.existsSync(chineseReadme)) {
    plan.issues.push("README.md is required.");
  }
  if (!fs.existsSync(englishReadme)) {
    plan.issues.push("README_EN.md is required for the bilingual doc layout.");
  }
}

function validateJavaScript(plan) {
  const files = listScriptFiles(plan.plugin.dir);
  for (const filePath of files) {
    const result = spawnSync(process.execPath, ["--check", filePath], {
      cwd: REPO_DIR,
      encoding: "utf8",
    });
    if (result.status !== 0) {
      plan.issues.push(`Syntax check failed: ${toPosix(path.relative(REPO_DIR, filePath))}\n${spawnOutput(result)}`);
      return;
    }
  }
}

async function runSmokeTest(plan) {
  const smokeFile = path.join(plan.plugin.dir, "tests", "smoke.mjs");
  const result = spawnSync(process.execPath, [smokeFile], {
    cwd: plan.plugin.dir,
    encoding: "utf8",
    env: process.env,
  });
  if (result.status !== 0) {
    plan.issues.push(`Smoke test failed for ${plan.plugin.id}.\n${spawnOutput(result)}`);
    return;
  }
  const lastLine = parseLines(result.stdout).slice(-1)[0] || "smoke test passed";
  plan.warnings.push(`Smoke test passed: ${lastLine}`);
}

function packagePendingPlans(plans, options = {}) {
  const pendingPlans = plans.filter((plan) => plan.pending);
  if (pendingPlans.length === 0) {
    console.log("No unreleased plugin versions to package.");
    return [];
  }

  const packaged = [];
  for (const plan of pendingPlans) {
    const pluginOutDir = path.join(options.outDir, plan.plugin.id);
    fs.mkdirSync(pluginOutDir, { recursive: true });

    const assetName = `${plan.plugin.id}-v${plan.plugin.version}.zip`;
    const assetPath = path.join(pluginOutDir, assetName);
    createZipArchive(plan.plugin.dir, assetPath);

    const sha256 = sha256File(assetPath);
    const releaseInfo = buildReleaseInfo(plan, {
      assetName,
      assetPath,
      sha256,
      repoInfo: options.repoInfo,
      remoteUrl: options.remoteUrl,
    });
    const releaseInfoPath = path.join(pluginOutDir, `${plan.plugin.id}-v${plan.plugin.version}.release.json`);

    fs.writeFileSync(releaseInfoPath, `${JSON.stringify(releaseInfo, null, 2)}\n`, "utf8");

    plan.packaged = {
      assetName,
      assetPath,
      sha256,
      releaseInfo,
      releaseInfoPath,
    };
    packaged.push(plan);
  }

  return packaged;
}

function buildReleaseInfo(plan, options) {
  const packageUrl = options.repoInfo
    ? `https://github.com/${options.repoInfo.owner}/${options.repoInfo.repo}/releases/download/${plan.currentTag}/${options.assetName}`
    : null;
  const releaseUrl = options.repoInfo
    ? `https://github.com/${options.repoInfo.owner}/${options.repoInfo.repo}/releases/tag/${plan.currentTag}`
    : null;

  return {
    pluginId: plan.plugin.id,
    name: plan.plugin.name,
    version: plan.plugin.version,
    tag: plan.currentTag,
    repository: options.remoteUrl || null,
    archivePath: toPosix(path.relative(REPO_DIR, options.assetPath)),
    assetName: options.assetName,
    sha256: options.sha256,
    packageUrl,
    releaseUrl,
    notes: [
      "This file is generated by scripts/release.mjs.",
      "Publishing the GitHub Release does not update the official OH-Plugins marketplace automatically.",
      "After publishing, update the OH-Plugins entry manually with the new version, package URL, and sha256.",
    ],
  };
}

function getGithubToken(releaseConfig = LOCAL_RELEASE_CONFIG) {
  return process.env.GITHUB_TOKEN
    || process.env.GH_TOKEN
    || releaseConfig.githubToken
    || releaseConfig.token
    || "";
}

function assertPublishReady(gitState, args, releaseConfig = LOCAL_RELEASE_CONFIG) {
  const token = getGithubToken(releaseConfig);
  if (!gitState.repoInfo) {
    throw new Error("Publish requires a GitHub origin remote.");
  }
  if (!token) {
    throw new Error("Publish requires GITHUB_TOKEN or GH_TOKEN, or a local release config with githubToken.");
  }
  if (gitState.repoDirty && args.allowDirty !== true) {
    throw new Error("Working tree is not clean. Commit or stash changes, or rerun with --allow-dirty.");
  }
}

async function publishPackages(packagedPlans, gitState, releaseConfig = LOCAL_RELEASE_CONFIG) {
  if (packagedPlans.length === 0) {
    console.log("No unreleased plugin versions to publish.");
    return;
  }

  const token = getGithubToken(releaseConfig);
  for (const plan of packagedPlans) {
    const release = await createOrUpdateRelease({
      repoInfo: gitState.repoInfo,
      token,
      tag: plan.currentTag,
      targetCommitish: gitState.head,
      name: `${plan.plugin.name} v${plan.plugin.version}`,
      body: buildReleaseBody(plan),
    });
    await uploadReleaseAsset({
      repoInfo: gitState.repoInfo,
      token,
      release,
      assetName: plan.packaged.assetName,
      assetPath: plan.packaged.assetPath,
    });
  }

  await syncMarketplaceIfConfigured(packagedPlans, gitState, releaseConfig);
}

function buildReleaseBody(plan) {
  return [
    `${plan.plugin.name} v${plan.plugin.version}`,
    "",
    `Plugin ID: ${plan.plugin.id}`,
    `SHA256: ${plan.packaged.sha256}`,
    "",
    "Generated by scripts/release.mjs.",
  ].join("\n");
}

async function createOrUpdateRelease({ repoInfo, token, tag, targetCommitish, name, body }) {
  const existing = await githubRequest({
    token,
    pathName: `/repos/${repoInfo.owner}/${repoInfo.repo}/releases/tags/${encodeURIComponent(tag)}`,
    allowNotFound: true,
  });

  if (existing.status === 404) {
    return githubRequest({
      token,
      pathName: `/repos/${repoInfo.owner}/${repoInfo.repo}/releases`,
      method: "POST",
      body: {
        tag_name: tag,
        target_commitish: targetCommitish,
        name,
        body,
        draft: false,
        prerelease: false,
      },
    });
  }

  return githubRequest({
    token,
    pathName: `/repos/${repoInfo.owner}/${repoInfo.repo}/releases/${existing.id}`,
    method: "PATCH",
    body: { name, body, draft: false, prerelease: false },
  });
}

async function uploadReleaseAsset({ repoInfo, token, release, assetName, assetPath }) {
  const existingAsset = Array.isArray(release.assets)
    ? release.assets.find((asset) => asset?.name === assetName)
    : null;

  if (existingAsset?.id) {
    await githubRequest({
      token,
      pathName: `/repos/${repoInfo.owner}/${repoInfo.repo}/releases/assets/${existingAsset.id}`,
      method: "DELETE",
      expectJson: false,
    });
  }

  const uploadUrl = String(release.upload_url || "").replace(/\{.*$/, "");
  const archive = fs.readFileSync(assetPath);
  const response = await fetch(`${uploadUrl}?name=${encodeURIComponent(assetName)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "hanako-plugin-release-script",
      "Content-Type": "application/zip",
      "Content-Length": String(archive.length),
    },
    body: archive,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub asset upload failed: ${response.status} ${response.statusText} ${text}`.trim());
  }
}

async function githubRequest({ token, pathName, method = "GET", body, allowNotFound = false, expectJson = true }) {
  const response = await fetch(`https://api.github.com${pathName}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "hanako-plugin-release-script",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (allowNotFound && response.status === 404) {
    return { status: 404 };
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API failed: ${response.status} ${response.statusText} ${text}`.trim());
  }

  if (!expectJson || response.status === 204) {
    return {};
  }
  return response.json();
}

async function syncMarketplaceIfConfigured(packagedPlans, gitState, releaseConfig = LOCAL_RELEASE_CONFIG) {
  const marketplaceConfig = normalizeMarketplaceConfig(releaseConfig);
  if (!marketplaceConfig?.dir || marketplaceConfig.syncOnPublish === false) {
    return;
  }

  const pluginsDir = path.join(marketplaceConfig.dir, "plugins");
  fs.mkdirSync(pluginsDir, { recursive: true });

  for (const plan of packagedPlans) {
    const entry = buildMarketplaceEntry(plan, gitState, marketplaceConfig);
    const entryPath = path.join(pluginsDir, `${plan.plugin.id}.json`);
    removeConflictingMarketplaceEntries(pluginsDir, plan.plugin.id, entryPath);
    fs.writeFileSync(entryPath, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
  }

  const buildResult = spawnSync("npm", ["run", "build:index"], {
    cwd: marketplaceConfig.dir,
    encoding: "utf8",
    env: process.env,
  });
  if (buildResult.status !== 0) {
    throw new Error(`OH-Plugins build:index failed: ${spawnOutput(buildResult)}`);
  }

  const checkResult = spawnSync("npm", ["run", "check"], {
    cwd: marketplaceConfig.dir,
    encoding: "utf8",
    env: process.env,
  });
  if (checkResult.status !== 0) {
    throw new Error(`OH-Plugins check failed: ${spawnOutput(checkResult)}`);
  }

  for (const plan of packagedPlans) {
    console.log(`Synced OH-Plugins entry for ${plan.plugin.id} into ${path.resolve(marketplaceConfig.dir)}`);
  }
}

async function syncLocalMarketplaceIfConfigured(plans, gitState, releaseConfig = LOCAL_RELEASE_CONFIG) {
  const pendingPlans = plans.filter((plan) => plan.pending);
  if (pendingPlans.length === 0) {
    console.log("No unreleased plugin versions to sync.");
    return;
  }

  const marketplaceConfig = normalizeMarketplaceConfig(releaseConfig);
  const indexPath = resolveLocalMarketplaceFilePath(releaseConfig);
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  const marketplaceIndex = loadMarketplaceIndex(indexPath);

  for (const plan of pendingPlans) {
    const entry = buildLocalMarketplaceEntry(plan, gitState, marketplaceConfig);
    validateLocalMarketplaceEntry(entry);
    marketplaceIndex.plugins = marketplaceIndex.plugins.filter((plugin) => plugin.id !== plan.plugin.id);
    marketplaceIndex.plugins.push(entry);
    console.log(`Synced ${plan.plugin.id} ${plan.plugin.version} into ${indexPath}`);
  }

  marketplaceIndex.plugins.sort((left, right) => left.name.localeCompare(right.name));
  fs.writeFileSync(indexPath, `${JSON.stringify(marketplaceIndex, null, 2)}\n`, "utf8");

  console.log(`Local marketplace sync complete: ${indexPath}`);
}

function normalizeMarketplaceConfig(releaseConfig = LOCAL_RELEASE_CONFIG) {
  const marketplace = releaseConfig.marketplace || {};
  const dir = typeof marketplace.dir === "string" && marketplace.dir.trim()
    ? path.resolve(marketplace.dir.trim())
    : typeof process.env.OH_PLUGINS_DIR === "string" && process.env.OH_PLUGINS_DIR.trim()
      ? path.resolve(process.env.OH_PLUGINS_DIR.trim())
      : "";

  const repoInfo = parseGitHubRepo(readRemoteUrl(REPO_DIR));
  const inferredMinAppVersion = inferMinAppVersion();

  return {
    dir,
    filePath: resolveLocalMarketplaceFilePath(releaseConfig),
    publisher: stringOr(marketplace.publisher) || (repoInfo?.owner || stringOr(process.env.OH_PLUGINS_PUBLISHER) || "Hanako"),
    minAppVersion: stringOr(marketplace.minAppVersion) || stringOr(process.env.OH_PLUGINS_MIN_APP_VERSION) || inferredMinAppVersion,
    trust: stringOr(marketplace.trust),
    permissions: Array.isArray(marketplace.permissions) ? marketplace.permissions : [],
    contributions: Array.isArray(marketplace.contributions) && marketplace.contributions.length > 0
      ? marketplace.contributions
      : [],
    readmeUrl: stringOr(marketplace.readmeUrl),
    syncOnPublish: marketplace.syncOnPublish !== false,
  };
}

function resolveLocalMarketplaceFilePath(releaseConfig = LOCAL_RELEASE_CONFIG) {
  const marketplace = releaseConfig.marketplace || {};
  const configuredFile = stringOr(marketplace.file);
  if (configuredFile) {
    return path.resolve(configuredFile);
  }

  const envFile = stringOr(process.env.HANA_PLUGIN_MARKETPLACE_FILE);
  if (envFile) {
    return path.resolve(envFile);
  }

  const hanakoHome = resolveHanakoHome();
  return path.join(hanakoHome, "plugin-marketplace", "marketplace.json");
}

function resolveHanakoHome() {
  const envHome = stringOr(process.env.HANA_HOME);
  if (envHome) {
    return path.resolve(envHome);
  }

  return path.join(os.homedir(), ".hanako");
}

function buildMarketplaceEntry(plan, gitState, marketplaceConfig) {
  const trust = stringOr(marketplaceConfig.trust) || inferTrust(plan.plugin.dir);
  const contributions = marketplaceConfig.contributions.length > 0
    ? marketplaceConfig.contributions
    : inferContributions(plan.plugin.dir);
  const readmeUrl = stringOr(marketplaceConfig.readmeUrl) || defaultReadmeUrl(parseGitHubRepo(gitState.remoteUrl), plan.plugin.relDir);

  return {
    schemaVersion: 1,
    id: plan.plugin.id,
    name: plan.plugin.name,
    publisher: marketplaceConfig.publisher,
    version: plan.plugin.version,
    description: plan.plugin.manifest.description || plan.plugin.packageJson.description || plan.plugin.name,
    repository: gitState.remoteUrl || gitState.repoInfo?.repository || null,
    compatibility: { minAppVersion: marketplaceConfig.minAppVersion },
    trust,
    permissions: marketplaceConfig.permissions,
    contributions,
    distribution: {
      kind: "release",
      packageUrl: plan.packaged.releaseInfo.packageUrl,
      sha256: plan.packaged.sha256,
    },
    readmeUrl,
  };
}

function buildLocalMarketplaceEntry(plan, gitState, marketplaceConfig) {
  return {
    schemaVersion: 1,
    id: plan.plugin.id,
    name: plan.plugin.name,
    publisher: marketplaceConfig.publisher,
    version: plan.plugin.version,
    description: plan.plugin.manifest.description || plan.plugin.packageJson.description || plan.plugin.name,
    repository: gitState.remoteUrl || gitState.repoInfo?.repository || null,
    compatibility: { minAppVersion: marketplaceConfig.minAppVersion },
    trust: stringOr(marketplaceConfig.trust) || inferTrust(plan.plugin.dir),
    permissions: marketplaceConfig.permissions,
    contributions: marketplaceConfig.contributions.length > 0
      ? marketplaceConfig.contributions
      : inferContributions(plan.plugin.dir),
    distribution: {
      kind: "source",
      path: plan.plugin.dir,
    },
    readmePath: path.join(plan.plugin.dir, "README.md"),
  };
}

function loadMarketplaceIndex(indexPath) {
  if (!fs.existsSync(indexPath)) {
    return { schemaVersion: 1, plugins: [] };
  }

  const raw = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const plugins = Array.isArray(raw?.plugins) ? raw.plugins : [];
  return {
    schemaVersion: raw?.schemaVersion || 1,
    plugins: plugins.filter((plugin) => plugin && typeof plugin === "object"),
  };
}

function validateLocalMarketplaceEntry(entry) {
  if (!fs.existsSync(entry.distribution.path)) {
    throw new Error(`Local plugin source path does not exist: ${entry.distribution.path}`);
  }
  if (!fs.existsSync(entry.readmePath)) {
    throw new Error(`Local plugin README does not exist: ${entry.readmePath}`);
  }
}

function removeConflictingMarketplaceEntries(pluginsDir, pluginId, preferredPath) {
  for (const extension of ["json", "yaml", "yml"]) {
    const filePath = path.join(pluginsDir, `${pluginId}.${extension}`);
    if (filePath !== preferredPath && fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  }
}

function defaultReadmeUrl(repoInfo, pluginRelDir = "") {
  if (!repoInfo) return null;
  const readmePath = pluginRelDir ? `${pluginRelDir}/README.md` : "README.md";
  return `https://raw.githubusercontent.com/${repoInfo.owner}/${repoInfo.repo}/main/${readmePath}`;
}

function inferContributions(baseDir) {
  const contributions = [];
  for (const item of ["tools", "skills", "commands", "agents", "routes", "providers", "ui"]) {
    if (fs.existsSync(path.join(baseDir, item))) {
      contributions.push(item);
    }
  }
  if (fs.existsSync(path.join(baseDir, "index.js")) && !contributions.includes("runtime")) {
    contributions.push("runtime");
  }
  return contributions.length > 0 ? contributions : ["tools"];
}

function inferTrust(baseDir) {
  if (fs.existsSync(path.join(baseDir, "index.js"))
    || fs.existsSync(path.join(baseDir, "routes"))
    || fs.existsSync(path.join(baseDir, "ui"))
    || fs.existsSync(path.join(baseDir, "providers"))) {
    return "full-access";
  }
  return "restricted";
}

function inferMinAppVersion() {
  const siblings = [
    path.resolve(REPO_DIR, "..", "openhanako", "package.json"),
    path.resolve(REPO_DIR, "..", "project-hana", "package.json"),
  ];
  for (const candidate of siblings) {
    if (!fs.existsSync(candidate)) continue;
    try {
      const pkg = JSON.parse(fs.readFileSync(candidate, "utf8"));
      if (typeof pkg.version === "string" && pkg.version.trim()) {
        return pkg.version.trim();
      }
    } catch {
      // Ignore and fall back.
    }
  }
  return "0.0.0";
}

function readRemoteUrl(cwd) {
  const result = runGit(["remote", "get-url", "origin"], { allowFailure: true });
  return String(result.stdout || "").trim();
}

function stringOr(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function spawnOutput(result) {
  return [result?.error?.message, result?.stderr, result?.stdout]
    .filter((item) => typeof item === "string" && item.length > 0)
    .join("\n")
    .trim();
}

function printPlans(plans, gitState) {
  for (const plan of plans) {
    const status = plan.pending ? "pending" : plan.publishedCurrent ? "released" : "blocked";
    console.log(`${plan.plugin.id} ${plan.plugin.version} [${status}]`);
    console.log(`  tag: ${plan.currentTag}`);
    console.log(`  path: ${plan.plugin.relDir}`);
    if (plan.latestRelease) {
      console.log(`  latest release: ${plan.latestRelease.tag}`);
    }
    if (plan.diffFiles.length > 0) {
      console.log(`  changed since last release: ${plan.diffFiles.join(", ")}`);
    }
    if (plan.workingTreeFiles.length > 0) {
      console.log(`  working tree changes: ${plan.workingTreeFiles.join(", ")}`);
    }
    for (const warning of plan.warnings) {
      console.log(`  warning: ${warning}`);
    }
    for (const issue of plan.issues) {
      console.log(`  issue: ${issue}`);
    }
  }

  if (gitState.repoDirty) {
    console.log(`repo working tree changes: ${gitState.repoDirtyFiles.join(", ")}`);
  }
}

function printCheckSummary(plans) {
  for (const plan of plans) {
    const status = plan.issues.length === 0 ? "ok" : "failed";
    console.log(`${plan.plugin.id} ${plan.plugin.version} [${status}]`);
    for (const warning of plan.warnings) {
      console.log(`  warning: ${warning}`);
    }
    for (const issue of plan.issues) {
      console.log(`  issue: ${issue}`);
    }
  }
}

function printPackageSummary(packagedPlans) {
  for (const plan of packagedPlans) {
    console.log(`${plan.plugin.id} ${plan.plugin.version}`);
    console.log(`  asset: ${toPosix(path.relative(REPO_DIR, plan.packaged.assetPath))}`);
    console.log(`  sha256: ${plan.packaged.sha256}`);
    console.log(`  metadata: ${toPosix(path.relative(REPO_DIR, plan.packaged.releaseInfoPath))}`);
  }
}

function printPublishSummary(packagedPlans) {
  for (const plan of packagedPlans) {
    console.log(`${plan.plugin.id} ${plan.plugin.version} published`);
    if (plan.packaged.releaseInfo.releaseUrl) {
      console.log(`  release: ${plan.packaged.releaseInfo.releaseUrl}`);
    }
    if (plan.packaged.releaseInfo.packageUrl) {
      console.log(`  asset: ${plan.packaged.releaseInfo.packageUrl}`);
    }
  }
}

function createZipArchive(sourceDir, destinationZip) {
  fs.rmSync(destinationZip, { force: true });
  if (process.platform === "win32") {
    const command = [
      "$ErrorActionPreference = 'Stop'",
      "Add-Type -AssemblyName 'System.IO.Compression.FileSystem'",
      `$sourceDir = '${escapePowerShell(sourceDir)}'`,
      `$destinationZip = '${escapePowerShell(destinationZip)}'`,
      "[System.IO.Compression.ZipFile]::CreateFromDirectory($sourceDir, $destinationZip, [System.IO.Compression.CompressionLevel]::Optimal, $false)",
    ].join("; ");
    const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", command], {
      cwd: REPO_DIR,
      encoding: "utf8",
    });
    if (result.status !== 0) {
      throw new Error(`Zip creation failed: ${spawnOutput(result)}`);
    }
    return;
  }

  const result = spawnSync("zip", ["-r", "-q", destinationZip, path.basename(sourceDir)], {
    cwd: path.dirname(sourceDir),
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`Zip creation failed: ${spawnOutput(result)}`);
  }
}

function escapePowerShell(text) {
  return String(text).replace(/'/g, "''");
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function gitDiffFiles(tag, relDir) {
  const result = runGit(["diff", "--name-only", `${tag}..HEAD`, "--", relDir], { allowFailure: true });
  return parseLines(result.stdout).map(normalizeGitPath);
}

function gitStatusFiles(relDir) {
  const result = runGit(["status", "--porcelain", "--", relDir], { allowFailure: true });
  return parseStatusLines(parseLines(result.stdout));
}

function parseStatusLines(lines) {
  return lines
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
    .map(normalizeGitPath);
}

function normalizeGitPath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function parseReleaseTag(tag, pluginId) {
  const match = new RegExp(`^${escapeRegExp(pluginId)}-v(.+)$`).exec(tag);
  if (!match) return null;
  return { tag, version: match[1] };
}

function parseRemoteTags(stdout) {
  return parseLines(stdout)
    .map((line) => line.split(/\s+/)[1] || "")
    .filter(Boolean)
    .map((ref) => ref.replace(/^refs\/tags\//, ""))
    .map((ref) => ref.replace(/\^\{\}$/, ""))
    .filter(Boolean);
}

function listScriptFiles(dirPath) {
  const files = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) {
      continue;
    }
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listScriptFiles(fullPath));
      continue;
    }
    if (fullPath.endsWith(".js") || fullPath.endsWith(".mjs")) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function compareSemver(left, right) {
  const a = parseSemver(left);
  const b = parseSemver(right);
  for (const key of ["major", "minor", "patch"]) {
    if (a[key] !== b[key]) {
      return a[key] - b[key];
    }
  }
  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0;
  if (a.prerelease.length === 0) return 1;
  if (b.prerelease.length === 0) return -1;
  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const aPart = a.prerelease[index];
    const bPart = b.prerelease[index];
    if (aPart === undefined) return -1;
    if (bPart === undefined) return 1;
    const aNumber = /^\d+$/.test(aPart) ? Number(aPart) : NaN;
    const bNumber = /^\d+$/.test(bPart) ? Number(bPart) : NaN;
    if (!Number.isNaN(aNumber) && !Number.isNaN(bNumber) && aNumber !== bNumber) {
      return aNumber - bNumber;
    }
    if (String(aPart) !== String(bPart)) {
      return String(aPart).localeCompare(String(bPart));
    }
  }
  return 0;
}

function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(version).trim());
  if (!match) {
    throw new Error(`Unsupported semver: ${version}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split(".") : [],
  };
}

function parseGitHubRepo(remoteUrl) {
  if (!remoteUrl) return null;
  const httpsMatch = /^https:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/i.exec(remoteUrl);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }
  const sshMatch = /^git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?$/i.exec(remoteUrl);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }
  return null;
}

function runGit(args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: REPO_DIR,
    encoding: "utf8",
    timeout: options.timeout || 15000,
  });

  const ok = result.status === 0;
  if (!ok && !options.allowFailure) {
    throw new Error(`git ${args.join(" ")} failed: ${spawnOutput(result)}`);
  }

  return {
    ok,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function parseLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toPosix(filePath) {
  return filePath.replaceAll("\\", "/");
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});