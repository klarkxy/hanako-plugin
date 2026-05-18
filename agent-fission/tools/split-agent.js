import fs from "node:fs";
import path from "node:path";

const VALID_YUAN = ["hanako", "butter", "ming", "kong"];

export const name = "split_agent";
export const description = "Primary agent only. Create a persistent standalone Hanako agent with its own identity and ishiki.";
export const parameters = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "Display name for the new persistent agent."
    },
    id: {
      type: "string",
      description: "Optional stable agent id. If omitted, Hanako generates one from the name."
    },
    yuan: {
      type: "string",
      enum: VALID_YUAN,
      description: "Optional base yuan template. Defaults to Hanako's normal create-agent fallback."
    },
    identity: {
      type: "string",
      description: "Full identity.md content for the new agent. This should describe the new agent's intro, role, and outward persona."
    },
    ishiki: {
      type: "string",
      description: "Full ishiki.md content for the new agent. This should define the new agent's deep core, soul, and internal principles."
    },
    publicIshiki: {
      type: "string",
      description: "Optional public-ishiki.md content for the new agent."
    }
  },
  required: ["name", "identity", "ishiki"]
};

export async function execute(input = {}, ctx = {}) {
  const currentAgentId = requireNonEmptyString(ctx.agentId, "runtime agentId");
  const agentName = requireNonEmptyString(input.name, "name");
  const identity = requireNonEmptyString(input.identity, "identity");
  const ishiki = requireNonEmptyString(input.ishiki, "ishiki");
  const publicIshiki = optionalString(input.publicIshiki);
  const requestedId = optionalString(input.id);
  const yuan = normalizeYuan(input.yuan);
  const server = readLocalServerInfo(resolveHanakoHome(ctx));

  const agentList = await apiRequest(server, "GET", "/api/agents");
  const agents = Array.isArray(agentList?.agents) ? agentList.agents : [];
  ensurePrimaryCaller(currentAgentId, agents);

  let createdAgentId = null;

  try {
    const created = await apiRequest(server, "POST", "/api/agents", {
      name: agentName,
      ...(requestedId ? { id: requestedId } : {}),
      ...(yuan ? { yuan } : {}),
    });

    createdAgentId = requireNonEmptyString(created?.id, "created agent id");
    const encodedAgentId = encodeURIComponent(createdAgentId);

    await apiRequest(server, "PUT", `/api/agents/${encodedAgentId}/identity`, {
      content: identity,
    });
    await apiRequest(server, "PUT", `/api/agents/${encodedAgentId}/ishiki`, {
      content: ishiki,
    });

    if (publicIshiki) {
      await apiRequest(server, "PUT", `/api/agents/${encodedAgentId}/public-ishiki`, {
        content: publicIshiki,
      });
    }

    const lines = [
      `Created persistent agent \"${created?.name || agentName}\" (${createdAgentId}).`,
      `Created by primary agent: ${currentAgentId}.`,
      "Identity and ishiki were written successfully.",
      "This is a normal standalone Hanako agent, not a runtime subagent.",
    ];
    if (yuan) lines.push(`Base yuan: ${yuan}.`);

    return {
      content: [{ type: "text", text: lines.join("\n") }],
      details: {
        createdAgent: {
          id: createdAgentId,
          name: created?.name || agentName,
          createdBy: currentAgentId,
          ...(yuan ? { yuan } : {}),
        },
      },
    };
  } catch (error) {
    if (createdAgentId) {
      const rollbackError = await rollbackAgent(server, createdAgentId);
      if (rollbackError) {
        throw new Error(`Failed to split agent: ${error.message}. Rollback also failed: ${rollbackError.message}`);
      }
      throw new Error(`Failed to split agent: ${error.message}. Partial agent creation was rolled back.`);
    }
    throw new Error(`Failed to split agent: ${error.message}`);
  }
}

function resolveHanakoHome(ctx) {
  const envHome = optionalString(process.env.HANA_HOME);
  if (envHome) return envHome;

  const dataDir = optionalString(ctx?.dataDir);
  if (!dataDir) {
    throw new Error("Unable to resolve HANA_HOME: dataDir is missing.");
  }

  return path.dirname(path.dirname(dataDir));
}

function readLocalServerInfo(hanakoHome) {
  const serverInfoPath = path.join(hanakoHome, "server-info.json");
  let parsed;

  try {
    parsed = JSON.parse(fs.readFileSync(serverInfoPath, "utf-8"));
  } catch (error) {
    throw new Error(`Unable to read local server info at ${serverInfoPath}: ${error.message}`);
  }

  const port = Number(parsed?.port);
  const token = optionalString(parsed?.token);
  if (!Number.isInteger(port) || port <= 0 || !token) {
    throw new Error("server-info.json is missing a valid port/token pair.");
  }

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    token,
  };
}

async function apiRequest(server, method, pathname, body) {
  const response = await fetch(`${server.baseUrl}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${server.token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const payload = parseJson(text);

  if (!response.ok) {
    const message = typeof payload?.error === "string"
      ? payload.error
      : `HTTP ${response.status} ${response.statusText}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return payload;
}

function parseJson(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function ensurePrimaryCaller(currentAgentId, agents) {
  const currentAgent = agents.find((agent) => agent?.id === currentAgentId) || null;
  if (!currentAgent) {
    throw new Error(`Current agent \"${currentAgentId}\" is not present in the Hanako agent list.`);
  }

  if (currentAgent.isPrimary === true) {
    return;
  }

  const explicitPrimaryExists = agents.some((agent) => agent?.isPrimary === true);
  if (!explicitPrimaryExists && agents.length === 1 && agents[0]?.id === currentAgentId) {
    return;
  }

  throw new Error(`Only the primary agent can create another persistent agent. Current agent \"${currentAgentId}\" is not primary.`);
}

function normalizeYuan(value) {
  const normalized = optionalString(value);
  if (!normalized) return "";
  if (!VALID_YUAN.includes(normalized)) {
    throw new Error(`yuan must be one of: ${VALID_YUAN.join(", ")}`);
  }
  return normalized;
}

function requireNonEmptyString(value, fieldName) {
  const normalized = optionalString(value);
  if (!normalized) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
  return normalized;
}

function optionalString(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function rollbackAgent(server, agentId) {
  try {
    await apiRequest(server, "DELETE", `/api/agents/${encodeURIComponent(agentId)}`);
    return null;
  } catch (error) {
    return error;
  }
}