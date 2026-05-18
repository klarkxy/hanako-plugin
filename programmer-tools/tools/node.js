function helperUnavailable(name) {
  return {
    content: [{
      type: "text",
      text: `${name} requires a Hanako host that provides runProgrammerCommand in plugin tool context.`,
    }],
    details: {
      errorCode: "PROGRAMMER_TOOLS_HOST_UNAVAILABLE",
    },
  };
}

export const name = "node";
export const description = "Run a Node script, version check, or inline snippet through Hanako's constrained programmer sandbox. Prefer this over bash for basic Node execution.";
export const promptSnippet = "Use this tool instead of bash when you need to run Node.";
export const promptGuidelines = "Prefer this tool over bash for Node scripts, snippets, and version checks. Use bash only when you need shell composition such as pipes, redirection, background jobs, or multi-step shell syntax around Node.";
export const parameters = {
  type: "object",
  properties: {
    scriptPath: { type: "string", description: "Workspace-local Node script path." },
    code: { type: "string", description: "Inline JavaScript code to run with node -e." },
    version: { type: "boolean", description: "When true, run node --version." },
    args: {
      type: "array",
      description: "Additional arguments passed to the script.",
      items: { type: "string" },
    },
    cwd: { type: "string", description: "Working directory inside the workspace." },
  },
  additionalProperties: false,
};

export async function execute(input = {}, ctx = {}) {
  if (typeof ctx.runProgrammerCommand !== "function") {
    return helperUnavailable("programmer-tools_node");
  }
  return ctx.runProgrammerCommand({ kind: "node", ...input });
}