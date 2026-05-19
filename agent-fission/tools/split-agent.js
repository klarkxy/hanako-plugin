import fs from "node:fs";
import path from "node:path";
import {
  addEnabledSkillsToAgent,
  normalizeStringList,
} from "./lib/runtime.js";

const VALID_YUAN = ["hanako", "butter", "ming", "kong"];
const VALID_CONTENT_MODES = ["replace", "overlay"];
const VALID_AVATAR_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_AVATAR_BYTES = 15 * 1024 * 1024;

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
      description: "Identity content for the new agent. In replace mode this is the full identity.md content. In overlay mode this should be a short add-on layered on top of Hanako's default identity template."
    },
    ishiki: {
      type: "string",
      description: "Ishiki content for the new agent. In replace mode this is the full ishiki.md content. In overlay mode this should be a short add-on layered on top of Hanako's default ishiki template."
    },
    publicIshiki: {
      type: "string",
      description: "Optional public-ishiki.md content. In overlay mode, keep it short and layer it on top of Hanako's default public-ishiki template."
    },
    contentMode: {
      type: "string",
      enum: VALID_CONTENT_MODES,
      description: "How to apply identity/ishiki/publicIshiki. Use overlay to keep Hanako's default templates and append a thin personality layer. Defaults to replace."
    },
    avatarUrl: {
      type: "string",
      description: "Optional http/https image URL for the new agent avatar. The tool downloads the image and uploads it to the new agent."
    },
    avatarDataUrl: {
      type: "string",
      description: "Optional data URL for a png/jpg/webp avatar image. Useful when the caller already has the image bytes."
    },
    enabledSkills: {
      type: "array",
      items: { type: "string" },
      description: "Optional initial skills to add to the new agent after creation. Existing enabled skills are preserved."
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
  const contentMode = normalizeContentMode(input.contentMode);
  const avatarUrl = optionalString(input.avatarUrl);
  const avatarDataUrl = optionalString(input.avatarDataUrl);
  const enabledSkills = normalizeStringList(input.enabledSkills);
  const requestedId = optionalString(input.id);
  const yuan = normalizeYuan(input.yuan);
  const server = readLocalServerInfo(resolveHanakoHome(ctx));

  if (avatarUrl && avatarDataUrl) {
    throw new Error("Provide either avatarUrl or avatarDataUrl, not both.");
  }

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

    const filePayloads = contentMode === "overlay"
      ? await buildOverlayPayloads(server, createdAgentId, { identity, ishiki, publicIshiki })
      : { identity, ishiki, publicIshiki };

    await apiRequest(server, "PUT", `/api/agents/${encodedAgentId}/identity`, {
      content: filePayloads.identity,
    });
    await apiRequest(server, "PUT", `/api/agents/${encodedAgentId}/ishiki`, {
      content: filePayloads.ishiki,
    });

    if (filePayloads.publicIshiki) {
      await apiRequest(server, "PUT", `/api/agents/${encodedAgentId}/public-ishiki`, {
        content: filePayloads.publicIshiki,
      });
    }

    if (avatarUrl || avatarDataUrl) {
      const avatarData = avatarDataUrl
        ? normalizeAvatarDataUrl(avatarDataUrl)
        : await fetchRemoteAvatarAsDataUrl(avatarUrl);
      await apiRequest(server, "POST", `/api/agents/${encodedAgentId}/avatar`, {
        data: avatarData,
      });
    }

    const skillResult = enabledSkills.length > 0
      ? await addEnabledSkillsToAgent(server, createdAgentId, enabledSkills)
      : null;

    const lines = [
      `Created persistent agent \"${created?.name || agentName}\" (${createdAgentId}).`,
      `Created by primary agent: ${currentAgentId}.`,
      "Identity and ishiki were written successfully.",
      "This is a normal standalone Hanako agent, not a runtime subagent.",
    ];
    if (yuan) lines.push(`Base yuan: ${yuan}.`);
    if (contentMode === "overlay") lines.push("Identity and ishiki were layered on top of Hanako's default templates.");
    if (avatarUrl || avatarDataUrl) lines.push("Avatar was written successfully.");
    if (skillResult?.added?.length) {
      lines.push(`Initial skills enabled: ${skillResult.added.join(", ")}.`);
    }
    if (skillResult?.skipped?.length) {
      lines.push(`Skipped skills that were not visible to the new agent: ${skillResult.skipped.map((item) => item.name).join(", ")}.`);
    }

    return {
      content: [{ type: "text", text: lines.join("\n") }],
      details: {
        createdAgent: {
          id: createdAgentId,
          name: created?.name || agentName,
          createdBy: currentAgentId,
          contentMode,
          ...(enabledSkills.length > 0 ? { requestedEnabledSkills: enabledSkills } : {}),
          ...(skillResult?.nextEnabled?.length ? { initialEnabledSkills: skillResult.nextEnabled } : {}),
          ...(yuan ? { yuan } : {}),
          ...((avatarUrl || avatarDataUrl)
            ? { avatarSource: avatarUrl ? "avatarUrl" : "avatarDataUrl" }
            : {}),
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

function normalizeContentMode(value) {
  const normalized = optionalString(value) || "replace";
  if (!VALID_CONTENT_MODES.includes(normalized)) {
    throw new Error(`contentMode must be one of: ${VALID_CONTENT_MODES.join(", ")}`);
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

async function buildOverlayPayloads(server, agentId, overlays) {
  const [defaultIdentity, defaultIshiki, defaultPublicIshiki] = await Promise.all([
    readAgentDocument(server, agentId, "identity"),
    readAgentDocument(server, agentId, "ishiki"),
    readAgentDocument(server, agentId, "public-ishiki"),
  ]);

  return {
    identity: mergeWithDefault(defaultIdentity, overlays.identity),
    ishiki: mergeWithDefault(defaultIshiki, overlays.ishiki),
    publicIshiki: overlays.publicIshiki
      ? mergeWithDefault(defaultPublicIshiki, overlays.publicIshiki)
      : "",
  };
}

async function readAgentDocument(server, agentId, fileKey) {
  const payload = await apiRequest(server, "GET", `/api/agents/${encodeURIComponent(agentId)}/${fileKey}`);
  return typeof payload?.content === "string" ? payload.content : "";
}

function mergeWithDefault(defaultContent, overlayContent) {
  const overlay = optionalString(overlayContent);
  const base = typeof defaultContent === "string" ? defaultContent.trimEnd() : "";
  if (!overlay) return base ? `${base}\n` : "";
  if (!base) return `${overlay}\n`;
  return `${base}\n\n${overlay}\n`;
}

function normalizeAvatarDataUrl(dataUrl) {
  const normalized = optionalString(dataUrl);
  const match = normalized.match(/^data:(image\/(?:png|jpe?g|webp));base64,([a-z0-9+/=]+)$/i);
  if (!match) {
    throw new Error("avatarDataUrl must be a png/jpg/webp data URL.");
  }

  const mimeType = normalizeAvatarMimeType(match[1]);
  const bytes = Buffer.from(match[2], "base64");
  validateAvatarBytes(bytes, "avatarDataUrl");
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

async function fetchRemoteAvatarAsDataUrl(avatarUrl) {
  const normalized = optionalString(avatarUrl);
  if (!normalized) return "";

  let parsedUrl;
  try {
    parsedUrl = new URL(normalized);
  } catch {
    throw new Error("avatarUrl must be a valid http/https URL.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("avatarUrl must use http or https.");
  }

  const response = await fetch(parsedUrl, {
    headers: {
      Accept: "image/png,image/jpeg,image/webp,*/*",
      "User-Agent": "Hanako-Agent-Fission/1.0.0",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`avatarUrl download failed: HTTP ${response.status} ${response.statusText}`);
  }

  const responseUrl = response.url ? new URL(response.url) : parsedUrl;
  const headerMimeType = normalizeAvatarMimeType(
    String(response.headers.get("content-type") || "").split(";")[0],
    { allowEmpty: true }
  );
  const inferredMimeType = inferAvatarMimeTypeFromPath(responseUrl.pathname);
  const mimeType = headerMimeType || inferredMimeType;
  if (!mimeType) {
    throw new Error("avatarUrl must point to a png, jpg, or webp image.");
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  validateAvatarBytes(bytes, "avatarUrl");
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

function validateAvatarBytes(bytes, fieldName) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    throw new Error(`${fieldName} did not provide any image bytes.`);
  }
  if (bytes.length > MAX_AVATAR_BYTES) {
    throw new Error(`${fieldName} exceeds the 15 MB avatar limit.`);
  }
}

function normalizeAvatarMimeType(value, { allowEmpty = false } = {}) {
  const normalized = optionalString(value).toLowerCase();
  if (!normalized) return allowEmpty ? "" : invalidAvatarMimeType();
  if (normalized === "image/jpg") return "image/jpeg";
  if (!VALID_AVATAR_MIME_TYPES.includes(normalized)) {
    if (allowEmpty) return "";
    return invalidAvatarMimeType();
  }
  return normalized;
}

function invalidAvatarMimeType() {
  throw new Error("Avatar images must be png, jpg, or webp.");
}

function inferAvatarMimeTypeFromPath(pathname) {
  const normalized = String(pathname || "").toLowerCase();
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".webp")) return "image/webp";
  return "";
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