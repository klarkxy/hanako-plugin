import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildArgs, validateRuntimeSpec } from "./runtime-spec.js";

const execFileAsync = promisify(execFile);

function globToMatcher(pattern) {
  if (!pattern || pattern === "*") return () => true;
  const brace = pattern.match(/^\*\.{(.+)}$/);
  if (brace) {
    const exts = new Set(
      brace[1]
        .split(",")
        .map((ext) => ext.trim().toLowerCase())
        .filter(Boolean),
    );
    return (filename) => exts.has(path.extname(filename).slice(1).toLowerCase());
  }
  if (pattern.startsWith("*.")) {
    const ext = pattern.slice(2).toLowerCase();
    return (filename) => path.extname(filename).slice(1).toLowerCase() === ext;
  }
  return (filename) => filename === pattern;
}

function collectFileGlob(outputDir, pattern) {
  const matcher = globToMatcher(pattern);
  return fs
    .readdirSync(outputDir)
    .filter((name) => matcher(name))
    .map((name) => path.join(outputDir, name))
    .sort();
}

function parseJsonPath(value, pathExpr) {
  const parts = String(pathExpr || "").split(".").filter(Boolean);
  let current = value;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function normalizeResolvedPaths(value, outputDir) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : [value];
  return items
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .map((item) => (path.isAbsolute(item) ? item : path.join(outputDir, item)));
}

function normalizeResolvedUrls(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : [value];
  return items.map((item) => String(item || "").trim()).filter(Boolean);
}

function resolveTextValue(value, outputDir) {
  if (typeof value !== "string") return value == null ? "" : String(value);
  const trimmed = value.trim();
  if (!trimmed) return "";
  const candidate = path.isAbsolute(trimmed) ? trimmed : path.join(outputDir, trimmed);
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return fs.readFileSync(candidate, "utf8");
  }
  return value;
}

function inferExtension(url, contentType) {
  const type = String(contentType || "").toLowerCase();
  if (type.includes("image/png")) return ".png";
  if (type.includes("image/webp")) return ".webp";
  if (type.includes("image/jpeg")) return ".jpg";
  if (type.includes("video/mp4")) return ".mp4";
  if (type.includes("video/webm")) return ".webm";
  if (type.includes("audio/mpeg")) return ".mp3";
  if (type.includes("audio/wav")) return ".wav";
  if (type.includes("audio/flac")) return ".flac";
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname);
    return ext || ".bin";
  } catch {
    return ".bin";
  }
}

export async function downloadUrls(urls, outputDir, filePrefix = "download") {
  fs.mkdirSync(outputDir, { recursive: true });
  const files = [];
  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) {
      throw new Error(`failed to download ${url}: HTTP ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const extension = inferExtension(url, response.headers.get("content-type"));
    const filePath = path.join(outputDir, `${filePrefix}-${index + 1}${extension}`);
    fs.writeFileSync(filePath, buffer);
    files.push(filePath);
  }
  return files;
}

export async function runConfiguredRuntime(spec, bindings = {}, options = {}) {
  validateRuntimeSpec(spec);
  const outputDir = bindings.outputDir || options.outputDir;
  if (!outputDir) {
    throw new Error("configured runtime requires outputDir");
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const args = buildArgs(spec, { ...bindings, outputDir });
  const execOptions = {
    cwd: options.cwd || outputDir,
    timeout: spec.timeoutMs,
    shell: false,
    env: { ...process.env, ...(spec.env || {}), ...(options.env || {}) },
    maxBuffer: options.maxBuffer || 20 * 1024 * 1024,
  };

  const { stdout, stderr } = await execFileAsync(spec.executable, args, execOptions);

  if (spec.output.kind === "file_glob") {
    return {
      files: collectFileGlob(outputDir, spec.output.pattern),
      urls: [],
      text: "",
      data: null,
      stdout,
      stderr,
    };
  }

  if (spec.output.kind === "url_stdout") {
    return {
      files: [],
      urls: stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
      text: "",
      data: null,
      stdout,
      stderr,
    };
  }

  if (spec.output.kind === "text_stdout") {
    return {
      files: [],
      urls: [],
      text: String(stdout || "").trim(),
      data: null,
      stdout,
      stderr,
    };
  }

  const data = JSON.parse(stdout || "{}");
  return {
    files: normalizeResolvedPaths(parseJsonPath(data, spec.output.filesPath), outputDir),
    urls: normalizeResolvedUrls(parseJsonPath(data, spec.output.urlsPath), outputDir),
    text: resolveTextValue(parseJsonPath(data, spec.output.textPath), outputDir),
    data,
    stdout,
    stderr,
  };
}