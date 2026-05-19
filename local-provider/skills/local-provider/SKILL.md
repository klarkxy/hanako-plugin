---
name: local-provider
description: Use when the user wants LM Studio or configurable local image, video, speech, and audio runtimes inside Hanako.
---

# local-provider

Use this skill when the user wants a local-first provider flow instead of a hosted API vendor.

## What this plugin adds

- A chat provider named `local-provider`, pointed at LM Studio by default.
- Image and video adapter registration for the built-in image-gen plugin when a local runtime has been configured.
- Two direct tools for speech flows before the official UI exists:
 - One direct tool for local video generation before the host has a dedicated local-video path:
  - `local-provider_generate-video`
- Two direct tools for speech flows before the official UI exists:
  - `local-provider_transcribe-audio`
  - `local-provider_synthesize-speech`
- A configuration tool for local media runtimes:
  - `local-provider_configure-runtime`
- A status tool for LM Studio reachability and runtime summary:
  - `local-provider_status`

## Recommended flow

1. Call `local-provider_status` first to see whether LM Studio is already reachable and which local runtimes are configured.
2. If the user wants image, video, speech-to-text, or text-to-speech, save a structured command spec with `local-provider_configure-runtime`.
3. For chat models, guide the user to Settings -> Providers -> Local Provider and fetch models from LM Studio.
4. For image work, the configured image runtime is auto-registered into Hanako's built-in image-gen flow.
5. For local video and speech work, prefer the dedicated plugin tools instead of inventing a shell workflow.

## Notes

- LM Studio text works out of the box because the provider defaults to `http://127.0.0.1:1234/v1` and requires no API key.
- Media runtimes are intentionally explicit. The plugin does not guess which local CLI to run.
- Image/video integration only becomes auto-selectable after the matching runtime has been configured.