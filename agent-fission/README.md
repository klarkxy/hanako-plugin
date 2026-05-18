# Agent Fission

[English version →](README_EN.md)

Agent Fission 是一个纯工具型 Hanako 插件——它不做界面，只做一件事：**造一个真正的持久化 Agent**。

插件目录一览：

- [manifest.json](manifest.json)
- [package.json](package.json)
- [skills/agent-fission/SKILL.md](skills/agent-fission/SKILL.md)
- [tools/split-agent.js](tools/split-agent.js)
- [tests/smoke.mjs](tests/smoke.mjs)

它让 primary agent 创建的是一个会一直活着的 Hanako agent，而不是用完就丢的运行时 subagent。

工具能力：

- 通过本地 agents API 创建新 Hanako agent
- 保留 Hanako 默认模板，再叠一层很薄的个性化 `identity.md`
- 保留 Hanako 默认模板，再叠一层很薄的个性化 `ishiki.md`
- 可选写入 `public-ishiki.md`
- 可选下载并写入新 agent 的头像
- 调用者不是 primary agent 时果断拒绝执行

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
- 这些补充会叠加在 Hanako 自带默认模板上，保留"核心仍是助手"的基调
- 要加头像的话，先让主 agent 去网上找几张合适的人像或图标，再把选中的图片 URL 传给 `avatarUrl`
- 如果图片字节已经在手里了，直接用 `avatarDataUrl`

调试与测试：

- `node tests/smoke.mjs`
- 用 `HANA_HOME` 指定 Hanako 数据目录，默认读 `~/.hanako`
- 用 `HANAKO_AGENT_ID` 指定用于测试的 primary agent
- 设 `HANAKO_SMOKE_KEEP_AGENT=1` 时，临时创建的 agent 会保留下来，方便排查

本地市场同步：

- 从仓库根目录跑 `node scripts/update-marketplace.mjs`，或者双击 `scripts/update-marketplace.cmd`，插件的条目就会增量写入 OpenHanako 默认读取的本地市场文件。
- 默认目标：`C:\Users\<你>\.hanako\plugin-marketplace\marketplace.json`
- 想改？设 `HANA_PLUGIN_MARKETPLACE_FILE` 或 `HANA_HOME`
- 这个文件不进 git，专为本机调试而生

示例：

```json
{
	"marketplace": {
		"publisher": "klarkxy",
		"minAppVersion": "0.216.2"
	}
}
```

更多说明：

- 新 agent 是普通的独立 Hanako agent。
- 它后续可以拥有自己的 session、memory、files 和 tasks。
- 这个插件**不会**创建仅运行时存在的 subagent。
- `contentMode=overlay` 时，插件会先读 Hanako 刚建好的默认 `identity.md` / `ishiki.md` / `public-ishiki.md`，再把传入的短补充叠上去。