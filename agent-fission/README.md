# Agent Fission

[English version →](README_EN.md)

Agent Fission 是一个纯工具型 Hanako 插件——它不做界面，只做一件事：**造一个真正的持久化 Agent**。

它让 primary agent 创建的是一个会一直活着的 Hanako agent，而不是用完就丢的运行时 subagent。

| 能力 | 说明 |
|------|------|
| 🆕 Agent 创建 | 通过本地 API 创建全新的持久化 Hanako agent |
| 🧬 简介与灵魂 | `overlay` 模式保留模板 + 叠加补充；`replace` 模式完整自定义；支持角色名自动搜资料补全 |
| 🧩 技能分配 | 新建 agent 时可顺带写入初始启用技能；安装新 skill 后可按 agent 选择是否全员分发 |
| 🌐 公开面纱 | 可选写入 `public-ishiki.md` |
| 🖼️ 头像 | 可选从 URL 下载或直接用 Data URL 写入头像 |
| 🚫 权限守卫 | 调用者不是 primary agent 时果断拒绝执行 |

安装后的工具名：

- `agent-fission_split_agent`
- `agent-fission_sync_agent_skills`

| 参数 | 必填 | 说明 |
|------|------|------|
| `name` | ✅ | 新 agent 的显示名 |
| `identity` | ✅ | 简介内容（可用户提供，也可只给角色名由 agent 自动搜资料草拟） |
| `ishiki` | ✅ | 灵魂内容（同上） |
| `id` | | 稳定 agent ID，不传则自动生成 |
| `yuan` | | 基础源灵模板：`hanako` / `butter` / `ming` / `kong` |
| `publicIshiki` | | 可选 `public-ishiki.md` 内容 |
| `contentMode` | | `overlay` 或 `replace`（tool 默认 `replace`，需 overlay 时手动传参） |
| `avatarUrl` | | 头像图片的 HTTP(S) URL |
| `avatarDataUrl` | | 头像图片的 Data URL（已有字节时用） |
| `enabledSkills` | | 可选的初始技能列表；只会在新 agent 里追加，不会移除默认技能 |

技能分发辅助：

- `agent-fission_sync_agent_skills` 会先预览当前 agent 列表，再把某个 skill 写到你选中的 agent 上。
- 当一个新 skill 安装后，需要判断它是该全员启用、只给某一类 agent 启用，还是暂时不动，就用这个工具先看再定。

角色自动补充流程（角色名 → 完整背景）：

当用户只提供了角色名/人名时（而非完整的 identity + ishiki）：
1. 用 web_search 搜集该角色的背景资料、性格设定
2. 整理后草拟 identity.md 和 ishiki.md 给用户预览
3. 用户确认或提出修改后再调用 tool

用户提供了完整描述时，尊重原文直接调用。

推荐调用方式：

- `contentMode=overlay` 适合轻量补充；`contentMode=replace` 适合完整 OC 或设定丰富的角色——"concise"是 overlay 的约束，不是通用限制
- 注意 tool 默认是 `replace`，需要 overlay 时手动传参
- `identity` 和 `ishiki` 聚焦于这个 agent 的独特性，长度不限
- 同人角色、OC 人设、文学型 agent 都行——用户想要什么调性就做什么调性

技能感知的创建：

- 如果新 agent 一开始就需要某些通用能力，把技能名通过 `enabledSkills` 传进去；这样会保留默认技能，同时补上你要的技能。
- 如果刚装了一个新 skill，先看它是不是跨 agent 的通用能力，再决定要不要全员分发。
- 私有的 learned skill 不要默认扩散到所有 agent；只有在它确实是共享能力，或者用户明确要求时才分发。

头像获取流程（按优先级）：

1. **web 搜索** — 从动漫图源等网站搜索候选 URL
2. **image-gen 生成** — 搜索无果时，生成 4~6 张候选头像
3. **问用户** — 都不行就让用户提供图片 URL 或本地路径
- 展示候选后让用户挑选；都不满意就问是否换一批或上传自己的图
- 用户选定后，**由我来完成裁切**，不需要用户动手
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
- `contentMode=overlay` 读 Hanako 默认模板 + 叠补充；`contentMode=replace` 完全自定义，适合完整 OC。