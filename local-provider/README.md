# Local Provider

这个插件把本地优先的 Provider 体验接进 Hanako。

默认部分：

- 聊天 Provider：`local-provider`
- 默认 Base URL：`http://127.0.0.1:1234/v1`
- 默认 API：`openai-completions`
- 认证方式：无 key

也就是说，只要你本机已经跑着 LM Studio，它就可以作为 Hanako 的本地文本供应商出现。

## 这个插件做了什么

- 把 LM Studio 接成一个可发现、可测试、可拉取模型的聊天 Provider。
- 给图片、视频、语音三类本地运行时留出统一接口。
- 当图片运行时配置完成后，自动注册到内置 `image-gen` 插件里。
- 在官方语音 UI 还没做好之前，先提供两把直接可用的工具：
  - `local-provider_generate-video`
  - `local-provider_transcribe-audio`
  - `local-provider_synthesize-speech`

## 使用方式

### 文本 / 聊天

1. 安装并启用插件。
2. 打开设置 -> 供应商 -> Local Provider (LM Studio)。
3. 点击“拉取模型”。
4. 把你想用的本地模型加入该 Provider。
5. 在 Agent / Utility / Utility Large 里选择这些模型。

如果 LM Studio 不在默认地址，可以直接在 Provider 页修改 Base URL。

### 图片 / 视频 / 语音

这个插件不猜你的本地工作流，而是要求你显式配置运行时。

调用 `local-provider_configure-runtime`，为以下 runtime 之一保存结构化命令：

- `image`
- `video`
- `speechToText`
- `textToSpeech`

命令结构示例：

```json
{
  "runtime": "image",
  "spec": {
    "executable": "python",
    "args": [
      { "literal": "run_image.py" },
      { "option": "--prompt", "from": "prompt" },
      { "option": "--model", "from": "modelId" },
      { "option": "--output", "from": "outputDir" }
    ],
    "timeoutMs": 120000,
    "output": {
      "kind": "file_glob",
      "pattern": "*.png"
    }
  }
}
```

支持的绑定字段：

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

支持的输出类型：

- `file_glob`
- `json_stdout`
- `url_stdout`
- `text_stdout`

## 推荐工具

- `local-provider_status`
  - 查看 LM Studio 是否在线、有哪些模型、当前配置了哪些本地运行时。
- `local-provider_configure-runtime`
  - 保存或清理图片 / 视频 / 语音运行时配置。
- `local-provider_generate-video`
  - 直接调用已配置的视频运行时，并把生成文件挂回当前 session。
- `local-provider_transcribe-audio`
  - 跑本地 STT，并把 transcript 作为文本返回。
- `local-provider_synthesize-speech`
  - 跑本地 TTS，并把音频文件挂回当前 session。

## 当前边界

- 文本链路是开箱即用的，只要 LM Studio 在跑。
- 图片链路会挂到 Hanako 现有 image-gen 流程里；视频和语音先通过插件工具直连，具体调用哪套本地 CLI 由你自己配置。
- 社区插件拿不到原生 settings tab，所以媒体运行时配置暂时通过工具保存到插件配置里。