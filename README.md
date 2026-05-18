# Hanako Plugins

English: [README_EN.md](README_EN.md)

这个仓库按插件分文件夹组织，每个插件都放在仓库根目录下的独立目录中。

当前已有插件：

- [agent-fission](agent-fission/README.md)：创建一个带有独立身份、ishiki 和可选 public-ishiki 的持久化 Hanako agent。

仓库级说明：

- [PLUGIN_CREATION_WORKFLOW.md](PLUGIN_CREATION_WORKFLOW.md)：插件创建流程与实现参考。
- [scripts/update-marketplace.mjs](scripts/update-marketplace.mjs)：一键增量同步本机 OpenHanako 本地市场文件的主入口。
- [scripts/release.mjs](scripts/release.mjs)：保留给调试用的 plan、check、smoke 和 sync 命令。

常用命令：

- `node scripts/release.mjs check --plugin agent-fission --smoke`
- `node scripts/update-marketplace.mjs`
- `scripts/update-marketplace.cmd`
- `node scripts/release.mjs plan`

本地市场配置：

- 默认写入 `C:\Users\<你>\.hanako\plugin-marketplace\marketplace.json`，和 OpenHanako 的本地市场读取路径一致。
- 也可以用 `HANA_PLUGIN_MARKETPLACE_FILE` 覆盖目标文件，或用 `HANA_HOME` 改本机 Hanako 数据目录。
- 这个文件不在仓库里，适合放本机调试用的市场索引。

示例：

```json
{
	"marketplace": {
		"publisher": "klarkxy",
		"minAppVersion": "0.216.2"
	}
}
```

说明：

- `update-marketplace` 只做本地市场同步，不走 GitHub Release。
- 它会把当前仓库里的插件条目写进 OpenHanako 读取的本地 marketplace.json，然后 OpenHanako 下次刷新时就能看到。
- 如果没有新的未发布版本，脚本会直接退出。
- 如果要新增插件，直接在根目录下再创建一个同级文件夹即可，每个插件保留自己的 `manifest.json`、`package.json`、`skills/`、`tools/` 和可选 `tests/`。