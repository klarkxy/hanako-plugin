# Programmer Tools

Programmer Tools is a tool-only Hanako plugin.

It gives the agent a narrow, safer programmer-facing command surface so it can prefer structured Python, Node, and simple HTTP operations instead of falling back to raw `bash`.

The first version only exposes:

- `programmer-tools_python`
- `programmer-tools_node`
- `programmer-tools_http_request`

These tools rely on a host-provided constrained execution helper:

- always forced through the sandbox execution path
- Python / Node run with network disabled by default
- HTTP requests get a narrowly enabled public-network path
- working directories, script paths, and download targets must stay inside the workspace

Current smoke tests only verify exports and helper forwarding; they do not require a live Hanako instance.