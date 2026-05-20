# Hanako Plugins

[中文版 →](README.md)

Each plugin gets its own cozy top-level folder in this repo.

Current residents:

- [agent-fission](agent-fission/README.md) — creates a persistent Hanako agent with its own identity, ishiki, and optional public-ishiki.
- [roleplay](roleplay/README_EN.md)
- [opencode-provider](opencode-provider/README_EN.md) — integrates OpenCode Zen (pay-as-you-go full-series models) and OpenCode Go (subscription-based curated open-source models). — a conversation skill plugin for deep in-character roleplay with guided scene continuation, activated by prompts like "开启扮演模式".

Repo-level references:

- [PLUGIN_CREATION_WORKFLOW.md](PLUGIN_CREATION_WORKFLOW.md): end-to-end plugin creation workflow and implementation notes.

Repo-level tools:

- [scripts/package-test.cmd](scripts/package-test.cmd): double-click for a test package without bumping versions.
- [scripts/package-generate.cmd](scripts/package-generate.cmd): double-click to generate the release package, bump versions when needed, and auto-commit plus push one repo-level release tag.
- [.github/workflows/release.yml](.github/workflows/release.yml): push a `release-YYYYMMDD-HHMMSS-mmm` style tag to package every plugin zip and create a single GitHub Release automatically.

Notes:

- Adding a new plugin? Just drop a new top-level folder. Each plugin keeps its own `manifest.json`, `package.json`, `skills/`, `tools/`, and optionally `tests/`.