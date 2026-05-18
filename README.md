# Hanako Plugins

[English version →](README_EN.md)

每个插件在根目录下都有自己的独立小窝，按文件夹整整齐齐地排好。

当前住户：

- [agent-fission](agent-fission/README.md) —— 创建有独立身份、ishiki 和可选 public-ishiki 的真正持久化 Hanako agent。

仓库级参考：

- [PLUGIN_CREATION_WORKFLOW.md](PLUGIN_CREATION_WORKFLOW.md)：插件从零到上线的完整流程与实现参考。

仓库级工具：

- [scripts/package-test.cmd](scripts/package-test.cmd)：测试打包，不增长版本号。
- [scripts/package-generate.cmd](scripts/package-generate.cmd)：生成发布包，必要时自动增长版本号并写入 OH-Plugins 插件条目。
- [.github/workflows/release.yml](.github/workflows/release.yml)：推 `<plugin-id>-vX.Y.Z` tag 时自动创建 GitHub Release。

补充说明：

- 要加新插件？在根目录下建个同级文件夹就行。每个插件留好自己的 `manifest.json`、`package.json`、`skills/`、`tools/`，`tests/` 可选。