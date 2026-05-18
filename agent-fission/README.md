# Agent Fission

Agent Fission is a tool-only Hanako plugin.

This plugin lives in [agent-fission/](.) and its implementation is split across:

- [manifest.json](manifest.json)
- [package.json](package.json)
- [skills/agent-fission/SKILL.md](skills/agent-fission/SKILL.md)
- [tools/split-agent.js](tools/split-agent.js)

It lets the primary agent create a real persistent agent, not a temporary runtime subagent.

What the tool does:

- creates a new Hanako agent through the local agents API
- writes a custom identity.md
- writes a custom ishiki.md
- optionally writes public-ishiki.md
- refuses to run when the caller is not the primary agent

Installed tool name:

- agent-fission_split_agent

Required parameters:

- name
- identity
- ishiki

Optional parameters:

- id
- yuan
- publicIshiki

Notes:

- The new agent is a normal standalone Hanako agent.
- It can later have its own sessions, memory, files, and tasks.
- This plugin does not create runtime-only subagents.