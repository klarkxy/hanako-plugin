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
- identity: the agent's identity content; overlay mode keeps it concise, replace mode allows full control
- ishiki: the agent's ishiki content; same overlay/replace logic applies
- optional publicIshiki: public-facing content when needed
- optional contentMode: prefer overlay so Hanako's built-in default templates stay in place
- optional avatarUrl: a reachable http/https png/jpg/webp image URL; see avatar workflow below
- optional avatarDataUrl: use this only when you already have the image bytes

Golden rules:

- only the primary agent may create another persistent agent
- the tool spawns a normal Hanako agent, not a runtime subagent
- default to `contentMode=overlay` unless the user explicitly wants fully custom files
- in overlay mode, keep identity and ishiki focused on what makes this agent distinct
- fan-made characters, OC personas, and literary agents are all fair game — build the tone the user wants

Avatar workflow:
- when the user wants an avatar but hasn't provided one, quickly grab 3-5 candidate images and present them for the user to choose from
- don't spend time trying to find the perfect match — show options fast, let the user decide
- if none work, ask if they want to continue searching, or provide their own image
- once the user picks an image, let them handle cropping themselves, or use available image editing tools to do it on request
- prefer simple headshots or icon avatars that read well at small sizes, but follow the user's preference