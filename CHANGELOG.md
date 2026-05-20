# 更新日志

- 2026-05-20 [agent-fission] 生成包完成，版本保持 1.0.6
- 2026-05-20 [local-provider] 生成包完成，版本从 0.1.0 自动递增到 0.1.1
- 2026-05-20 [roleplay] 生成包完成，版本从 1.0.0 自动递增到 1.0.1

- 2026-05-19 [agent-fission] 生成包完成，版本从 1.0.4 自动递增到 1.0.5

- 2026-05-19 [agent-fission] 新增新 agent 初始技能分配与多 agent 技能分发流程，支持预览后再决定是否全员启用新 skill。
- 2026-05-19 [local-provider] 生成包完成，版本保持 0.1.0
- 2026-05-19 [roleplay] 生成包完成，版本保持 1.0.0

- 2026-05-19 [scripts] 调整仓库发版流程：每个 release 统一打出全部插件 zip，并改为用仓库级 release tag 生成 GitHub Release 与 changelog 摘要。
- 2026-05-19 [local-provider] 新增 Local Provider 插件：默认接入 LM Studio 本地聊天 Provider，并提供图片、视频、语音的可配置本地运行时接口与语音工具。
- 2026-05-18 [roleplay] 生成包完成，版本保持 1.0.0
- 2026-05-18 [agent-fission] 测试包完成，版本保持 1.0.4
- 2026-05-18 [roleplay] 测试包完成，版本保持 1.0.0
- 2026-05-19 [roleplay] 新增 roleplay 插件：对话中可用“开启扮演模式”进入深度扮演，并持续引导场景推进和续聊。
- 2026-05-18 [agent-fission] 生成包完成，版本保持 1.0.4
- 2026-05-18 [agent-fission] 生成包完成，版本保持 1.0.3
- 2026-05-18 [agent-fission] 生成包完成，版本保持 1.0.2
- 2026-05-18 [agent-fission] 测试包完成，版本保持 1.0.2
- 2026-05-18 [agent-fission] 生成包完成，版本从 1.0.1 自动递增到 1.0.2
- 2026-05-18 [agent-fission] 新增 package-test / package-generate 双脚本；测试不递增版本，生成在必要时自动递增版本并写 OH-Plugins 插件条目。
- 2026-05-18 [agent-fission] 首个市场发布，完成持久化 Agent、identity、ishiki、可选 public-ishiki、头像支持与 smoke test。
- 2026-05-18 [agent-fission] 优化头像获取流程：web 搜索优先 → image-gen 兜底 → 问用户提供；裁切由 agent 完成，不再推给用户；修正 contentMode 默认值描述与 tool 实现不一致的问题。
- 2026-05-18 [agent-fission] 新增角色自动补充流程：用户只提供角色名时，agent 自动搜索背景资料后草拟简介与灵魂，确认后再执行；明确 overlay/replace 的适用场景。
