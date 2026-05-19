export const DEFAULT_LM_STUDIO_BASE_URL = "http://127.0.0.1:1234/v1";

const RUNTIME_KEYS = ["image", "video", "speechToText", "textToSpeech"];
const RUNTIME_LABELS = {
  image: "image",
  video: "video",
  speechToText: "speech-to-text",
  textToSpeech: "text-to-speech",
};

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function normalizeRuntimeKey(value) {
  const normalized = String(value || "").trim();
  const aliases = {
    image: "image",
    video: "video",
    stt: "speechToText",
    speechToText: "speechToText",
    speech_to_text: "speechToText",
    transcribe: "speechToText",
    tts: "textToSpeech",
    textToSpeech: "textToSpeech",
    text_to_speech: "textToSpeech",
    synthesize: "textToSpeech",
  };
  const key = aliases[normalized];
  if (!key) {
    throw new Error(`unknown runtime key \"${value}\"`);
  }
  return key;
}

export async function readRuntimeConfig(ctx) {
  const raw = await ctx.config.get("runtimes");
  if (!isPlainObject(raw)) return {};
  const next = {};
  for (const key of RUNTIME_KEYS) {
    if (isPlainObject(raw[key])) next[key] = raw[key];
  }
  return next;
}

export async function writeRuntimeConfig(ctx, runtimes) {
  await ctx.config.set("runtimes", runtimes || {});
  return runtimes || {};
}

export function getConfiguredMediaTypes(runtimes = {}) {
  const types = [];
  if (runtimes.image) types.push("image");
  return types;
}

export function runtimeLabel(runtimeKey) {
  return RUNTIME_LABELS[runtimeKey] || runtimeKey;
}

export function summarizeRuntimeConfig(runtimes = {}) {
  const summary = {};
  for (const key of RUNTIME_KEYS) {
    const spec = runtimes[key];
    summary[key] = spec
      ? {
          configured: true,
          executable: spec.executable,
          outputKind: spec.output?.kind || null,
          timeoutMs: spec.timeoutMs || null,
        }
      : {
          configured: false,
          executable: null,
          outputKind: null,
          timeoutMs: null,
        };
  }
  return summary;
}