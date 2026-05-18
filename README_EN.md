# Hanako Plugins

Chinese: [README.md](README.md)

This repository is organized by plugin. Each plugin lives in its own top-level folder.

Current plugins:

- [agent-fission](agent-fission/README.md): creates a persistent Hanako agent with its own identity, ishiki, and optional public-ishiki.

Repository-level references:

- [PLUGIN_CREATION_WORKFLOW.md](PLUGIN_CREATION_WORKFLOW.md): implementation notes and workflow references for building Hanako plugins.
- [scripts/update-marketplace.mjs](scripts/update-marketplace.mjs): one-click incremental sync into the local OpenHanako marketplace file.
- [scripts/release.mjs](scripts/release.mjs): plan, check, smoke, and sync helpers for debugging.

Common commands:

- `node scripts/release.mjs check --plugin agent-fission --smoke`
- `node scripts/update-marketplace.mjs`
- `scripts/update-marketplace.cmd`
- `node scripts/release.mjs plan`

Local marketplace config:

- The script writes to `C:\Users\<you>\.hanako\plugin-marketplace\marketplace.json` by default, matching OpenHanako's local marketplace lookup.
- Override the target file with `HANA_PLUGIN_MARKETPLACE_FILE`, or change the Hanako home directory with `HANA_HOME`.
- Keep any local settings outside git; this file is only for your machine's marketplace index.

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

- `update-marketplace` only syncs a local marketplace file; it does not use GitHub Releases.
- It writes the current repo's plugin entries into the same local marketplace file that OpenHanako reads first.
- If there is nothing new to publish, the script exits without changing the marketplace.
- New plugins should be added as new top-level folders, each with its own `manifest.json`, `package.json`, `skills/`, `tools/`, and optional `tests/`.