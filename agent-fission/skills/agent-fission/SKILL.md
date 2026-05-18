---
name: agent-fission
description: Use the agent-fission_split_agent tool when the user explicitly wants a new persistent Hanako agent with its own identity and soul.
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
- identity: the new agent's intro, role, and public-facing persona
- ishiki: the new agent's deep core, soul, and internal rules
- optional publicIshiki: a lighter external-facing consciousness file

Important rules:

- only the primary agent may create another persistent agent
- the tool creates a normal Hanako agent, not a runtime subagent
- identity and ishiki should be fully written before the tool is called