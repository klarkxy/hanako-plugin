import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

function frontMatterValue(text, key) {
  const match = text.match(new RegExp(`^${key}:\s*(.+)$`, "m"));
  return match ? match[1].trim() : null;
}

const manifest = JSON.parse(readText("manifest.json"));
assert(manifest.id === "roleplay", "manifest id should be roleplay");
assert(manifest.name === "roleplay", "manifest name should be roleplay");
assert(Array.isArray(manifest.keywords) && manifest.keywords.includes("roleplay"), "manifest keywords should include roleplay");
assert(Array.isArray(manifest.categories) && manifest.categories.includes("skills"), "manifest categories should include skills");

const packageJson = JSON.parse(readText("package.json"));
assert(packageJson.name === "roleplay", "package name should be roleplay");
assert(packageJson.scripts?.test === "node tests/smoke.mjs", "test script should point to smoke test");

const skillText = readText(path.join("skills", "roleplay", "SKILL.md"));
assert(frontMatterValue(skillText, "name") === "roleplay", "skill name should be roleplay");
assert(skillText.includes("开启扮演模式"), "skill should mention the activation phrase");
assert(skillText.includes("关闭扮演模式"), "skill should mention the exit phrase");
assert(skillText.includes("引导与续聊") || skillText.includes("续聊与引导"), "skill should mention guided continuation");
assert(skillText.includes("## 示例"), "skill should include an example section");
assert(skillText.includes("*动作*"), "skill should define the default action marker style");

const readmeText = readText("README.md");
assert(readmeText.includes("开启扮演模式"), "README should mention the activation phrase");
assert(readmeText.includes("续聊") || readmeText.includes("继续对话"), "README should describe continuing conversation");

console.log("roleplay smoke test passed");