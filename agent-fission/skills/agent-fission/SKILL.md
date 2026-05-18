---
name: agent-fission
description: Use the agent-fission_split_agent tool when the user explicitly wants a new persistent Hanako agent with its own identity, soul, and avatar.
---

Use this skill only when the user wants a real standalone Hanako agent.

Do not use this tool for:

- temporary runtime delegation
- isolated one-off subagent runs
- background runs that should stay attached to the current agent

Before calling the tool, prepare:

- name: the new agent's display name
- optional id: a stable Hanako agent id
- optional yuan: one of hanako, butter, ming, kong
- identity: usually a short identity overlay, not a full character sheet
- ishiki: usually a short ishiki overlay, not a full replacement file
- optional publicIshiki: a short public-facing overlay when needed
- optional contentMode: prefer overlay so Hanako's built-in default templates stay in place
- optional avatarUrl: a reachable http/https png/jpg/webp image URL
- optional avatarDataUrl: use this only when you already have the image bytes

Important rules:

- only the primary agent may create another persistent agent
- the tool creates a normal Hanako agent, not a runtime subagent
- default to contentMode=overlay unless the user explicitly wants fully custom identity/ishiki files
- in overlay mode, keep identity and ishiki short and assistant-first; add only a thin personality layer on top of Hanako's defaults
- do not write an overbuilt roleplay setting; this is still primarily an assistant
- before choosing avatarUrl, search the web for a few fitting portraits or icon-style avatars and pick one that matches the requested tone
- prefer simple headshots, portraits, or icon avatars that read clearly at small size