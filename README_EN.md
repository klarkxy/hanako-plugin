# Hanako Plugins

[中文版 →](README.md)

Each plugin gets its own cozy top-level folder in this repo.

Current residents:

- [agent-fission](agent-fission/README.md) — creates a persistent Hanako agent with its own identity, ishiki, and optional public-ishiki.

Repo-level references:

- [PLUGIN_CREATION_WORKFLOW.md](PLUGIN_CREATION_WORKFLOW.md): end-to-end plugin creation workflow and implementation notes.

Notes:

- Adding a new plugin? Just drop a new top-level folder. Each plugin keeps its own `manifest.json`, `package.json`, `skills/`, `tools/`, and optionally `tests/`.