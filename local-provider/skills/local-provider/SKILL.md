---
name: local-provider
description: 当用户想在 Hanako 中使用 LM Studio，或使用可配置的本地图片、视频、语音和音频运行时时使用。
---

# local-provider

当用户想要使用本地优先的提供方流程，而不是托管 API 厂商时，使用此技能。

## 这个插件提供什么

- 一个名为 `local-provider` 的聊天提供方，默认指向 LM Studio。
- 当配置了本地运行时后，为内置 image-gen 插件注册图片和视频适配器。
- 在官方界面上线前，提供本地视频和语音流程所需的直接工具：
  - `local-provider_generate-video`
  - `local-provider_transcribe-audio`
  - `local-provider_synthesize-speech`
- 一个用于配置本地媒体运行时的工具：
  - `local-provider_configure-runtime`
- 一个用于检查 LM Studio 可达性和运行时摘要的状态工具：
  - `local-provider_status`

## 推荐流程

1. 先调用 `local-provider_status`，确认 LM Studio 是否已经可达，以及当前配置了哪些本地运行时。
2. 如果用户要做图片、视频、语音转文字或文字转语音，用 `local-provider_configure-runtime` 保存结构化的运行时配置。
3. 对于聊天模型，引导用户进入 设置 -> Providers -> Local Provider，并从 LM Studio 拉取模型。
4. 对于图片任务，已配置的图片运行时会自动注册到 Hanako 内置的 image-gen 流程中。
5. 对于本地视频和语音任务，优先使用这个插件提供的专用工具，不要临时拼 shell 流程。

## 说明

- LM Studio 文本能力开箱即用，因为提供方默认指向 `http://127.0.0.1:1234/v1`，且不需要 API key。
- 媒体运行时是显式配置的。插件不会擅自猜测要运行哪个本地 CLI。
- 图片和视频集成只有在对应运行时配置完成后，才会变成可自动选择的选项。