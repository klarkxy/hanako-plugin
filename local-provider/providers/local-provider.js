export const id = "local-provider";
export const displayName = "Local Provider (LM Studio)";
export const authType = "none";
export const defaultBaseUrl = "http://127.0.0.1:1234/v1";
export const defaultApi = "openai-completions";
export const runtime = { kind: "plugin" };

export const capabilities = {
  chat: {
    runtimeProviderId: "local-provider",
    displayProviderId: "local-provider",
    projection: "models-json",
    allowListSource: "provider.models",
  },
  media: {
    imageGeneration: {
      defaultModelId: "local-image",
      models: [
        {
          id: "local-image",
          displayName: "Local Image Runtime",
          protocolId: "local-provider-image",
          inputs: ["text", "image"],
          outputs: ["image"],
        },
      ],
    },
    videoGeneration: {
      defaultModelId: "local-video",
      models: [
        {
          id: "local-video",
          displayName: "Local Video Runtime",
          protocolId: "local-provider-video",
          inputs: ["text", "image"],
          outputs: ["video"],
        },
      ],
    },
    speechGeneration: {
      models: [
        {
          id: "local-tts",
          displayName: "Local Speech Synthesis",
          protocolId: "local-provider-speech",
          inputs: ["text"],
          outputs: ["audio"],
        },
        {
          id: "local-stt",
          displayName: "Local Speech Recognition",
          protocolId: "local-provider-speech",
          inputs: ["audio"],
          outputs: ["text"],
        },
      ],
    },
  },
};