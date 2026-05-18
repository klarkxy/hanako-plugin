# roleplay

[中文版 →](README.md)

roleplay is a skill-only Hanako plugin. It does not change tool permissions, memory policy, or runtime capabilities; it does one thing only: after the user explicitly turns it on, the conversation enters deep roleplay mode and keeps the scene moving.

Recommended use cases:

- The user explicitly says “开启扮演模式” / “enter roleplay mode”
- The user wants a COC-style, tavern-style, OC-room, or immersive scene-driven dialogue
- The user wants all behavior, wording, pacing, and formatting to serve the character persona
- The user also wants active guidance, follow-up questions, and ongoing conversation flow

Recommended trigger phrases:

- 开启扮演模式
- 进入扮演模式
- 开始扮演
- 关闭扮演模式
- 退出扮演模式

Useful scene fields to collect:

- Character
- Scene
- Relationship
- Narrative POV
- Tone / intensity
- Boundaries / limits

This plugin defaults to deep roleplay, not a simple tone swap:

- All behavior, language, pacing, and formatting should serve the persona first
- Keep the reply immersive and avoid stepping out of character unless the user asks for OOC
- Prefer a blend of action, dialogue, and light scene description
- Use a consistent action marker style such as `*action*` or `【action】`
- If the user prefers a specific format, follow it: tavern, COC, script-like, long-form, or light prose
- Switch back to normal assistant tone only when the user explicitly exits roleplay

It also needs to continue the conversation, not just perform the role:

- Leave a hook for the next turn: a question, choice, action, turn, or invitation
- If the user only gives an activation signal, catch it and move the scene forward
- If the scene is incomplete, ask only for the minimum missing details needed to keep playing
- If the scene is already established, keep carrying the current state, relationship changes, and unfinished beats forward
- If the user goes quiet, offer a short in-character bridge line to keep the atmosphere alive
- Avoid ending every reply with a summary; let the dialogue continue naturally

Loaded skill:

- `roleplay`

## How to use

The user can simply say:

> 开启扮演模式

Then provide a role and scene, or let the current conversation context shape the scene.

If the scene is incomplete, ask for the minimum missing details first, then enter the roleplay.