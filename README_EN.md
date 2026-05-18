# Hanako Plugins

[中文版 →](README.md)

Each plugin gets its own cozy top-level folder in this repo.

Current residents:

- [agent-fission](agent-fission/README.md) — creates a persistent Hanako agent with its own identity, ishiki, and optional public-ishiki.

Repo-level references:

- [PLUGIN_CREATION_WORKFLOW.md](PLUGIN_CREATION_WORKFLOW.md): end-to-end plugin creation workflow and implementation notes.
- [scripts/update-marketplace.mjs](scripts/update-marketplace.mjs): one-click incremental sync to the local OpenHanako marketplace file.
- [scripts/release.mjs](scripts/release.mjs): plan, check, smoke, and sync helpers for debugging.

Common commands:

- `node scripts/release.mjs check --plugin agent-fission --smoke`
- `node scripts/update-marketplace.mjs`
- `scripts/update-marketplace.cmd`
- `node scripts/release.mjs plan`

Local marketplace setup:

- Writes to `C:\Users\<you>\.hanako\plugin-marketplace\marketplace.json` by default — the same path OpenHanako uses.
- Change the target file with `HANA_PLUGIN_MARKETPLACE_FILE`, or point `HANA_HOME` to a different Hanako data directory.
- This file stays out of git — it's just for your local debugging index.

Example:

```json
{
	"marketplace": {
		"publisher": "klarkxy",
		"minAppVersion": "0.216.2"
	}
}
```

Notes:

- `update-marketplace` syncs a local marketplace file only — no GitHub Releases involved.
- It writes the repo's plugin entries into the marketplace.json that OpenHanako looks at, so the next refresh picks them up.
- No new versions to publish? The script exits and doesn't touch a thing.
- Adding a new plugin? Just drop a new top-level folder. Each plugin keeps its own `manifest.json`, `package.json`, `skills/`, `tools/`, and optionally `tests/`.