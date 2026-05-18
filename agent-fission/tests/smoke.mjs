import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = path.resolve(TEST_DIR, "..");
const TOOL_URL = pathToFileURL(path.join(PLUGIN_DIR, "tools", "split-agent.js")).href;
const KEEP_AGENT = process.env.HANAKO_SMOKE_KEEP_AGENT === "1";

const hanaHome = path.resolve(process.env.HANA_HOME || path.join(os.homedir(), ".hanako"));
const serverInfoPath = path.join(hanaHome, "server-info.json");
if (!fs.existsSync(serverInfoPath)) {
  throw new Error(`Hanako server info not found: ${serverInfoPath}`);
}

const serverInfo = JSON.parse(fs.readFileSync(serverInfoPath, "utf8"));
const baseUrl = `http://127.0.0.1:${serverInfo.port}`;
const headers = { Authorization: `Bearer ${serverInfo.token}` };
const dataDir = path.join(hanaHome, "plugin-data", "agent-fission");
const TEST_AVATAR_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0n0AAAAASUVORK5CYII=";

async function api(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload?.error || `HTTP ${response.status} ${response.statusText}`);
  }
  return payload;
}

async function resolvePrimaryAgentId() {
  if (process.env.HANAKO_AGENT_ID) return process.env.HANAKO_AGENT_ID;
  const payload = await api("/api/agents");
  const agents = Array.isArray(payload?.agents) ? payload.agents : [];
  const primary = agents.find((agent) => agent?.isPrimary === true) || null;
  if (!primary?.id) {
    throw new Error("No primary agent found for smoke test");
  }
  return primary.id;
}

async function main() {
  fs.mkdirSync(dataDir, { recursive: true });
  const primaryAgentId = await resolvePrimaryAgentId();
  const mod = await import(TOOL_URL);
  const timestamp = Date.now();
  const identityOverlay = "Keep a concise helper voice with a light planning bias.";
  const ishikiOverlay = "Stay assistant-first and avoid overplaying the persona.";
  const result = await mod.execute(
    {
      name: process.env.HANAKO_SMOKE_AGENT_NAME || `Agent Fission Smoke ${timestamp}`,
      contentMode: "overlay",
      identity: identityOverlay,
      ishiki: ishikiOverlay,
      avatarDataUrl: TEST_AVATAR_DATA_URL,
    },
    {
      agentId: primaryAgentId,
      dataDir,
    },
  );

  console.log(JSON.stringify(result, null, 2));

  const createdAgentId = result?.details?.createdAgent?.id || "";
  if (!createdAgentId) {
    throw new Error("Smoke test did not return a created agent id");
  }

  const encodedAgentId = encodeURIComponent(createdAgentId);
  const [identityDoc, ishikiDoc, avatarResponse] = await Promise.all([
    api(`/api/agents/${encodedAgentId}/identity`),
    api(`/api/agents/${encodedAgentId}/ishiki`),
    fetch(`${baseUrl}/api/agents/${encodedAgentId}/avatar`, { headers }),
  ]);

  if (!identityDoc?.content?.includes(identityOverlay)) {
    throw new Error("Smoke test identity overlay was not written");
  }
  if (!identityDoc?.content?.includes("# ")) {
    throw new Error("Smoke test identity default scaffold was not preserved");
  }
  if (!ishikiDoc?.content?.includes(ishikiOverlay)) {
    throw new Error("Smoke test ishiki overlay was not written");
  }
  if (!ishikiDoc?.content?.includes("- ")) {
    throw new Error("Smoke test ishiki default scaffold was not preserved");
  }
  if (!avatarResponse.ok) {
    throw new Error(`Smoke test avatar fetch failed: HTTP ${avatarResponse.status} ${avatarResponse.statusText}`);
  }
  if (!String(avatarResponse.headers.get("content-type") || "").startsWith("image/png")) {
    throw new Error("Smoke test avatar content-type was not image/png");
  }

  if (KEEP_AGENT) {
    console.log(`KEPT:${createdAgentId}`);
    return;
  }

  await api(`/api/agents/${encodedAgentId}`, { method: "DELETE" });
  console.log(`DELETED:${createdAgentId}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});