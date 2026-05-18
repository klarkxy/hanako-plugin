# 更新日志

- 2026-05-18 [agent-fission] 生成包完成，版本保持 1.0.3
- 2026-05-18 [agent-fission] 生成包完成，版本保持 1.0.2
- 2026-05-18 [agent-fission] 测试包完成，版本保持 1.0.2
- 2026-05-18 [agent-fission] 生成包完成，版本从 1.0.1 自动递增到 1.0.2
- 2026-05-18 [agent-fission] 新增 package-test / package-generate 双脚本；测试不递增版本，生成在必要时自动递增版本并写 OH-Plugins 插件条目。
- 2026-05-18 [agent-fission] 首个市场发布，完成持久化 Agent、identity、ishiki、可选 public-ishiki、头像支持与 smoke test。
- 2026-05-18 [agent-fission] 优化头像获取流程：web 搜索优先 → image-gen 兜底 → 问用户提供；裁切由 agent 完成，不再推给用户；修正 contentMode 默认值描述与 tool 实现不一致的问题。
- 2026-05-18 [agent-fission] 新增角色自动补充流程：用户只提供角色名时，agent 自动搜索背景资料后草拟简介与灵魂，确认后再执行；明确 overlay/replace 的适用场景。
