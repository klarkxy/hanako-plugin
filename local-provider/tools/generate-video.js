import path from "node:path";
import { downloadUrls, runConfiguredRuntime } from "../lib/local-runtime.js";
import { readRuntimeConfig } from "../lib/runtime-store.js";

function createTaskId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function firstInputFile(value) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export const name = "generate-video";
export const description = "Run the configured local video runtime directly and stage the generated files into the current session.";

export const parameters = {
  type: "object",
  properties: {
    prompt: { type: "string", description: "Video prompt" },
    model: { type: "string", description: "Optional runtime-specific model id" },
    image: { type: "string", description: "Optional reference image path" },
    duration: { type: "number", description: "Optional duration hint" },
    ratio: { type: "string", description: "Optional aspect ratio hint" },
    format: { type: "string", description: "Optional output format hint" },
  },
  required: ["prompt"],
};

export async function execute(input, ctx) {
  const runtimes = await readRuntimeConfig(ctx);
  const spec = runtimes.video;
  if (!spec) {
    return "video runtime is not configured. Use local-provider_configure-runtime first.";
  }

  const taskId = createTaskId();
  const outputDir = path.join(ctx.dataDir, "generated", `local-video-${taskId}`);
  const result = await runConfiguredRuntime(
    spec,
    {
      prompt: input.prompt,
      modelId: input.model || "",
      inputFile: firstInputFile(input.image),
      duration: input.duration || "",
      ratio: input.ratio || "",
      format: input.format || "",
      outputDir,
    },
    { outputDir },
  );

  let files = result.files || [];
  if (files.length === 0 && Array.isArray(result.urls) && result.urls.length > 0) {
    files = await downloadUrls(result.urls, outputDir, "video");
  }
  if (files.length === 0) {
    throw new Error("video runtime produced no files");
  }

  const items = [];
  if (ctx.sessionPath) {
    for (const filePath of files) {
      const staged = ctx.stageFile({
        sessionPath: ctx.sessionPath,
        filePath,
        label: path.basename(filePath),
      });
      items.push(staged.mediaItem);
    }
  }

  return {
    content: [{ type: "text", text: `Generated ${files.length} video file(s).` }],
    ...(items.length > 0 ? { details: { media: { items } } } : {}),
  };
}