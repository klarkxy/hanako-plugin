# Agent Fission

[中文版 →](README.md)

Agent Fission is a tool-only Hanako plugin — no UI, just one thing: **forge a real persistent agent**.

It lets the primary agent create a Hanako agent that sticks around — not a one-off subagent that vanishes after the task.

| Capability | Description |
|------------|-------------|
| 🆕 Agent creation | Creates a brand-new persistent Hanako agent via the local API |
| 🧬 Identity & Ishiki | `overlay` mode preserves defaults + layers additions; `replace` mode full custom control; supports auto-filling from web search given a character name |
| 🧩 Skill assignment | Add initial enabled skills when creating an agent, and decide whether a newly installed skill should be shared with every persistent agent |
| 🌐 Public-ishiki | Optionally writes `public-ishiki.md` |
| 🖼️ Avatar | Downloads from URL or accepts a Data URL |
| 🚫 Permission guard | Refuses to run when the caller isn't the primary agent |

Installed tool name:

- `agent-fission_split_agent`
- `agent-fission_sync_agent_skills`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `name` | ✅ | Display name for the new agent |
| `identity` | ✅ | Identity content (user provides, or just a character name for auto-fill) |
| `ishiki` | ✅ | Ishiki content (same as above) |
| `id` | | Stable agent ID; auto-generated if omitted |
| `yuan` | | Base yuan template: `hanako` / `butter` / `ming` / `kong` |
| `publicIshiki` | | Optional `public-ishiki.md` content |
| `contentMode` | | `overlay` or `replace` (tool defaults to `replace`; pass explicitly when overlay is needed) |
| `avatarUrl` | | HTTP(S) URL of the avatar image |
| `avatarDataUrl` | | Data URL of the avatar (use when bytes are already in hand) |
| `enabledSkills` | | Optional initial skills to add to the new agent; existing defaults stay enabled |

Skill routing helper:

- `agent-fission_sync_agent_skills` can preview the current agent set first, then enable a skill for the agents you choose.
- Use it when a newly installed skill should be shared with every persistent agent, or when only a subset should receive it.

Character auto-fill flow (name → full background):

When the user only provides a character name or person name (instead of full identity + ishiki):
1. Use web_search to gather the character's background info, traits, and setting
2. Draft a preliminary identity.md and ishiki.md for the user to review
3. Let the user confirm or request changes before calling the tool

When the user provides a complete description, respect their text and call the tool directly.

Recommended calling pattern:

- `contentMode=overlay` for light add-ons; `contentMode=replace` for full OC personas or characters with rich lore — "concise" is an overlay guideline, not a general restriction
- note the tool defaults to `replace` — pass `contentMode: "overlay"` explicitly when you need overlay
- keep `identity` and `ishiki` focused on what makes this agent distinct — no length or style restrictions
- fan-made characters, OC personas, and literary agents are all fair game — build the tone the user wants

Skill-aware creation:

- When a new agent needs known capabilities from day one, pass those skill names through `enabledSkills` so the new agent keeps its default skills and gains the extra ones.
- When a skill has just been installed and might fit more than one persistent agent, preview the agent list first, then decide whether to enable it everywhere or only on matching agents.
- Do not silently promote private learned skills into every agent; only distribute when the skill is truly shared or the user asked for it.

Avatar workflow (priority order):

1. **web search** — search image sources (e.g. anime art galleries) for candidate URLs
2. **image-gen fallback** — if web search yields no usable images, generate 4~6 candidate avatars
3. **ask the user** — if both fail, ask the user to provide an image URL or a local file path
- present candidates and let the user pick; if none work, ask for another round or their own image
- once the user picks one, **handle cropping yourself** — don't ask the user to do it
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
- `contentMode=overlay` reads Hanako defaults + layers additions; `contentMode=replace` writes from scratch — ideal for full OC personas.