# Hanako Plugins

[English version →](README_EN.md)

每个插件在根目录下都有自己的独立小窝，按文件夹整整齐齐地排好。

当前住户：

- [agent-fission](agent-fission/README.md) —— 创建有独立身份、ishiki 和可选 public-ishiki 的真正持久化 Hanako agent。
- [roleplay](roleplay/README.md) —— 在对话中用"开启扮演模式"进入深度扮演，并持续引导场景推进与续聊。
- [opencode-provider](opencode-provider/README.md) —— 接入 OpenCode Zen（按量付费全系列模型）和 OpenCode Go（订阅制精选开源模型）。
- [token-stats](token-stats/README.md) —— 自动订阅 token_usage 事件，统计 LLM Token 日/周/月消耗与费用，提供按模型和时间范围查询。
- [zhihu-search](zhihu-search/README.md) —— 集成知乎开放平台四个 API（知乎搜索、全网搜索、知乎直答、热榜），支持每日额度追踪与智能搜索源选择。

仓库级参考：

- [PLUGIN_CREATION_WORKFLOW.md](PLUGIN_CREATION_WORKFLOW.md)：插件从零到上线的完整流程与实现参考。

仓库级工具：

- [scripts/package-test.cmd](scripts/package-test.cmd)：测试打包，不增长版本号。
- [scripts/package-generate.cmd](scripts/package-generate.cmd)：生成发布包，必要时自动增长版本号，并自动提交和推送一个仓库级 release tag。
- [.github/workflows/release.yml](.github/workflows/release.yml)：推 `release-YYYYMMDD-HHMMSS-mmm` 这类 tag 时，自动把仓库里的全部插件分别打包成 zip，并创建一个 GitHub Release。

补充说明：

- 要加新插件？在根目录下建个同级文件夹就行。每个插件留好自己的 `manifest.json`、`package.json`、`skills/`、`tools/`，`tests/` 可选。