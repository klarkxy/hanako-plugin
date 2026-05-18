# Agent Fission

Chinese: [README.md](README.md)

Agent Fission is a tool-only Hanako plugin.

Plugin contents:

- [manifest.json](manifest.json)
- [package.json](package.json)
- [skills/agent-fission/SKILL.md](skills/agent-fission/SKILL.md)
- [tools/split-agent.js](tools/split-agent.js)
- [tests/smoke.mjs](tests/smoke.mjs)

It lets the primary agent create a real persistent Hanako agent, not a temporary runtime subagent.

What the tool does:

- creates a new Hanako agent through the local agents API
- can keep Hanako's default templates and layer a thin custom `identity.md` addition on top
- can keep Hanako's default templates and layer a thin custom `ishiki.md` addition on top
- optionally writes `public-ishiki.md`
- can optionally download and write an avatar for the new agent
- refuses to run when the caller is not the primary agent

Installed tool name:

- `agent-fission_split_agent`

Required parameters:

- `name`
- `identity`
- `ishiki`

Optional parameters:

- `id`
- `yuan`
- `publicIshiki`
- `contentMode`
- `avatarUrl`
- `avatarDataUrl`

Recommended calling pattern:

- prefer `contentMode=overlay`
- keep `identity` and `ishiki` short and assistant-first instead of rewriting the whole files
- the overlay is added on top of Hanako's built-in default templates, so the agent stays fundamentally a helper with a light personality layer
- if the new agent needs an avatar, have the primary agent search the web for a few suitable portraits or icon-style images first, then pass the chosen image URL through `avatarUrl`
- use `avatarDataUrl` only when you already have the raw image bytes

Debugging and testing:

- `node tests/smoke.mjs`
- set `HANA_HOME` to target a specific Hanako data directory; the default is `~/.hanako`
- set `HANAKO_AGENT_ID` to force a specific primary agent for the smoke test
- set `HANAKO_SMOKE_KEEP_AGENT=1` to keep the temporary test agent for inspection

Local marketplace sync:

- Run `node scripts/update-marketplace.mjs` from the repo root, or double-click `scripts/update-marketplace.cmd`, to incrementally write this plugin into the local marketplace file that OpenHanako reads first.
- The default target is `C:\Users\<you>\.hanako\plugin-marketplace\marketplace.json`.
- Override it with `HANA_PLUGIN_MARKETPLACE_FILE`, or change the Hanako home directory with `HANA_HOME`.

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

- The new agent is a normal standalone Hanako agent.
- It can later have its own sessions, memory, files, and tasks.
- This plugin does not create runtime-only subagents.
- In `contentMode=overlay`, the plugin reads the freshly created default `identity.md`, `ishiki.md`, and `public-ishiki.md` from Hanako first, then appends the supplied short additions.