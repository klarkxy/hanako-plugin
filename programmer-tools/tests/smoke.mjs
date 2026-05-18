import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = path.resolve(TEST_DIR, "..");

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERT FAILED: ${message}`);
  }
}

async function loadTool(relativePath) {
  return import(pathToFileURL(path.join(PLUGIN_DIR, "tools", relativePath)).href);
}

async function testToolExports() {
  console.log("\n[test] tool exports …");
  const tools = [
    await loadTool("python.js"),
    await loadTool("node.js"),
    await loadTool("http-request.js"),
  ];

  for (const tool of tools) {
    assert(typeof tool.name === "string" && tool.name, "tool exports name");
    assert(typeof tool.description === "string" && tool.description, `${tool.name} exports description`);
    assert(typeof tool.promptSnippet === "string" && tool.promptSnippet, `${tool.name} exports promptSnippet`);
    assert(typeof tool.promptGuidelines === "string" && tool.promptGuidelines, `${tool.name} exports promptGuidelines`);
    assert(typeof tool.parameters === "object" && tool.parameters, `${tool.name} exports parameters`);
    assert(typeof tool.execute === "function", `${tool.name} exports execute`);
  }

  console.log("  ✓ python / node / http_request exports are present");
}

async function testHelperForwarding() {
  console.log("\n[test] helper forwarding …");
  const python = await loadTool("python.js");
  const node = await loadTool("node.js");
  const http = await loadTool("http-request.js");
  const seen = [];
  const ctx = {
    async runProgrammerCommand(input) {
      seen.push(input);
      return { content: [{ type: "text", text: JSON.stringify(input) }] };
    },
  };

  await python.execute({ version: true }, ctx);
  await node.execute({ code: "console.log('ok')" }, ctx);
  await http.execute({ url: "https://example.com/file.txt" }, ctx);

  assert(seen[0].kind === "python", "python tool forwards the python kind");
  assert(seen[1].kind === "node", "node tool forwards the node kind");
  assert(seen[2].kind === "http", "http tool forwards the http kind");

  console.log("  ✓ tools forward structured requests into runProgrammerCommand");
}

await testToolExports();
await testHelperForwarding();

console.log("\nAll programmer-tools smoke checks passed.");