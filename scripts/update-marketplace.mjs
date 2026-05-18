#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const releaseScript = path.join(scriptDir, "release.mjs");
const result = spawnSync(process.execPath, [releaseScript, "sync", ...process.argv.slice(2)], {
  cwd: path.resolve(scriptDir, ".."),
  encoding: "utf8",
  stdio: "inherit",
});

process.exit(result.status ?? 1);