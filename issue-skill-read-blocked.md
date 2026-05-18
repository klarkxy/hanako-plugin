## 环境信息

- OS: Windows_NT 10.0.26200
- Node.js 版本: v22.13.1
- Hanako 版本: 0.198.4

## 问题描述

Agent 使用 `read` 工具读取运行时安装的插件技能文件（`~/.hanako/plugins/<id>/skills/<name>/SKILL.md`）时，被沙盒安全策略阻止，无法正常获取技能文件内容。若 Agent 不具备绕过该限制的认知能力，将无法按技能文件的引导执行任务。

## 复现步骤

1. 将一个包含 `skills/<name>/SKILL.md` 的插件安装到 Hanako（自动部署到 `~/.hanako/plugins/<id>/skills/`）
2. 在 Agent 交互中，Agent 尝试 `read` 该 SKILL.md 文件（路径为 `C:\Users\<user>\.hanako\plugins\<id>\skills\<name>\SKILL.md`）
3. 观察返回结果

## 期望行为

Agent 能够成功读取 `~/.hanako/plugins/<id>/skills/<name>/SKILL.md` 的内容。SKILL.md 的本质是供 Agent 阅读的说明书/操作指南，其内容不包含敏感信息，应被允许读取。

## 实际行为

Agent 收到以下错误返回：

```
[安全策略] 读取被拒绝：C:\Users\<user>\.hanako\plugins\<id>\skills\<name>\SKILL.md（权限级别: blocked）

此操作被 Hanako 的沙盒安全策略阻止，表示命令越过了路径或权限边界。
```

作为对比，**工作区源码路径**下的同一文件可正常读取：

```
✅ D:/0 code/hanako-plugin/agent-fission/skills/agent-fission/SKILL.md  →  正常读取
❌ C:\Users\<user>\.hanako\plugins\agent-fission\skills\agent-fission\SKILL.md  →  被安全策略阻止
```

## 根因推测

沙盒安全策略对 `~/.hanako/` 目录做了全局读取封锁，目的是保护运行时敏感文件（如 `server-info.json` 中的 API token）。但该规则粒度过粗，将 `plugins/<id>/skills/` 下的 SKILL.md 也一并拦截。而 SKILL.md 的设计意图就是供 Agent 读取的行为指南，不含任何敏感信息。

## 修复建议

粒度可分三级，任选其一：

**方案 A（最小改动）**：在路径白名单中增加 `~/.hanako/plugins/*/skills/`，显式允许读取该目录下的文件。

**方案 B（语义对齐）**：在技能注册/加载阶段，将 SKILL.md 的文本内容注入到技能元数据中，使 Agent 通过技能描述即可获取内容，不再需要直接 `read` 文件。

**方案 C（通用改进）**：让 `read` 工具的沙盒规则对 `.md` 扩展名文件放宽限制——或至少对 `plugins/*/skills/` 路径下的文档类文件放行。

## 日志 / 截图

安全策略拒绝读取的完整报错信息见「实际行为」一节。
