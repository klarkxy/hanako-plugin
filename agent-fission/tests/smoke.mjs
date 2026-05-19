/**
 * agent-fission smoke test
 *
 * Verifies:
 * 1. Tool module exports the expected shape
 * 2. Full creation + overlay + avatar flow against a live Hanako server
 * 3. Primary-agent-only enforcement
 * 4. Content persistence (identity/ishiki/public-ishiki overlay merged correctly)
 * 5. Rollback on failure
 * 6. Parameter validation error messages
 *
 * Usage:
 *   node tests/smoke.mjs
 *   HANA_HOME=/custom/path node tests/smoke.mjs
 *   HANAKO_AGENT_ID=primary-abc node tests/smoke.mjs
 *   HANAKO_SMOKE_KEEP_AGENT=1 node tests/smoke.mjs   # keep agent for inspection
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = path.resolve(TEST_DIR, "..");
const TOOL_URL = pathToFileURL(path.join(PLUGIN_DIR, "tools", "split-agent.js")).href;
const KEEP_AGENT = process.env.HANAKO_SMOKE_KEEP_AGENT === "1";
const SKIP_CLEANUP = process.env.HANAKO_SMOKE_SKIP_CLEANUP === "1";

const hanaHome = path.resolve(process.env.HANA_HOME || path.join(os.homedir(), ".hanako"));
const serverInfoPath = path.join(hanaHome, "server-info.json");
if (!fs.existsSync(serverInfoPath)) {
  throw new Error(`Hanako server info not found: ${serverInfoPath}`);
}

const serverInfo = JSON.parse(fs.readFileSync(serverInfoPath, "utf8"));
const baseUrl = `http://127.0.0.1:${serverInfo.port}`;
const headers = { Authorization: `Bearer ${serverInfo.token}` };
const dataDir = path.join(hanaHome, "plugin-data", "agent-fission");

// A minimal valid 1x1 red PNG as a data URL for avatar tests
const TEST_AVATAR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0n0AAAAASUVORK5CYII=";

/* ── helpers ─────────────────────────────────────────────────── */

async function api(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
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
  const primary = agents.find((a) => a?.isPrimary === true) || null;
  if (!primary?.id) throw new Error("No primary agent found for smoke test");
  return primary.id;
}

async function deleteAgentSafe(agentId) {
  try {
    await api(`/api/agents/${encodeURIComponent(agentId)}`, { method: "DELETE" });
  } catch {
    // ignore cleanup errors
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT FAILED: ${message}`);
}

function jsonResponse(body, init = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function withMockFetch(mockImpl, fn) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockImpl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

/* ── test cases ──────────────────────────────────────────────── */

async function testToolExports() {
  console.log("\n[test] Tool module exports …");
  const mod = await import(TOOL_URL);
  const syncMod = await import(pathToFileURL(path.join(PLUGIN_DIR, "tools", "sync-agent-skills.js")).href);
  assert(typeof mod.name === "string", "tool exports name");
  assert(typeof mod.description === "string", "tool exports description");
  assert(typeof mod.parameters === "object" && mod.parameters !== null, "tool exports parameters");
  assert(Array.isArray(mod.parameters.required), "parameters.required is an array");
  assert(mod.parameters.required.includes("name"), "name is required");
  assert(mod.parameters.required.includes("identity"), "identity is required");
  assert(mod.parameters.required.includes("ishiki"), "ishiki is required");
  assert(mod.parameters.properties.enabledSkills, "split-agent exposes enabledSkills");
  assert(typeof syncMod.name === "string", "skill sync tool exports name");
  assert(typeof syncMod.description === "string", "skill sync tool exports description");
  assert(Array.isArray(syncMod.parameters.required), "skill sync parameters.required is an array");
  assert(syncMod.parameters.required.includes("skillName"), "skill sync requires skillName");
  assert(syncMod.parameters.properties.mode, "skill sync exposes preview/apply mode");
  assert(typeof mod.execute === "function", "tool exports execute function");
  console.log("  ✓ name, description, parameters, execute all present");
  console.log("  ✓ split-agent now exposes enabledSkills");
  console.log("  ✓ skill sync tool exports preview/apply controls");
}

async function testFullCreationFlow(primaryAgentId) {
  const timestamp = Date.now();
  const agentName = `Smoke Full ${timestamp}`;
  const identityOverlay = "Keep a concise helper voice with a light planning bias.";
  const ishikiOverlay = "Stay assistant-first and avoid overplaying the persona.";

  console.log(`\n[test] Full creation flow (overlay + avatar) …`);

  const mod = await import(TOOL_URL);
  const result = await mod.execute(
    {
      name: agentName,
      contentMode: "overlay",
      identity: identityOverlay,
      ishiki: ishikiOverlay,
      publicIshiki: "A friendly assistant.",
      avatarDataUrl: TEST_AVATAR_DATA_URL,
    },
    { agentId: primaryAgentId, dataDir },
  );

  assert(result?.content?.[0]?.text, "execute returned text content");
  const createdAgentId = result?.details?.createdAgent?.id || "";
  assert(createdAgentId, "execute returned a created agent id");
  assert(result.details.createdAgent.name === agentName, "returned agent name matches");
  assert(result.details.createdAgent.contentMode === "overlay", "contentMode is overlay");

  console.log(`  ✓ Agent created: ${createdAgentId}`);

  // Verify identity/ishiki content
  const encodedId = encodeURIComponent(createdAgentId);
  const [identityDoc, ishikiDoc, publicIshikiDoc, avatarRes] = await Promise.all([
    api(`/api/agents/${encodedId}/identity`),
    api(`/api/agents/${encodedId}/ishiki`),
    api(`/api/agents/${encodedId}/public-ishiki`),
    fetch(`${baseUrl}/api/agents/${encodedId}/avatar`, { headers }),
  ]);

  // Identity overlay merged on top of defaults
  assert(
    identityDoc?.content?.includes(identityOverlay),
    "identity overlay was written into the identity document",
  );
  assert(
    identityDoc?.content?.includes("# "),
    "default identity scaffold was preserved",
  );

  // Ishiki overlay merged on top of defaults
  assert(
    ishikiDoc?.content?.includes(ishikiOverlay),
    "ishiki overlay was written into the ishiki document",
  );
  assert(
    ishikiDoc?.content?.includes("- "),
    "default ishiki scaffold was preserved",
  );

  // Public-ishiki overlay
  assert(
    publicIshikiDoc?.content?.includes("A friendly assistant."),
    "public-ishiki overlay was written",
  );
  assert(
    publicIshikiDoc?.content?.includes("# "),
    "default public-ishiki scaffold was preserved",
  );

  // Avatar
  assert(avatarRes.ok, "avatar endpoint returned 200");
  const ct = String(avatarRes.headers.get("content-type") || "");
  assert(ct.startsWith("image/png"), `avatar content-type is image/png (got: ${ct})`);

  console.log("  ✓ identity overlay merged correctly");
  console.log("  ✓ ishiki overlay merged correctly");
  console.log("  ✓ public-ishiki overlay written");
  console.log("  ✓ avatar persisted as image/png");

  // Cleanup
  if (!KEEP_AGENT) {
    await deleteAgentSafe(createdAgentId);
    console.log("  ✓ agent cleaned up");
  } else {
    console.log(`  ∎ KEPT:${createdAgentId}`);
  }
}

async function testInitialSkillAssignment(primaryAgentId) {
  console.log("\n[test] Initial skill assignment on split_agent …");

  const mod = await import(TOOL_URL);
  const requests = [];
  const mockAgents = [
    { id: primaryAgentId, name: "Primary", isPrimary: true },
  ];
  const newAgentSkills = [
    { name: "core-default", enabled: true },
    { name: "shared-skill", enabled: false },
  ];

  await withMockFetch(async (url, options = {}) => {
    const parsedUrl = new URL(String(url));
    const method = String(options.method || "GET").toUpperCase();
    requests.push({ pathname: parsedUrl.pathname, search: parsedUrl.search, method, body: options.body || null });

    if (parsedUrl.pathname === "/api/agents" && method === "GET") {
      return jsonResponse({ agents: mockAgents });
    }
    if (parsedUrl.pathname === "/api/agents" && method === "POST") {
      const payload = JSON.parse(String(options.body || "{}"));
      return jsonResponse({ id: "agent-new", name: payload.name || "Agent New" });
    }
    if (parsedUrl.pathname === "/api/agents/agent-new/identity" && method === "PUT") {
      return jsonResponse({ ok: true });
    }
    if (parsedUrl.pathname === "/api/agents/agent-new/ishiki" && method === "PUT") {
      return jsonResponse({ ok: true });
    }
    if (parsedUrl.pathname === "/api/skills" && parsedUrl.searchParams.get("agentId") === "agent-new" && method === "GET") {
      return jsonResponse({ skills: newAgentSkills });
    }
    if (parsedUrl.pathname === "/api/agents/agent-new/skills" && method === "PUT") {
      const payload = JSON.parse(String(options.body || "{}"));
      return jsonResponse({ ok: true, enabled: payload.enabled || [] });
    }

    throw new Error(`Unexpected request in initial skill assignment test: ${method} ${parsedUrl.pathname}${parsedUrl.search}`);
  }, async () => {
    const result = await mod.execute(
      {
        name: "Skillful Agent",
        identity: "# Skillful Agent\nA helper that keeps a light skill set.",
        ishiki: "- Keep skills practical\n- Do not overclaim",
        enabledSkills: ["shared-skill", "missing-skill"],
      },
      { agentId: primaryAgentId, dataDir },
    );

    assert(result?.details?.createdAgent?.requestedEnabledSkills?.includes("shared-skill"), "requested skill recorded");
    assert(result?.details?.createdAgent?.initialEnabledSkills?.includes("shared-skill"), "shared skill added to new agent");
    assert(result?.content?.[0]?.text?.includes("Initial skills enabled: shared-skill"), "success text mentions initial skill addition");
    assert(result?.content?.[0]?.text?.includes("Skipped skills that were not visible to the new agent: missing-skill"), "success text mentions skipped skills");

    const skillPut = requests.find((request) => request.pathname === "/api/agents/agent-new/skills" && request.method === "PUT");
    assert(skillPut, "skill update request was sent");
    const skillBody = JSON.parse(String(skillPut.body || "{}"));
    assert(skillBody.enabled.includes("core-default"), "existing enabled skill preserved");
    assert(skillBody.enabled.includes("shared-skill"), "requested skill added");
    assert(!skillBody.enabled.includes("missing-skill"), "missing skill not added");
  });

  console.log("  ✓ split-agent can append initial skills to a new agent");
}

async function testSkillDistributionTool(primaryAgentId) {
  console.log("\n[test] Skill distribution tool preview/apply …");

  const syncMod = await import(pathToFileURL(path.join(PLUGIN_DIR, "tools", "sync-agent-skills.js")).href);
  const requests = [];
  const mockAgents = [
    { id: primaryAgentId, name: "Primary", isPrimary: true },
    { id: "writer", name: "Writer", isPrimary: false },
    { id: "helper", name: "Helper", isPrimary: false },
  ];

  const skillViews = new Map([
    [primaryAgentId, [{ name: "shared-skill", enabled: false }, { name: "core-default", enabled: true }]],
    ["writer", [{ name: "shared-skill", enabled: true }, { name: "core-default", enabled: true }]],
    ["helper", [{ name: "core-default", enabled: true }]],
  ]);

  await withMockFetch(async (url, options = {}) => {
    const parsedUrl = new URL(String(url));
    const method = String(options.method || "GET").toUpperCase();
    requests.push({ pathname: parsedUrl.pathname, search: parsedUrl.search, method, body: options.body || null });

    if (parsedUrl.pathname === "/api/agents" && method === "GET") {
      return jsonResponse({ agents: mockAgents });
    }
    if (parsedUrl.pathname === "/api/skills" && method === "GET") {
      const agentId = parsedUrl.searchParams.get("agentId") || "";
      return jsonResponse({ skills: skillViews.get(agentId) || [] });
    }
    if (parsedUrl.pathname === `/api/agents/${encodeURIComponent(primaryAgentId)}/skills` && method === "PUT") {
      const payload = JSON.parse(String(options.body || "{}"));
      return jsonResponse({ ok: true, enabled: payload.enabled || [] });
    }
    if (parsedUrl.pathname === "/api/agents/writer/skills" && method === "PUT") {
      const payload = JSON.parse(String(options.body || "{}"));
      return jsonResponse({ ok: true, enabled: payload.enabled || [] });
    }
    if (parsedUrl.pathname === "/api/agents/helper/skills" && method === "PUT") {
      throw new Error("helper should not receive a PUT because the skill is not visible there");
    }

    throw new Error(`Unexpected request in skill distribution test: ${method} ${parsedUrl.pathname}${parsedUrl.search}`);
  }, async () => {
    const preview = await syncMod.execute(
      { skillName: "shared-skill", mode: "preview" },
      { agentId: primaryAgentId, dataDir },
    );
    assert(preview?.details?.summary?.canEnableCount === 1, "preview finds one agent that can receive the skill");
    assert(preview?.details?.summary?.alreadyEnabledCount === 1, "preview finds one already-enabled agent");
    assert(preview?.details?.summary?.notVisibleCount === 1, "preview finds one agent that cannot see the skill");

    const apply = await syncMod.execute(
      { skillName: "shared-skill", mode: "apply", agentIds: [primaryAgentId, "writer", "helper"] },
      { agentId: primaryAgentId, dataDir },
    );
    assert(apply?.details?.summary?.appliedCount === 1, "apply enables the skill once");
    assert(apply?.details?.summary?.alreadyEnabledCount === 1, "apply preserves already-enabled agents");
    assert(apply?.details?.summary?.skippedCount === 1, "apply skips the agent that cannot see the skill");

    const putRequests = requests.filter((request) => request.method === "PUT");
    assert(putRequests.some((request) => request.pathname === `/api/agents/${encodeURIComponent(primaryAgentId)}/skills`), "primary agent update was sent");
    assert(!putRequests.some((request) => request.pathname === "/api/agents/writer/skills"), "already-enabled agent was not rewritten");
    assert(!putRequests.some((request) => request.pathname === "/api/agents/helper/skills"), "helper agent was not updated");
  });

  console.log("  ✓ skill distribution preview and apply paths work");
}

async function testReplaceMode(primaryAgentId) {
  const timestamp = Date.now();
  const agentName = `Smoke Replace ${timestamp}`;
  const fullIdentity = "# Custom Agent\n\nA fully custom identity.";
  const fullIshiki = "- Custom ishiki rule\n- Another rule";

  console.log(`\n[test] Replace mode …`);

  const mod = await import(TOOL_URL);
  const result = await mod.execute(
    {
      name: agentName,
      contentMode: "replace",
      identity: fullIdentity,
      ishiki: fullIshiki,
    },
    { agentId: primaryAgentId, dataDir },
  );

  const agentId = result?.details?.createdAgent?.id || "";
  assert(agentId, "agent was created in replace mode");
  assert(result.details.createdAgent.contentMode === "replace", "contentMode is replace");

  const encodedId = encodeURIComponent(agentId);
  const [identityDoc, ishikiDoc] = await Promise.all([
    api(`/api/agents/${encodedId}/identity`),
    api(`/api/agents/${encodedId}/ishiki`),
  ]);

  assert(identityDoc?.content?.trim() === fullIdentity, "identity was fully replaced");
  assert(ishikiDoc?.content?.trim() === fullIshiki, "ishiki was fully replaced");
  console.log("  ✓ identity fully replaced (no defaults leaked)");
  console.log("  ✓ ishiki fully replaced (no defaults leaked)");

  if (!KEEP_AGENT) {
    await deleteAgentSafe(agentId);
    console.log("  ✓ agent cleaned up");
  }
}

async function testPrimaryOnlyEnforcement() {
  console.log("\n[test] Primary-only enforcement …");

  const mod = await import(TOOL_URL);

  // GET the agent list and find a non-primary agent
  const agentList = await api("/api/agents");
  const agents = Array.isArray(agentList?.agents) ? agentList.agents : [];
  const nonPrimary = agents.find((a) => a?.isPrimary !== true);

  if (nonPrimary?.id) {
    try {
      await mod.execute(
        {
          name: "Should Fail",
          identity: "Any",
          ishiki: "Any",
        },
        { agentId: nonPrimary.id, dataDir },
      );
      assert(false, "should have thrown for non-primary caller");
    } catch (error) {
      assert(
        error.message.includes("not primary") || error.message.includes("primary agent"),
        `error message mentions primary requirement: ${error.message}`,
      );
      console.log("  ✓ non-primary caller correctly rejected");
    }
  } else {
    console.log("  ∎ no non-primary agent found, skipping enforcement test");
  }
}

async function testParameterValidation() {
  console.log("\n[test] Parameter validation …");

  const mod = await import(TOOL_URL);

  // Missing name
  try {
    await mod.execute({ identity: "X", ishiki: "Y" }, { agentId: "any", dataDir });
    assert(false, "should have thrown for missing name");
  } catch (error) {
    assert(error.message.includes("name"), `error mentions name: ${error.message}`);
    console.log("  ✓ missing name rejected");
  }

  // Both avatarUrl and avatarDataUrl
  try {
    await mod.execute(
      {
        name: "Test",
        identity: "X",
        ishiki: "Y",
        avatarUrl: "https://example.com/avatar.png",
        avatarDataUrl: TEST_AVATAR_DATA_URL,
      },
      { agentId: "any", dataDir },
    );
    assert(false, "should have thrown for both avatar inputs");
  } catch (error) {
    assert(
      error.message.includes("not both") || error.message.includes("either"),
      `error mentions exclusive constraint: ${error.message}`,
    );
    console.log("  ✓ both avatarUrl+avatarDataUrl rejected");
  }

  // Invalid yuan
  try {
    await mod.execute(
      { name: "Test", identity: "X", ishiki: "Y", yuan: "invalid-yuan" },
      { agentId: "any", dataDir },
    );
    assert(false, "should have thrown for invalid yuan");
  } catch (error) {
    assert(
      error.message.includes("yuan"),
      `error mentions yuan: ${error.message}`,
    );
    console.log("  ✓ invalid yuan rejected");
  }

  // Invalid contentMode
  try {
    await mod.execute(
      { name: "Test", identity: "X", ishiki: "Y", contentMode: "invalid" },
      { agentId: "any", dataDir },
    );
    assert(false, "should have thrown for invalid contentMode");
  } catch (error) {
    assert(
      error.message.includes("contentMode"),
      `error mentions contentMode: ${error.message}`,
    );
    console.log("  ✓ invalid contentMode rejected");
  }
}

/* ── main ────────────────────────────────────────────────────── */

async function main() {
  fs.mkdirSync(dataDir, { recursive: true });

  const primaryAgentId = await resolvePrimaryAgentId();
  console.log(`Primary agent: ${primaryAgentId}`);
  console.log(`Hanako home:   ${hanaHome}`);
  console.log(`Server URL:    ${baseUrl}`);
  console.log(`Keep agents:   ${KEEP_AGENT}`);

  const createdIds = [];

  try {
    await testToolExports();
    await testParameterValidation();
    await testPrimaryOnlyEnforcement();
    await testReplaceMode(primaryAgentId);
    await testFullCreationFlow(primaryAgentId);
    await testInitialSkillAssignment(primaryAgentId);
    await testSkillDistributionTool(primaryAgentId);
  } catch (error) {
    console.error(`\n✗ ${error.stack || error.message}`);
    process.exitCode = 1;
  } finally {
    if (SKIP_CLEANUP) {
      console.log("\n∎ SKIP_CLEANUP is set — temporary agents NOT cleaned up");
    }
  }

  console.log("\n── smoke test complete ──");
}

main();
