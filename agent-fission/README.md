# Agent Fission

English: [README_EN.md](README_EN.md)

Agent Fission 是一个仅提供工具的 Hanako 插件。

插件目录：

- [manifest.json](manifest.json)
- [package.json](package.json)
- [skills/agent-fission/SKILL.md](skills/agent-fission/SKILL.md)
- [tools/split-agent.js](tools/split-agent.js)
- [tests/smoke.mjs](tests/smoke.mjs)

它让 primary agent 创建一个真正持久化的 Hanako agent，而不是一次性的运行时 subagent。

工具能力：

- 通过本地 agents API 创建新 Hanako agent
- 支持保留 Hanako 默认模板后再叠加一层很薄的个性化 `identity.md`
- 支持保留 Hanako 默认模板后再叠加一层很薄的个性化 `ishiki.md`
- 可选写入 `public-ishiki.md`
- 可选下载并写入新 agent 的头像
- 当调用者不是 primary agent 时拒绝执行

安装后的工具名：

- `agent-fission_split_agent`

必填参数：

- `name`
- `identity`
- `ishiki`

可选参数：

- `id`
- `yuan`
- `publicIshiki`
- `contentMode`
- `avatarUrl`
- `avatarDataUrl`

推荐调用方式：

- 优先使用 `contentMode=overlay`
- `identity` 和 `ishiki` 尽量写成很短的补充，而不是整份重写
- 这些补充会叠加在 Hanako 自带默认模板上，保留“核心仍是助手”的基调
- 如果要加头像，先让主 agent 去网上找几张合适的人像或图标，再把最终选中的图片 URL 传给 `avatarUrl`
- 如果图片字节已经在手里，可以直接传 `avatarDataUrl`

调试与测试：

- `node tests/smoke.mjs`
- 可用 `HANA_HOME` 指定 Hanako 数据目录，默认读取 `~/.hanako`
- 可用 `HANAKO_AGENT_ID` 指定要用于测试的 primary agent
- 设 `HANAKO_SMOKE_KEEP_AGENT=1` 时，临时创建的 agent 会保留，便于排查

本地市场同步：

- 从仓库根目录运行 `node scripts/update-marketplace.mjs`，或者双击 `scripts/update-marketplace.cmd`，就会把这个插件的条目增量写入 OpenHanako 默认读取的本地市场文件。
- 默认目标是 `C:\Users\<你>\.hanako\plugin-marketplace\marketplace.json`。
- 也可以通过 `HANA_PLUGIN_MARKETPLACE_FILE` 或 `HANA_HOME` 改写入位置。
- 这个本地文件不进 git，主要放本机调试用的市场索引。

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

- 新 agent 是普通的独立 Hanako agent。
- 它后续可以拥有自己的 session、memory、files 和 tasks。
- 这个插件不会创建仅运行时存在的 subagent。
- `contentMode=overlay` 时，插件会先读取 Hanako 刚创建出来的默认 `identity.md` / `ishiki.md` / `public-ishiki.md`，再把传入的短补充叠上去。