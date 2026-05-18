# Agent Fission

[中文版 →](README.md)

Agent Fission is a tool-only Hanako plugin — no UI, just one thing: **forge a real persistent agent**.

It lets the primary agent create a Hanako agent that sticks around — not a one-off subagent that vanishes after the task.

| Capability | Description |
|------------|-------------|
| 🆕 Agent creation | Creates a brand-new persistent Hanako agent via the local API |
| 🧬 Identity overlay | Preserves defaults + layers a thin `identity.md` |
| 🧠 Ishiki overlay | Preserves defaults + layers a thin `ishiki.md` |
| 🌐 Public-ishiki | Optionally writes `public-ishiki.md` |
| 🖼️ Avatar | Downloads from URL or accepts a Data URL |
| 🚫 Permission guard | Refuses to run when the caller isn't the primary agent |

Installed tool name:

- `agent-fission_split_agent`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `name` | ✅ | Display name for the new agent |
| `identity` | ✅ | `identity.md` content or overlay |
| `ishiki` | ✅ | `ishiki.md` content or overlay |
| `id` | | Stable agent ID; auto-generated if omitted |
| `yuan` | | Base yuan template: `hanako` / `butter` / `ming` / `kong` |
| `publicIshiki` | | Optional `public-ishiki.md` content |
| `contentMode` | | `overlay` (recommended) or `replace` |
| `avatarUrl` | | HTTP(S) URL of the avatar image |
| `avatarDataUrl` | | Data URL of the avatar (use when bytes are already in hand) |

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

More notes:

- The new agent is a normal standalone Hanako agent.
- It can later have its own sessions, memory, files, and tasks.
- This plugin **does not** create runtime-only subagents.
- In `contentMode=overlay`, the plugin reads Hanako's freshly created default `identity.md`, `ishiki.md`, and `public-ishiki.md` first, then appends your short additions on top.