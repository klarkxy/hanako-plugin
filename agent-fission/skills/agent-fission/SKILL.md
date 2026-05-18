---
name: agent-fission
description: Use the agent-fission_split_agent tool when the user explicitly wants a new persistent Hanako agent with its own identity, soul, and avatar.
---

Activate this skill only when the user wants a real standalone Hanako agent — one that lives on after the conversation ends.

Steer clear when the request is about:

- a temporary runtime sidekick
- an isolated one-off subagent run
- a background task that should stay tethered to the current agent

Character auto-fill flow（角色自动补充流程）:

When the user only provides a character name or person name (instead of full identity + ishiki content):
1. Use web_search to gather background info, traits, and setting for that character
2. Draft a preliminary identity.md and ishiki.md, then present them to the user for review
3. Let the user confirm or request changes before calling the tool

When the user provides a complete description, respect their text and call the tool directly.

When the character has rich lore and the user wants it fully represented, use `contentMode=replace` — don't feel constrained by overlay's "concise" guidance.

Before calling the tool, prepare:

- name: the new agent's display name
- optional id: a stable Hanako agent id
- optional yuan: one of hanako, butter, ming, kong
- identity: the agent's identity content; overlay mode keeps it concise, replace mode allows full control
- ishiki: the agent's ishiki content; same overlay/replace logic applies
- optional publicIshiki: public-facing content when needed
- optional contentMode: pass "overlay" to layer on top of Hanako's default templates (recommended); pass "replace" for full custom control. Default is "replace" in the tool, so pass explicitly when you need overlay.
- optional avatarUrl: a reachable http/https png/jpg/webp image URL; see avatar workflow below
- optional avatarDataUrl: use this only when you already have the image bytes

Golden rules:

- only the primary agent may create another persistent agent
- the tool spawns a normal Hanako agent, not a runtime subagent
- prefer `contentMode=overlay` for light add-ons; use `contentMode=replace` for full OC personas or characters with rich lore — the "concise" guideline is for overlay only, not a general restriction
- in overlay mode, keep identity and ishiki focused on what makes this agent distinct; in replace mode, write freely
- the tool defaults to "replace", so pass `contentMode: "overlay"` explicitly when you need overlay
- fan-made characters, OC personas, and literary agents are all fair game — build the tone the user wants

Avatar workflow:
- when the user wants an avatar but hasn't provided one, follow this priority to get candidates:
  1. **web search first** — search suitable image sources (e.g. anime art galleries, character image sites) for candidate URLs
  2. **image-gen as fallback** — if web search yields no usable images, generate 4~6 candidate avatars
  3. **ask the user** — if both fail, ask the user to provide an image URL or a local file path
- don't spend time trying to find the perfect match — show options fast, let the user decide
- if none of the candidates work, ask if they want another round or to provide their own image
- once the user picks an image, **handle cropping yourself** — don't ask the user to do it
- prefer simple headshots or icon avatars that read well at small sizes, but follow the user's preference