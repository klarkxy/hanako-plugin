import path from "node:path";
import { downloadUrls, runConfiguredRuntime } from "../lib/local-runtime.js";
import { readRuntimeConfig } from "../lib/runtime-store.js";

function createTaskId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const name = "synthesize-speech";
export const description = "Run the configured local text-to-speech runtime and return staged audio files to the current session.";

export const parameters = {
  type: "object",
  properties: {
    text: { type: "string", description: "Text to synthesize" },
    model: { type: "string", description: "Optional runtime-specific model id" },
    voice: { type: "string", description: "Optional runtime-specific voice id" },
    format: { type: "string", description: "Optional requested output format" },
  },
  required: ["text"],
};

export async function execute(input, ctx) {
  const runtimes = await readRuntimeConfig(ctx);
  const spec = runtimes.textToSpeech;
  if (!spec) {
    return "text-to-speech runtime is not configured. Use local-provider_configure-runtime first.";
  }

  const taskId = createTaskId();
  const outputDir = path.join(ctx.dataDir, "generated", `local-tts-${taskId}`);
  const result = await runConfiguredRuntime(
    spec,
    {
      prompt: input.text,
      modelId: input.model || "",
      voice: input.voice || "",
      format: input.format || "",
      outputDir,
    },
    { outputDir },
  );

  let files = result.files || [];
  if (files.length === 0 && Array.isArray(result.urls) && result.urls.length > 0) {
    files = await downloadUrls(result.urls, outputDir, "tts");
  }
  if (files.length === 0) {
    throw new Error("text-to-speech runtime produced no audio files");
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
    content: [{ type: "text", text: `Generated ${files.length} audio file(s).` }],
    ...(items.length > 0 ? { details: { media: { items } } } : {}),
  };
}