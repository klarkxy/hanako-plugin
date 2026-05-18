# Hanako Plugins

[English version →](README_EN.md)

每个插件在根目录下都有自己的独立小窝，按文件夹整整齐齐地排好。

当前住户：

- [agent-fission](agent-fission/README.md) —— 创建有独立身份、ishiki 和可选 public-ishiki 的真正持久化 Hanako agent。

仓库级参考：

- [PLUGIN_CREATION_WORKFLOW.md](PLUGIN_CREATION_WORKFLOW.md)：插件从零到上线的完整流程与实现参考。
- [scripts/update-marketplace.mjs](scripts/update-marketplace.mjs)：一键增量同步到本机 OpenHanako 本地市场文件。
- [scripts/release.mjs](scripts/release.mjs)：plan、check、smoke、sync 调试命令集。

常用命令：

- `node scripts/release.mjs check --plugin agent-fission --smoke`
- `node scripts/update-marketplace.mjs`
- `scripts/update-marketplace.cmd`
- `node scripts/release.mjs plan`

本地市场配置：

- 默认写入 `C:\Users\<你>\.hanako\plugin-marketplace\marketplace.json`，和 OpenHanako 本地市场读取路径一致。
- 想换目标文件？设 `HANA_PLUGIN_MARKETPLACE_FILE`；想换 Hanako 数据目录？设 `HANA_HOME`。
- 这个文件不进仓库，专为本机调试而生。

示例：

```json
{
	"marketplace": {
		"publisher": "klarkxy",
		"minAppVersion": "0.216.2"
	}
}
```

补充说明：

- `update-marketplace` 只管本地市场同步，不走 GitHub Release 那一套。
- 它把仓库里的插件条目写到 OpenHanako 读的 marketplace.json 里——下次 OpenHanako 刷新就能看见了。
- 没有待发布的版本更新？脚本会干脆地直接退出。
- 要加新插件？在根目录下建个同级文件夹就行。每个插件留好自己的 `manifest.json`、`package.json`、`skills/`、`tools/`，`tests/` 可选。