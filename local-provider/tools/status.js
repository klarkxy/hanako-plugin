import { DEFAULT_LM_STUDIO_BASE_URL } from "../lib/runtime-store.js";

export const name = "status";
export const description = "Inspect LM Studio connectivity and the local-provider runtime configuration.";

export const parameters = {
  type: "object",
  properties: {
    baseUrl: { type: "string", description: "Optional LM Studio base URL override, defaults to http://127.0.0.1:1234/v1" },
    includeModels: { type: "boolean", description: "Whether to list discovered LM Studio models, default true" },
  },
};

export async function execute(input, ctx) {
  const includeModels = input.includeModels !== false;
  const status = await ctx._localProvider?.getStatus?.({ baseUrl: input.baseUrl || DEFAULT_LM_STUDIO_BASE_URL });
  if (!status) {
    return "local-provider lifecycle is not ready";
  }

  const lines = [
    `LM Studio base URL: ${status.baseUrl}`,
    `LM Studio status: ${status.ok ? "reachable" : `unreachable (${status.error || "unknown"})`}`,
    `Registered media adapter types: ${status.registeredMediaTypes.length ? status.registeredMediaTypes.join(", ") : "none"}`,
    "Configured runtimes:",
  ];

  for (const [key, value] of Object.entries(status.runtimes || {})) {
    if (!value?.configured) {
      lines.push(`- ${key}: not configured`);
      continue;
    }
    lines.push(`- ${key}: ${value.executable} (${value.outputKind}, ${value.timeoutMs}ms)`);
  }

  if (includeModels) {
    if (status.models.length > 0) {
      lines.push("LM Studio models:");
      for (const model of status.models) {
        lines.push(`- ${model.id}`);
      }
    } else if (status.ok) {
      lines.push("LM Studio models: none returned");
    }
  }

  return lines.join("\n");
}