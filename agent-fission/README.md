# Agent Fission

[English version →](README_EN.md)

Agent Fission 是一个纯工具型 Hanako 插件——它不做界面，只做一件事：**造一个真正的持久化 Agent**。

它让 primary agent 创建的是一个会一直活着的 Hanako agent，而不是用完就丢的运行时 subagent。

| 能力 | 说明 |
|------|------|
| 🆕 Agent 创建 | 通过本地 API 创建全新的持久化 Hanako agent |
| 🧬 身份叠加 | 保留 Hanako 模板 + 叠一层很薄的 `identity.md` |
| 🧠 意识叠加 | 保留 Hanako 模板 + 叠一层很薄的 `ishiki.md` |
| 🌐 公开面纱 | 可选写入 `public-ishiki.md` |
| 🖼️ 头像 | 可选从 URL 下载或直接用 Data URL 写入头像 |
| 🚫 权限守卫 | 调用者不是 primary agent 时果断拒绝执行 |

安装后的工具名：

- `agent-fission_split_agent`

| 参数 | 必填 | 说明 |
|------|------|------|
| `name` | ✅ | 新 agent 的显示名 |
| `identity` | ✅ | `identity.md` 内容或覆盖 |
| `ishiki` | ✅ | `ishiki.md` 内容或覆盖 |
| `id` | | 稳定 agent ID，不传则自动生成 |
| `yuan` | | 基础源灵模板：`hanako` / `butter` / `ming` / `kong` |
| `publicIshiki` | | 可选 `public-ishiki.md` 内容 |
| `contentMode` | | `overlay`（推荐）或 `replace` |
| `avatarUrl` | | 头像图片的 HTTP(S) URL |
| `avatarDataUrl` | | 头像图片的 Data URL（已有字节时用） |

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

更多说明：

- 新 agent 是普通的独立 Hanako agent。
- 它后续可以拥有自己的 session、memory、files 和 tasks。
- 这个插件**不会**创建仅运行时存在的 subagent。
- `contentMode=overlay` 时，插件会先读 Hanako 刚建好的默认 `identity.md` / `ishiki.md` / `public-ishiki.md`，再把传入的短补充叠上去。