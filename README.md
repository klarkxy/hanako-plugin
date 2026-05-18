# Hanako Plugins

这个仓库按插件分文件夹组织，每个插件都放在仓库根目录下的独立目录中。

当前已有插件：

- [agent-fission](agent-fission/README.md)：创建一个带有独立身份、ishiki 和可选 public-ishiki 的持久化 Hanako agent。

仓库级说明：

- [PLUGIN_CREATION_WORKFLOW.md](PLUGIN_CREATION_WORKFLOW.md)：插件创建流程与实现参考。

如果要新增插件，直接在根目录下再创建一个同级文件夹即可，每个插件保留自己的 `manifest.json`、`package.json`、`skills/` 和 `tools/`。