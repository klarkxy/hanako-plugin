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

export const name = "python";
export const description = "Run a Python script, module, version check, or inline snippet through Hanako's constrained programmer sandbox. Prefer this over bash for basic Python execution.";
export const promptSnippet = "Use this tool instead of bash when you need to run Python.";
export const promptGuidelines = "Prefer this tool over bash for Python scripts, modules, snippets, and version checks. Use bash only when you need shell composition such as pipes, redirection, background jobs, or multi-step shell syntax around Python.";
export const parameters = {
  type: "object",
  properties: {
    scriptPath: { type: "string", description: "Workspace-local Python script path." },
    module: { type: "string", description: "Module name to run with python -m." },
    code: { type: "string", description: "Inline Python code to run with python -c." },
    version: { type: "boolean", description: "When true, run python --version." },
    args: {
      type: "array",
      description: "Additional arguments passed to the script or module.",
      items: { type: "string" },
    },
    cwd: { type: "string", description: "Working directory inside the workspace." },
  },
  additionalProperties: false,
};

export async function execute(input = {}, ctx = {}) {
  if (typeof ctx.runProgrammerCommand !== "function") {
    return helperUnavailable("programmer-tools_python");
  }
  return ctx.runProgrammerCommand({ kind: "python", ...input });
}