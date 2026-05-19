# Hanako Plugins

[English version →](README_EN.md)

每个插件在根目录下都有自己的独立小窝，按文件夹整整齐齐地排好。

当前住户：

- [agent-fission](agent-fission/README.md) —— 创建有独立身份、ishiki 和可选 public-ishiki 的真正持久化 Hanako agent。
- [local-provider](local-provider/README.md) —— 把 LM Studio 接成默认本地聊天 Provider，并为图片、视频、语音补上可配置的本地运行时接口。
- [roleplay](roleplay/README.md) —— 在对话中用“开启扮演模式”进入深度扮演，并持续引导场景推进与续聊。

仓库级参考：

- [PLUGIN_CREATION_WORKFLOW.md](PLUGIN_CREATION_WORKFLOW.md)：插件从零到上线的完整流程与实现参考。

仓库级工具：

- [scripts/package-test.cmd](scripts/package-test.cmd)：测试打包，不增长版本号。
- [scripts/package-generate.cmd](scripts/package-generate.cmd)：生成发布包，必要时自动增长版本号，写入 OH-Plugins 插件条目，并自动提交和推送发布 tag。
- [.github/workflows/release.yml](.github/workflows/release.yml)：推 `<plugin-id>-vX.Y.Z` tag 时自动创建 GitHub Release。

补充说明：

- 要加新插件？在根目录下建个同级文件夹就行。每个插件留好自己的 `manifest.json`、`package.json`、`skills/`、`tools/`，`tests/` 可选。