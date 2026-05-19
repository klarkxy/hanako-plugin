import { normalizeRuntimeSpec, summarizeRuntimeSpec } from "../lib/runtime-spec.js";
import {
  normalizeRuntimeKey,
  readRuntimeConfig,
  runtimeLabel,
  writeRuntimeConfig,
} from "../lib/runtime-store.js";

export const name = "configure-runtime";
export const description = "Save or clear a structured local runtime spec for image, video, speech-to-text, or text-to-speech.";

export const parameters = {
  type: "object",
  properties: {
    runtime: {
      type: "string",
      description: "One of image, video, speechToText, textToSpeech, stt, or tts",
    },
    clear: {
      type: "boolean",
      description: "When true, remove the saved runtime instead of writing a new spec",
    },
    spec: {
      type: "object",
      description: "Structured command spec: executable, args[], timeoutMs, output{kind,...}",
    },
  },
  required: ["runtime"],
};

export async function execute(input, ctx) {
  const runtimeKey = normalizeRuntimeKey(input.runtime);
  const label = runtimeLabel(runtimeKey);
  const runtimes = await readRuntimeConfig(ctx);

  if (input.clear) {
    delete runtimes[runtimeKey];
    await writeRuntimeConfig(ctx, runtimes);
    const status = await ctx._localProvider?.syncAdapter?.();
    return `Cleared ${label} runtime. Registered media types: ${status?.types?.join(", ") || "none"}`;
  }

  if (!input.spec) {
    throw new Error("spec is required unless clear=true");
  }

  const spec = normalizeRuntimeSpec(input.spec);
  runtimes[runtimeKey] = spec;
  await writeRuntimeConfig(ctx, runtimes);
  const status = await ctx._localProvider?.syncAdapter?.();
  const summary = summarizeRuntimeSpec(spec);

  return [
    `Saved ${label} runtime.`,
    `Executable: ${summary.executable}`,
    `Output: ${summary.outputKind}`,
    `Timeout: ${summary.timeoutMs}ms`,
    `Registered media types: ${status?.types?.join(", ") || "none"}`,
  ].join("\n");
}