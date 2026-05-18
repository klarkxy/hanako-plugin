# Agent Fission

[中文版 →](README.md)

Agent Fission is a tool-only Hanako plugin — no UI, just one thing: **forge a real persistent agent**.

Plugin contents:

- [manifest.json](manifest.json)
- [package.json](package.json)
- [skills/agent-fission/SKILL.md](skills/agent-fission/SKILL.md)
- [tools/split-agent.js](tools/split-agent.js)
- [tests/smoke.mjs](tests/smoke.mjs)

It lets the primary agent create a Hanako agent that sticks around — not a one-off subagent that vanishes after the task.

What the tool does:

- creates a new Hanako agent through the local agents API
- keeps Hanako's default templates and layers a thin custom `identity.md` addition on top
- keeps Hanako's default templates and layers a thin custom `ishiki.md` addition on top
- optionally writes `public-ishiki.md`
- optionally downloads and sets an avatar for the new agent
- refuses to run when the caller isn't the primary agent

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
- keep `identity` and `ishiki` short and assistant-first — don't rewrite the whole files
- the overlay sits on top of Hanako's built-in defaults, so the agent stays fundamentally a helper with a light personality layer
- need an avatar? Have the primary agent search the web for a few fitting portraits or icon-style images, then pass the chosen URL through `avatarUrl`
- got the raw bytes already? Use `avatarDataUrl` instead

Debugging and testing:

- `node tests/smoke.mjs`
- set `HANA_HOME` to target a specific Hanako data directory; defaults to `~/.hanako`
- set `HANAKO_AGENT_ID` to force a specific primary agent for the test
- set `HANAKO_SMOKE_KEEP_AGENT=1` to keep the temporary test agent around for inspection

Local marketplace sync:

- Run `node scripts/update-marketplace.mjs` from the repo root, or double-click `scripts/update-marketplace.cmd` — the plugin gets incrementally written into the local marketplace file OpenHanako reads first.
- Default target: `C:\Users\<you>\.hanako\plugin-marketplace\marketplace.json`
- Want a different path? Set `HANA_PLUGIN_MARKETPLACE_FILE` or `HANA_HOME`.
- This file stays out of git — it's just for local debugging.

Example:

```json
{
	"marketplace": {
		"publisher": "klarkxy",
		"minAppVersion": "0.216.2"
	}
}
```

More notes:

- The new agent is a normal standalone Hanako agent.
- It can later have its own sessions, memory, files, and tasks.
- This plugin **does not** create runtime-only subagents.
- In `contentMode=overlay`, the plugin reads Hanako's freshly created default `identity.md`, `ishiki.md`, and `public-ishiki.md` first, then appends your short additions on top.