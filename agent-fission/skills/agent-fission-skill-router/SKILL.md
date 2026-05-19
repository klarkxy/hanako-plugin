---
name: agent-fission-skill-router
description: Use when a new skill has just been installed, refreshed, or discovered and you need to decide whether it should be enabled on every persistent Hanako agent or only a subset. Also use when the user asks to distribute a skill across agents.
defaultEnabled: false
---

# Agent Fission · 技能路由

这是一个“分发判断” skill，不是创建 skill。

它负责判断：一个新 skill 是该全员分发，还是只给少数匹配的 agent，或者先保留不动。

## 适用场景

- 新 skill 刚安装完成，需要决定要不要给每个 persistent agent 都启用。
- 用户明确说“把这个 skill 分给某些 agent”或“看看哪些 agent 该装上”。
- 你已经知道 skill 的用途，但还没决定覆盖范围。

## 判断原则

- 通用基础能力、统一流程、跨 agent 都会用到的技能，优先考虑全员分发。
- 角色专用、项目专用、一次性练习、强上下文绑定的技能，只给匹配的 agent。
- 某个 agent 自己学出来的 private learned skill，不要默认扩散到所有 agent。
- 不确定时，先预览，再问用户，不要猜着全量写入。

## 工作流程

1. 先看 skill 是做什么的。
2. 调用 `agent-fission_sync_agent_skills`，先用 `mode: "preview"` 看当前 agent 列表、已启用情况、以及哪些 agent 目前能看到这个 skill。
3. 如果 skill 是共享能力，就把所有 eligible persistent agent 放进 `agentIds`，再用 `mode: "apply"` 分发。
4. 如果只适合一部分 agent，就只把这些 agent 放进 `agentIds`。
5. 如果 skill 来源不明确、或明显是某个 agent 的私有 learned skill，先问用户要不要推广。
6. 只追加这个 skill，不要顺手改掉别的 skill 开关。

## 和新建 agent 的配合

如果用户要的是“新建 agent 时就带上这些技能”，不要走分发流程，直接用 `agent-fission_split_agent` 的 `enabledSkills` 参数。

## 快速判断

- 该全员分发：格式化、整理、通用工作流、基础护栏、跨角色都会用到的能力。
- 不该全员分发：角色专用、项目专用、测试用、私有 learned skill。
- 拿不准：先 preview，再问用户。