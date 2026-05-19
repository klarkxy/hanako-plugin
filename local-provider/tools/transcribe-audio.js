import fs from "node:fs";
import path from "node:path";
import { runConfiguredRuntime } from "../lib/local-runtime.js";
import { readRuntimeConfig } from "../lib/runtime-store.js";

function createTaskId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const name = "transcribe-audio";
export const description = "Run the configured local speech-to-text runtime against an audio file and optionally stage the transcript into the current session.";

export const parameters = {
  type: "object",
  properties: {
    audioPath: { type: "string", description: "Absolute path to the source audio file" },
    model: { type: "string", description: "Optional runtime-specific model id" },
    prompt: { type: "string", description: "Optional transcription hint or context" },
    language: { type: "string", description: "Optional language hint" },
    saveTranscript: { type: "boolean", description: "When true, stage transcript.txt into the current session if one exists" },
  },
  required: ["audioPath"],
};

export async function execute(input, ctx) {
  const runtimes = await readRuntimeConfig(ctx);
  const spec = runtimes.speechToText;
  if (!spec) {
    return "speech-to-text runtime is not configured. Use local-provider_configure-runtime first.";
  }

  const taskId = createTaskId();
  const outputDir = path.join(ctx.dataDir, "generated", `local-stt-${taskId}`);
  const result = await runConfiguredRuntime(
    spec,
    {
      inputFile: input.audioPath,
      modelId: input.model || "",
      prompt: input.prompt || "",
      language: input.language || "",
      outputDir,
    },
    { outputDir },
  );

  const transcript = String(result.text || "").trim();
  if (!transcript) {
    throw new Error("speech-to-text runtime produced no transcript text");
  }

  const response = { content: [{ type: "text", text: transcript }] };
  if (ctx.sessionPath && input.saveTranscript !== false) {
    fs.mkdirSync(outputDir, { recursive: true });
    const transcriptPath = path.join(outputDir, "transcript.txt");
    fs.writeFileSync(transcriptPath, transcript, "utf8");
    const staged = ctx.stageFile({
      sessionPath: ctx.sessionPath,
      filePath: transcriptPath,
      label: "transcript.txt",
    });
    response.details = { media: { items: [staged.mediaItem] } };
  }
  return response;
}