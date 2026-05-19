import fs from "node:fs";
import path from "node:path";

const VALID_AVATAR_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_AVATAR_BYTES = 15 * 1024 * 1024;

export function optionalString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function requireNonEmptyString(value, fieldName) {
  const normalized = optionalString(value);
  if (!normalized) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
  return normalized;
}

export function normalizeStringList(values) {
  const seen = new Set();
  const out = [];
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = optionalString(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export function resolveHanakoHome(ctx) {
  const envHome = optionalString(process.env.HANA_HOME);
  if (envHome) return envHome;

  const dataDir = optionalString(ctx?.dataDir);
  if (!dataDir) {
    throw new Error("Unable to resolve HANA_HOME: dataDir is missing.");
  }

  return path.dirname(path.dirname(dataDir));
}

export function readLocalServerInfo(hanakoHome) {
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

function parseJson(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function apiRequest(server, method, pathname, body) {
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

export async function listAgents(server) {
  return apiRequest(server, "GET", "/api/agents");
}

export async function readAgentSkills(server, agentId) {
  return apiRequest(server, "GET", `/api/skills?agentId=${encodeURIComponent(agentId)}`);
}

export async function updateAgentSkills(server, agentId, enabled) {
  return apiRequest(server, "PUT", `/api/agents/${encodeURIComponent(agentId)}/skills`, {
    enabled,
  });
}

export function ensurePrimaryCaller(currentAgentId, agents) {
  const currentAgent = agents.find((agent) => agent?.id === currentAgentId) || null;
  if (!currentAgent) {
    throw new Error(`Current agent "${currentAgentId}" is not present in the Hanako agent list.`);
  }

  if (currentAgent.isPrimary === true) {
    return;
  }

  const explicitPrimaryExists = agents.some((agent) => agent?.isPrimary === true);
  if (!explicitPrimaryExists && agents.length === 1 && agents[0]?.id === currentAgentId) {
    return;
  }

  throw new Error(`Only the primary agent can create another persistent agent. Current agent "${currentAgentId}" is not primary.`);
}

export async function addEnabledSkillsToAgent(server, agentId, skillNames) {
  const requested = normalizeStringList(skillNames);
  const skillView = await readAgentSkills(server, agentId);
  const skills = Array.isArray(skillView?.skills) ? skillView.skills : [];
  const visibleByName = new Map(skills.map((skill) => [skill?.name, skill]));
  const currentEnabled = skills.filter((skill) => skill?.enabled).map((skill) => skill.name);
  const enabledSet = new Set(currentEnabled);
  const added = [];
  const skipped = [];

  for (const name of requested) {
    if (!visibleByName.has(name)) {
      skipped.push({ name, reason: "not-visible" });
      continue;
    }
    if (enabledSet.has(name)) continue;
    enabledSet.add(name);
    added.push(name);
  }

  const nextEnabled = [...enabledSet];
  if (added.length > 0) {
    await updateAgentSkills(server, agentId, nextEnabled);
  }

  return {
    skills,
    currentEnabled,
    added,
    skipped,
    nextEnabled,
    changed: added.length > 0,
  };
}

export function normalizeAvatarMimeType(value, { allowEmpty = false } = {}) {
  const normalized = optionalString(value).toLowerCase();
  if (!normalized) return allowEmpty ? "" : invalidAvatarMimeType();
  if (normalized === "image/jpg") return "image/jpeg";
  if (!VALID_AVATAR_MIME_TYPES.includes(normalized)) {
    if (allowEmpty) return "";
    return invalidAvatarMimeType();
  }
  return normalized;
}

export function inferAvatarMimeTypeFromPath(pathname) {
  const normalized = String(pathname || "").toLowerCase();
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".webp")) return "image/webp";
  return "";
}

export function validateAvatarBytes(bytes, fieldName) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    throw new Error(`${fieldName} did not provide any image bytes.`);
  }
  if (bytes.length > MAX_AVATAR_BYTES) {
    throw new Error(`${fieldName} exceeds the 15 MB avatar limit.`);
  }
}

export function normalizeAvatarDataUrl(dataUrl) {
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

export async function fetchRemoteAvatarAsDataUrl(avatarUrl) {
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
    { allowEmpty: true },
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

function invalidAvatarMimeType() {
  throw new Error("Avatar images must be png, jpg, or webp.");
}