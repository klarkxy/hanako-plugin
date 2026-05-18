---
name: agent-fission
description: Use the agent-fission_split_agent tool when the user explicitly wants a new persistent Hanako agent with its own identity, soul, and avatar.
---

Activate this skill only when the user wants a real standalone Hanako agent — one that lives on after the conversation ends.

Steer clear when the request is about:

- a temporary runtime sidekick
- an isolated one-off subagent run
- a background task that should stay tethered to the current agent

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

Golden rules:

- only the primary agent may create another persistent agent
- the tool spawns a normal Hanako agent, not a runtime subagent
- default to `contentMode=overlay` unless the user explicitly wants fully custom files
- in overlay mode, keep identity and ishiki short and assistant-first — a thin personality finish, not a full rewrite
- don't overbuild a roleplay setting; this is still an assistant at heart
- before picking an avatarUrl, search the web for a few fitting portraits or icon-style images and choose one that matches the tone
- prefer simple headshots or icon avatars that read well at small sizes