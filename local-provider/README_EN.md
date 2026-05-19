# Local Provider

This plugin gives Hanako a local-first provider path.

Default chat settings:

- Provider id: `local-provider`
- Base URL: `http://127.0.0.1:1234/v1`
- API format: `openai-completions`
- Auth: no API key required

If LM Studio is already running on your machine, Hanako can use it as a local chat provider immediately.

## What it adds

- An LM Studio-backed chat provider.
- A shared interface for local image, video, and speech runtimes.
- Automatic image adapter registration into Hanako's built-in `image-gen` plugin after the image runtime is configured.
- A direct local video tool before the host ships a dedicated local-video path:
  - `local-provider_generate-video`
- Two direct speech tools before the official speech UI lands:
  - `local-provider_transcribe-audio`
  - `local-provider_synthesize-speech`

## How to use it

### Chat models

1. Install and enable the plugin.
2. Open Settings -> Providers -> Local Provider (LM Studio).
3. Fetch models from LM Studio.
4. Add the local models you want to use.
5. Select them for chat / utility / utility large.

### Image / video / speech

The plugin does not guess which local workflow you want. Configure each runtime explicitly with `local-provider_configure-runtime`.

Supported runtime keys:

- `image`
- `video`
- `speechToText`
- `textToSpeech`

Supported bindings:

- `prompt`
- `modelId`
- `inputFile`
- `outputDir`
- `size`
- `duration`
- `ratio`
- `format`
- `voice`
- `language`

Supported output contracts:

- `file_glob`
- `json_stdout`
- `url_stdout`
- `text_stdout`

## Useful tools

- `local-provider_status`
- `local-provider_configure-runtime`
- `local-provider_generate-video`
- `local-provider_transcribe-audio`
- `local-provider_synthesize-speech`

## Current scope

- Chat via LM Studio works out of the box.
- Image is wired into Hanako's existing image-gen flow, while video and speech are exposed through direct plugin tools.
- Community plugins cannot ship a native settings tab, so media runtime configuration is stored through plugin tools for now.