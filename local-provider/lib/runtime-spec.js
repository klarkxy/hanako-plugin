const VALID_BINDING_SOURCES = new Set([
  "prompt",
  "modelId",
  "inputFile",
  "outputDir",
  "size",
  "duration",
  "ratio",
  "format",
  "voice",
  "language",
]);

const VALID_OUTPUT_KINDS = new Set(["file_glob", "json_stdout", "url_stdout", "text_stdout"]);

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function validateRuntimeSpec(spec) {
  if (!isPlainObject(spec)) {
    throw new Error("runtime spec must be an object");
  }
  if (typeof spec.executable !== "string" || !spec.executable.trim()) {
    throw new Error("runtime spec requires executable");
  }
  if (!Array.isArray(spec.args)) {
    throw new Error("runtime spec requires args");
  }
  for (const arg of spec.args) {
    if (!isPlainObject(arg)) {
      throw new Error("runtime args must be objects");
    }
    const hasLiteral = Object.prototype.hasOwnProperty.call(arg, "literal");
    const hasOption = Object.prototype.hasOwnProperty.call(arg, "option");
    if (hasLiteral === hasOption) {
      throw new Error("runtime arg must contain exactly one of literal or option");
    }
    if (hasLiteral && typeof arg.literal !== "string") {
      throw new Error("runtime literal arg must be a string");
    }
    if (hasOption) {
      if (typeof arg.option !== "string" || !arg.option.trim()) {
        throw new Error("runtime option arg requires option");
      }
      if (!VALID_BINDING_SOURCES.has(arg.from)) {
        throw new Error(`unsupported binding source \"${arg.from}\"`);
      }
    }
  }
  const timeoutMs = Number(spec.timeoutMs);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("runtime spec requires positive timeoutMs");
  }
  if (!isPlainObject(spec.output) || !VALID_OUTPUT_KINDS.has(spec.output.kind)) {
    throw new Error("runtime spec requires a supported output contract");
  }
  return spec;
}

export function normalizeRuntimeSpec(spec) {
  validateRuntimeSpec(spec);
  return JSON.parse(JSON.stringify(spec));
}

export function buildArgs(spec, bindings = {}) {
  validateRuntimeSpec(spec);
  const args = [];
  for (const arg of spec.args) {
    if (Object.prototype.hasOwnProperty.call(arg, "literal")) {
      args.push(arg.literal);
      continue;
    }
    const value = bindings[arg.from];
    if (value === undefined || value === null || value === "") continue;
    args.push(arg.option, String(value));
  }
  return args;
}

export function summarizeRuntimeSpec(spec) {
  validateRuntimeSpec(spec);
  return {
    executable: spec.executable,
    timeoutMs: spec.timeoutMs,
    outputKind: spec.output.kind,
    argCount: spec.args.length,
  };
}