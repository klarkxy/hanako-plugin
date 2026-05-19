---
name: agent-fission
description: 当用户明确想使用 agent-fission_split_agent 工具创建一个拥有独立身份、灵魂、头像或初始技能的全新持久 Hanako 代理时使用。新 skill 安装后需要判断是否扩散到多个代理时，接到 skill router 衔接流程。
---

只有在用户真的想创建一个独立的 Hanako 代理时才启用此技能，这种代理会在对话结束后继续存在。

如果请求属于下面这些情况，就不要使用此技能：

- 临时的运行时搭档
- 一次性的独立子代理运行
- 应该始终依附当前代理的后台任务

角色自动补充流程：

当用户只提供角色名或人名，而没有提供完整身份和 ishiki 内容时：
1. 使用 web_search 收集该角色的背景信息、性格特征和设定
2. 起草一份初步的 identity.md 和 ishiki.md，然后交给用户审阅
3. 在调用工具之前，先让用户确认或提出修改意见

当用户已经提供完整描述时，尊重其原文，直接调用工具。

当角色设定很丰富，且用户希望完整呈现时，使用 `contentMode=replace`，不要被 overlay 模式里的“简洁”建议限制住。

调用工具前，先准备好以下内容：

- `name`：新代理的显示名称
- 可选 `id`：稳定的 Hanako 代理 ID
- 可选 `yuan`：`hanako`、`butter`、`ming`、`kong` 之一
- `identity`：代理的身份内容；overlay 模式保持简洁，replace 模式允许完全控制
- `ishiki`：代理的 ishiki 内容；overlay / replace 的逻辑相同
- 可选 `publicIshiki`：需要时提供面向公众的内容
- 可选 `contentMode`：传 `overlay` 表示叠加在 Hanako 默认模板之上（推荐）；传 `replace` 表示完全自定义。工具默认是 `replace`，所以需要 overlay 时要显式传入。
- 可选 `avatarUrl`：可访问的 http/https png/jpg/webp 图片 URL；头像流程见下方
- 可选 `avatarDataUrl`：只在你已经拿到图片字节时使用
- 可选 `enabledSkills`：新代理创建后要追加的初始技能；默认技能保留，只追加这些技能

黄金规则：

- 只有主代理可以创建另一个持久代理
- 这个工具生成的是普通 Hanako 代理，不是运行时子代理
- 对轻量补充优先使用 `contentMode=overlay`；对于完整 OC 人设或世界观丰富的角色，使用 `contentMode=replace`。 “简洁” 约束只适用于 overlay，不是通用限制
- 在 overlay 模式下，身份和 ishiki 只保留这个代理最独特的部分；在 replace 模式下，可以自由撰写
- 工具默认是 `replace`，所以需要 overlay 时请显式传入 `contentMode: "overlay"`
- 同人角色、OC 人设和文学角色代理都可以做——按用户想要的语气来构建

技能感知的创建与分发：

- 当新代理一开始就需要某些通用能力时，把技能名通过 `enabledSkills` 传进去；这样只会追加技能，不会移除默认技能。
- 当一个新 skill 刚安装完，需要判断它要不要扩到多个持久代理时，先切到 `agent-fission-skill-router`，再用 `agent-fission_sync_agent_skills` 做预览和分发。
- 私有 learned skill 不要默认扩散到所有代理；只有在它确实是共享能力，或者用户明确要求时才分发。

头像流程：
- 当用户想要头像但还没提供时，按下面的优先级找候选图：
  1. **先用 web search** —— 到合适的图片来源里搜索候选 URL，例如动漫插画站、角色图库等
  2. **image-gen 兜底** —— 如果网页搜索没有拿到可用图片，就生成 4~6 个候选头像
  3. **再问用户** —— 如果前两步都失败，就请用户提供图片 URL 或本地文件路径
- 不要花太多时间追求完美匹配，要尽快给出选项，让用户自己决定
- 如果这些候选都不行，问用户要不要再来一轮，或者直接提供自己的图片
- 一旦用户选定图片，**裁剪由你自己处理**，不要让用户来做
- 优先使用简洁的头像或图标型头像，这样小尺寸下更易读，但仍要尊重用户偏好