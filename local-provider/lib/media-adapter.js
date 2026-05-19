import path from "node:path";
import { downloadUrls, runConfiguredRuntime } from "./local-runtime.js";
import { readRuntimeConfig } from "./runtime-store.js";

function createTaskId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function firstInputFile(value) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function toRelativeFiles(files, generatedDir) {
  return files.map((filePath) => path.relative(generatedDir, filePath).split(path.sep).join("/"));
}

function resolveBindings(params, outputDir) {
  return {
    prompt: params.prompt || "",
    modelId: params.model || "",
    inputFile: firstInputFile(params.image),
    outputDir,
    size: params.size || params.resolution || "",
    duration: params.duration || "",
    ratio: params.aspect_ratio || params.aspectRatio || params.ratio || "",
    format: params.format || "",
  };
}

export function createLocalProviderMediaAdapter(pluginCtx, types) {
  return {
    id: "local-provider",
    name: "Local Provider",
    types: [...types],
    capabilities: {
      ratios: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"],
      resolutions: ["1k", "2k", "4k"],
    },

    async checkAuth() {
      return {
        ok: types.length > 0,
        message: types.length > 0 ? "ok" : "configure image/video runtimes first",
      };
    },

    async submit(params, submitCtx) {
      const runtimeKey = params.type === "video" ? "video" : "image";
      const runtimes = await readRuntimeConfig(pluginCtx);
      const spec = runtimes[runtimeKey];
      if (!spec) {
        throw new Error(`local-provider ${runtimeKey} runtime is not configured. Use local-provider_configure-runtime first.`);
      }

      const generatedDir = submitCtx.generatedDir || path.join(submitCtx.dataDir, "generated");
      const taskId = createTaskId();
      const outputDir = path.join(generatedDir, `local-provider-${runtimeKey}-${taskId}`);
      const result = await runConfiguredRuntime(spec, resolveBindings(params, outputDir), { outputDir });

      let files = result.files || [];
      if (files.length === 0 && Array.isArray(result.urls) && result.urls.length > 0) {
        files = await downloadUrls(result.urls, outputDir, runtimeKey);
      }
      if (files.length === 0) {
        throw new Error(`local-provider ${runtimeKey} runtime did not produce any files`);
      }

      return {
        taskId,
        files: toRelativeFiles(files, generatedDir),
      };
    },
  };
}