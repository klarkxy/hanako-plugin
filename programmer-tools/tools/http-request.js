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

export const name = "http_request";
export const description = "Perform a constrained public HTTP GET or HEAD request, or download a file into the workspace. Prefer this over direct bash curl or wget for simple requests.";
export const promptSnippet = "Use this tool instead of bash curl/wget when you need a simple HTTP request or workspace download.";
export const promptGuidelines = "Prefer this tool over bash for simple public HTTP GET, HEAD, and file download tasks. Use bash only when you need shell-specific HTTP flows that this structured tool cannot express.";
export const parameters = {
  type: "object",
  properties: {
    url: { type: "string", description: "Public http or https URL." },
    method: { type: "string", description: "GET or HEAD. Defaults to GET." },
    headers: {
      type: "object",
      description: "Optional extra request headers.",
      additionalProperties: { type: "string" },
    },
    saveTo: { type: "string", description: "Workspace-local output path for downloads." },
    followRedirects: { type: "boolean", description: "Whether to follow redirects. Defaults to true." },
    cwd: { type: "string", description: "Working directory inside the workspace." },
  },
  required: ["url"],
  additionalProperties: false,
};

export async function execute(input = {}, ctx = {}) {
  if (typeof ctx.runProgrammerCommand !== "function") {
    return helperUnavailable("programmer-tools_http_request");
  }
  return ctx.runProgrammerCommand({ kind: "http", ...input });
}