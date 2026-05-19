import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = path.resolve(TEST_DIR, "..");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readText(relativePath) {
  return fs.readFileSync(path.join(PLUGIN_DIR, relativePath), "utf8");
}

const manifest = JSON.parse(readText("manifest.json"));
assert(manifest.id === "local-provider", "manifest id should be local-provider");
assert(manifest.trust === "full-access", "manifest trust should be full-access");
assert(Array.isArray(manifest.categories) && manifest.categories.includes("providers"), "manifest categories should include providers");

const packageJson = JSON.parse(readText("package.json"));
assert(packageJson.name === "local-provider", "package name should be local-provider");
assert(packageJson.scripts?.test === "node tests/smoke.mjs", "test script should point to smoke test");

const providerModule = await import(pathToFileURL(path.join(PLUGIN_DIR, "providers", "local-provider.js")).href);
assert(providerModule.id === "local-provider", "provider id should be local-provider");
assert(providerModule.authType === "none", "provider authType should be none");
assert(providerModule.defaultBaseUrl === "http://127.0.0.1:1234/v1", "provider default base url should target LM Studio");
assert(providerModule.capabilities?.media?.imageGeneration?.models?.length === 1, "provider should expose image capability");
assert(providerModule.capabilities?.media?.videoGeneration?.models?.length === 1, "provider should expose video capability");
assert(providerModule.capabilities?.media?.speechGeneration?.models?.length === 2, "provider should expose speech capability placeholders");

const runtimeSpec = await import(pathToFileURL(path.join(PLUGIN_DIR, "lib", "runtime-spec.js")).href);
const normalized = runtimeSpec.normalizeRuntimeSpec({
  executable: "python",
  args: [
    { literal: "tool.py" },
    { option: "--prompt", from: "prompt" },
    { option: "--output", from: "outputDir" },
  ],
  timeoutMs: 1000,
  output: { kind: "file_glob", pattern: "*.png" },
});
assert(normalized.output.kind === "file_glob", "runtime spec should normalize file_glob output");

const statusTool = await import(pathToFileURL(path.join(PLUGIN_DIR, "tools", "status.js")).href);
assert(statusTool.name === "status", "status tool should export the expected name");

const configureTool = await import(pathToFileURL(path.join(PLUGIN_DIR, "tools", "configure-runtime.js")).href);
assert(configureTool.name === "configure-runtime", "configure-runtime tool should export the expected name");

const generateVideoTool = await import(pathToFileURL(path.join(PLUGIN_DIR, "tools", "generate-video.js")).href);
assert(generateVideoTool.name === "generate-video", "generate-video tool should export the expected name");

const skillText = readText(path.join("skills", "local-provider", "SKILL.md"));
assert(skillText.includes("local-provider_status"), "skill should mention the status tool");
assert(skillText.includes("LM Studio"), "skill should mention LM Studio");

console.log("local-provider smoke test passed");