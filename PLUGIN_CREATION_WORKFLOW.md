> 大家好呀~ 我是艾薇娜亲的私人助手 Sherry 酱，来自开源库 OpenHanako，今天由 DeepSeek V4 Flash 老师代笔！🤖✨

# OpenHanako 插件创建流程说明

这份文档不是官方 API 手册的复读机——它是我翻遍了以下三类资料后，亲手整理出来的可执行的办案手册：

- OpenHanako 仓库里的官方文档与源码
- 官方社区市场仓库 OH-Plugins
- GitHub 上已公开的第三方 Hanako / OpenHanako 插件仓库

**适用场景**：后续在这个目录下开发社区插件时，先翻这份文档，再决定怎么搭结构、按什么顺序实现。

---

## 0. 一键打包脚本

这份流程现在配套两个双击脚本：[`scripts/package-test.cmd`](scripts/package-test.cmd) 和 [`scripts/package-generate.cmd`](scripts/package-generate.cmd)。

- `package-test.cmd` 只做测试打包，不增长版本号。
- `package-generate.cmd` 在工作区内容更新但版本号没变时，会自动递增 patch 版本。
- 生成包时，OH-Plugins 侧只写 `plugins/<id>.json|yaml` 这一个插件条目文件，不再复制整个源码目录。
- release 包直接从工作区打包，包内会额外带上外层 `STAT-LICENSE`。
- `homepage`、`repository` 和 `readmeUrl` 统一从 `STAT-LICENSE` 里的 `Project Url` 生成，README 指向每个插件自己的 README。
- 如果本机 OpenHanako 正在运行，测试和生成都会尝试把源码推到 dev 安装槽。
- `CHANGELOG.md` 只保留“日期 + 插件 + 动作”一行一条的中文记录，最新的动作永远排在最前面。
- GitHub Release 走 tag 驱动：推 `<plugin-id>-vX.Y.Z` 这种 tag 后，`.github/workflows/release.yml` 会自动打包对应插件的 zip 并创建 Release。
- `scripts/package-generate.cmd` 现在会顺手提交生成结果、打 tag，并推送当前仓库和 OH-Plugins 仓库；如果你只想本地预览，继续用 `scripts/package-test.cmd`。

## 1. 先看哪些插件最值得参考

像侦探勘查现场一样，我找到了几份最有价值的参考样本。

### 本地源码中的宝藏

**① `openhanako/examples/plugins/sdk-showcase/`**

最适合当第一份入门模板。它一口气演示了：

- `tools/` 静态工具
- `index.js` 生命周期入口
- `routes/` iframe 路由
- `manifest.json` 中的 `page` / `widget`
- `@hana/plugin-sdk` 和 `@hana/plugin-components` 的基础用法

后面如果想做一个"既有工具又有页面"的插件，优先照着它起步。

**② `openhanako/plugins/image-gen/`**

适合研究"复杂 full-access 插件"的运作方式。它展示了：

- 生命周期里如何初始化运行时对象
- 如何通过 `bus.handle()` 暴露能力
- 如何做后台任务、轮询和插件私有数据目录管理
- 配置 schema 的实际用法

**③ `openhanako/plugins/mcp/`**

适合研究"最小生命周期插件"。它的重点不是 UI，而是：

- 在 `onload()` 中创建运行时对象
- 卸载时清理资源
- 内置插件特有的 `settingsTab`

### 互联网上公开可参考的插件仓库

**① OH-Plugins 官方市场仓库**

仓库：`https://github.com/liliMozi/OH-Plugins`

目前官方市场里至少有一个公开插件的源码躺在那：
`hanako-hyperframes`

它在 OH-Plugins 仓库的 `official-plugins/hanako-hyperframes/` 下，适合参考：

- 官方发布形态的社区插件长什么样
- 如何做一个完整的 `page` 插件
- 如何把外部 CLI 集成进 Hanako 插件
- 如何把渲染结果以 `SessionFile` 形式交给 Hanako

**② `acoolalien/hanako-todo-plugin`**

仓库：`https://github.com/acoolalien/hanako-todo-plugin`

这个插件很适合研究"共享状态 + widget + tools + routes"的组合拳：

- 右侧 widget 面板
- CRUD 路由
- AI 工具和 UI 操作共用一份数据
- 目录结构清晰，骨架可以直接抄

**③ `hyjump/hanako-bilibili-intake`**

仓库：`https://github.com/hyjump/hanako-bilibili-intake`

适合研究"工具优先、外部运行时较重"的场景：

- 主入口是 `tools/`
- 有 `skills/` 帮 Agent 更好地选择工具
- 通过 Python / Whisper 做外部处理
- 配置项较多，适合参考 `manifest.json` 的 configuration 写法

**④ `Yuexiye/Openhanako-crystal-speech-emote`**

仓库：`https://github.com/Yuexiye/Openhanako-crystal-speech-emote`

适合研究"工具 + page + 资源文件"的组织方式：

- 多个工具
- 插件页面
- 数据目录和素材目录如何一起组织

> ⚠️ 注意：它的 manifest 里写了 `contributes.tools`，但从 OpenHanako 当前源码看，静态工具仍然靠 `tools/` 目录自动扫描加载，不能只依赖 manifest 枚举。

---

## 2. 从源码看，OpenHanako 插件到底怎么被加载

下面这些不是"文档建议"，而是我亲手从源码里挖出来的实际行为——算是本案的第一手现场证据。

### 2.1 扫描入口

宿主（host）会扫描插件目录下的每个子目录。

- `manifest.json` **可选**
- 没有 manifest 时，插件 id 默认取目录名
- 有 `manifest.json` 时，优先使用其中的 `id`、`name`、`version`、`description`

这意味着：

- 最简单的 tool-only 插件，甚至可以没有 manifest 就上路
- 但一旦你需要 `full-access`、页面、配置、版本信息，还是老实写上 manifest

### 2.2 实际加载顺序

从 `core/plugin-manager.js` 看，插件加载顺序大致是这样的：

1. 创建 `PluginContext`
2. 加载 `tools/`
3. 加载 `skills/`
4. 加载 `commands/`
5. 加载 `agents/`
6. 读取 `contributes.configuration`
7. 如果是 `full-access`，再加载：
   - `routes/`
   - `extensions/`
   - `providers/`
   - `page`
   - `widget`
   - `settingsTab`
8. 如果有 `index.js` 且激活条件满足，再执行 `onload()`

结论：

- 静态贡献走的是"目录驱动"，不是"manifest 枚举驱动"
- `index.js` **不**负责工具扫描——工具早在它之前就按目录加载好了
- 生命周期更像是"运行时补充层"，不是插件的唯一入口

### 2.3 权限模型的真实含义

社区插件默认是 `restricted`。

只有 manifest 里明确写了：

```json
{
  "trust": "full-access"
}
```

并且在 Hanako 设置里开启了"允许全权插件"，这个社区插件才会真正以 `full-access` 加载。

否则会出现下面这些"看起来像坏了"的症状：

- `tools/` 可以正常工作
- `routes/`、`extensions/`、`providers/` 不会按 full-access 生效
- `page`、`widget` 不会正常注册
- `index.js` 生命周期能力不能按 full-access 跑起来

### 2.4 工具是怎么注册的

`tools/*.js` 只要导出下面这些字段，宿主就会自动收录：

- `name`
- `description`
- `parameters`
- `execute`

最终暴露给 Agent 的工具名会自动变成：

`pluginId_name`

例如：

- 插件 id 是 `my-plugin`
- 工具文件导出 `name = "hello"`
- Agent 最终看到的是 `my-plugin_hello`

### 2.5 toolCtx 和生命周期 ctx 里实际能拿到什么

宿主会给插件上下文注入这些常用字段：

| 字段 | 说明 |
|------|------|
| `pluginId` | 插件唯一标识 |
| `pluginDir` | 插件安装目录路径 |
| `dataDir` | 插件私有数据目录 |
| `bus` | 事件总线（受限版只有 `emit/subscribe/request`） |
| `config` | 配置读写（`get/set`） |
| `log` | 带 `pluginId` 前缀的日志工具 |
| `registerSessionFile` | 文件登记（低层 API） |
| `stageFile` | **推荐** —— 文件登记 + 自动生成 `mediaItem` |

运行时上下文里还可能带上：

| 字段 | 说明 |
|------|------|
| `sessionPath` | 当前会话路径 |
| `serverId` / `serverNodeId` | 服务端标识 |
| `userId` / `studioId` | 用户与 Studio 标识 |
| `connectionKind` | 连接类型（`local` / `lan` / `relay` 等） |
| `credentialKind` | 凭证类型 |
| `executionBoundary` | 执行边界沙盒信息 |

需要特别注意两点：

1. restricted 插件拿到的 `bus` 是裁剪过的，只有部分方法能用。
2. 插件要把本地文件返回给 Hanako 时，优先用 `stageFile()`——别自己返回 `file://` 或瞎拼本地路径。

### 2.6 routes 是怎么挂载的

`routes/` 目录只在 `full-access` 下才有意义。

每个路由文件会被挂到插件自己的 API 前缀下：

`/api/plugins/{pluginId}/...`

路由里可以拿到：

- `pluginCtx`
- `agentId`

所以一个 page / widget 插件的典型套路是：

- manifest 声明 `page.route` 或 `widget.route`
- `routes/*.js` 提供 iframe 页面或数据 API
- iframe 页面里再加载自己的前端资源

### 2.7 page / widget 能不能成功注册，取决于三个条件

缺一个都不行：

1. manifest 里声明了 `contributes.page` 或 `contributes.widget`
2. 插件具备 `full-access`
3. 插件目录里真的有 `routes/`

也就是说，光写 manifest 还不够——宿主还会去检查 `routes/` 目录是不是真实存在。

### 2.8 生命周期不是一定开机就跑

有 `index.js` 但没写 `activationEvents` 时，当前实现默认按 `onStartup` 处理。

写了 `activationEvents` 就可以做按需激活，例如：

| 事件 | 触发时机 |
|------|---------|
| `onStartup` | 插件加载时立刻执行 `onload()` |
| `onPageOpen` | 用户打开插件页面 route |
| `onWidgetOpen` | 用户打开插件 widget route |
| `onToolCall` | 插件任意静态 tool 被调用 |
| `onToolCall:name` | 指定静态 tool 被调用 |
| `onBusRequest` | 总线请求触发（预留） |
| `onBusRequest:type` | 指定总线能力请求触发（预留） |

> 💡 这个机制很适合避免「插件一启动就把所有重资源全都拉起来」的笨重做法。

---

## 3. 创建插件前，先选形态

开动之前先问自己一个问题：**这个插件到底是给 Agent 加能力，还是给用户加界面？**

| 形态 | 适合 | 权限 | 最小目录 |
|------|------|------|---------|
| **A：tool-only** | 只是给 Agent 加工具，无 UI / 无路由 / 无生命周期 | `restricted` | `tools/hello.js` |
| **B：tool + page/widget** | 既要工具也要图形界面，需要 iframe + 宿主能力 | `full-access` | `manifest.json` + `routes/page.js` + `tools/hello.js` + `ui/Panel.tsx` |
| **C：runtime/integration** | 外部 CLI / 后台任务 / bus handler / 复杂状态 | `full-access` | 基于 B 再加 `index.js` |

> 💡 **建议**：优先从形态 A 起步。能省掉 80% 的初期复杂度，后面发现需要 UI 再加也不迟。

---

## 4. 推荐的创建流程

下面这套顺序，是我结合官方规则和源码后得出的最稳做法——每一步都踩在源码逻辑上。

### 第 1 步：先做 MVP，不要一上来就 full-access

先回答这几个问题：

- 插件 id 是什么
- Agent 最终要调用什么工具
- 工具输入是什么
- 工具输出是纯文本、结构化结果，还是文件
- 有没有必须存在的页面

如果这些问题里只有"工具输入输出"比较明确，那就先做 restricted 的 tool-only MVP。

### 第 2 步：先把目录搭出来

推荐从下面这个最小骨架开始：

```text
my-plugin/
  manifest.json
  README.md
  tools/
    hello.js
```

虽然 tool-only 插件理论上可以没有 manifest，但我还是建议从一开始就写上——后面扩展起来最省事。

### 第 3 步：写一个最小可调用工具

示例：

```js
export const name = "hello";
export const description = "Say hello";
export const parameters = {
  type: "object",
  properties: {
    name: { type: "string" }
  },
  required: ["name"]
};

export async function execute(input, ctx) {
  return `Hello, ${input.name}!`;
}
```

> 新插件也可以使用 `@hana/plugin-runtime` 的 `defineTool()` 来获得类型提示和参数默认值，两种写法的效果完全一样：
>
> ```js
> import { defineTool } from "@hana/plugin-runtime";
>
> const tool = defineTool({
>   name: "hello",
>   description: "Say hello",
>   async execute(input, ctx) {
>     return `Hello, ${input.name}!`;
>   }
> });
> export const tool;
> ```

如果工具会生成文件，改成这种返回方式：

```js
import fs from "node:fs";
import path from "node:path";
import { createMediaDetails } from "@hana/plugin-runtime";

export const name = "make_note";
export const description = "Create a note file";

export async function execute(input, ctx) {
  const filePath = path.join(ctx.dataDir, "note.txt");
  fs.writeFileSync(filePath, input?.text || "hello", "utf-8");

  const staged = ctx.stageFile({
    sessionPath: ctx.sessionPath,
    filePath,
    label: "note.txt"
  });

  return {
    content: [{ type: "text", text: "文件已生成" }],
    details: createMediaDetails([staged])
  };
}
```

### 第 4 步：只有确实需要时，再补 full-access manifest

如果插件开始需要页面、路由、生命周期或外部系统集成，再补上 manifest。主要字段说明：

- `minAppVersion`：建议设置，避免用户在用旧版本时出现诡异问题。
- `ui.hostCapabilities`：声明 iframe 页面需要的宿主能力（`external.open` 打开外链、`clipboard.writeText` 剪贴板写入、`sessionFile.open` 打开文件），只有声明的能力才能在 iframe 中调用。
- `depends.capabilities`：软依赖声明，告知宿主插件依赖哪些总线能力（如 `bridge:send`），缺失时不会阻止加载但会记录警告。

示例：

```json
{
  "manifestVersion": 1,
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "0.1.0",
  "description": "My OpenHanako plugin",
  "minAppVersion": "0.170.0",
  "trust": "full-access",
  "activationEvents": ["onStartup"],
  "ui": {
    "hostCapabilities": ["external.open", "clipboard.writeText"]
  },
  "contributes": {
    "page": {
      "title": "My Plugin",
      "route": "/page"
    }
  },
  "depends": {
    "capabilities": ["bridge:send"]
  }
}
```

### 第 5 步：做页面时，优先照着 sdk-showcase 组织

建议页面类插件直接沿用这个分层：

- `routes/page.js` 只负责返回 iframe shell
- `ui/` 放 React 或前端源码
- 打包后的静态资源放 `assets/`
- iframe 中通过 `@hana/plugin-sdk` 和宿主通信

一个最小 route shell 的思路：

```js
export default function registerRoutes(app, ctx) {
  app.get("/page", (c) => c.html(`<!doctype html>
<html>
  <body>
    <div id="root"></div>
    <script type="module" src="/api/plugins/${ctx.pluginId}/assets/panel.js"></script>
  </body>
</html>`));
}
```

### 第 6 步：确实需要常驻状态时，再写 index.js

只有下面这些情况，才建议加生命周期入口：

- 要初始化运行时对象
- 要注册 `bus.handle()`
- 要维护长连接、轮询、任务调度
- 要动态注册工具

> 新插件推荐使用 `@hana/plugin-runtime` 的 `definePlugin()`，它会自动适配 PluginManager 的版本差异：
>
> ```js
> import { definePlugin } from "@hana/plugin-runtime";
>
> export default definePlugin({
>   async onload(ctx) {
>     ctx.log.info("plugin loaded");
>
>     this.register(() => {
>       ctx.log.info("plugin cleaned up");
>     });
>   },
>
>   async onunload(ctx) {
>     ctx.log.info("plugin unloaded");
>   }
> });
> ```

传统 class 形式也完全兼容（`definePlugin()` 和 class 二选一即可）：

```js
export default class MyPlugin {
  async onload() {
    this.ctx.log.info("plugin loaded");

    this.register(() => {
      this.ctx.log.info("plugin cleaned up");
    });
  }

  async onunload() {
    this.ctx.log.info("plugin unloaded");
  }
}
```

### 第 7 步：先本地安装验证，再考虑打包

推荐验证顺序：

1. 直接把插件文件夹拖到 Hanako 的设置 → 插件页面
2. 检查插件状态是否成功加载
3. 用 Agent 调工具，确认工具名、参数、返回值都对
4. 有 UI 的话，打开 page / widget 看是否成功渲染
5. 这些都稳定了，再考虑 zip 打包

如果后续改成了 Agent 辅助开发，优先走 dev loop——所有 dev 工具需在设置 → 插件 → 权限中开启「允许 Agent 插件开发工具」后才可见：

- `plugin.dev.install` — 从工作区复制源码并加载到 `plugins-dev/`
- `plugin.dev.reload` — 修改源码后热重载
- `plugin.dev.invokeTool` — smoke 测试单个工具
- `plugin.dev.diagnostics` — 查看加载状态
- `plugin.dev.disable` / `plugin.dev.enable` — 控制生命周期
- `plugin.dev.reset` / `plugin.dev.uninstall` — 重置或移除
- `plugin.dev.list_surfaces` / `plugin.dev.describe_surface` — UI 调试
- `plugin.dev.run_scenario` — 运行自动化场景测试

**Dev Scenarios**：可以在 manifest 中声明 `dev.scenarios` 来做自动化 smoke test，生产运行时会忽略：

```json
{
  "dev": {
    "scenarios": [{
      "id": "hello-tool",
      "steps": [{
        "invokeTool": "hello",
        "input": { "name": "Hana" },
        "expectToolText": "hello Hana"
      }]
    }]
  }
}
```

不要把半成品直接塞进正式插件目录反复覆盖。

### 第 8 步：需要发布时，再看 OH-Plugins

插件真正要公开分发时，才需要继续做这些事情：

- 产出 release zip
- 计算 `sha256`
- 在 OH-Plugins 提交对应的 `plugins/<id>.json|yaml` 条目
- 补 README、权限说明、兼容版本说明
- 项目地址统一写 `https://github.com/klarkxy/hanako-plugin`
- README 统一填每个插件自己的 README
- 准备完整的市场条目——根级字段配一个示例就够了，完整条目还要包含 `versions[]` 数组，每个版本声明 `compatibility.minAppVersion` 和 `distribution`：

```yaml
# OH-Plugins/plugins/<id>.yaml
schemaVersion: 1
id: my-plugin
name: My Plugin
publisher: your-name
version: 1.0.0
repository: https://github.com/...
compatibility:
  minAppVersion: 0.170.0
distribution:
  kind: release
  packageUrl: https://github.com/klarkxy/hanako-plugin/releases/download/v1.0.0/plugin.zip
  sha256: ...
versions:
  - version: 1.0.0
    compatibility:
      minAppVersion: 0.170.0
    distribution:
      kind: release
      packageUrl: https://github.com/klarkxy/hanako-plugin/releases/download/my-plugin-v1.0.0/my-plugin.zip
      sha256: ...
```

在此之前，不必折腾市场元数据。

GitHub Release 的默认路径是：直接执行 `scripts/package-generate.cmd`。它会完成版本递增、OH-Plugins 条目更新、生成提交、tag 和 push；随后 `.github/workflows/release.yml` 会从对应的插件目录重新打包 release zip、生成 sha256，并把 changelog 顶部对应条目写进 release notes。

---

## 5. 我建议你后续优先采用的起手模板

如果现在要在这个目录里继续做新插件，二选一就行。

| 模板 | 适用场景 | 包含 |
|------|---------|------|
| **工具优先** | 绝大多数「先做能用」的场景 | `manifest.json` + `README.md` + `tools/main.js` |
| **Page 优先** | 你非常确定「必须有界面」 | `manifest.json` + `index.js` + `routes/page.js` + `tools/main.js` + `ui/Panel.tsx` + `assets/panel.js/.css` |

**选工具优先的建议路线：**

1. 先把核心能力都收敛到一个工具里
2. 工具跑顺了，再拆更多工具
3. 后面才发现需要 UI？再加 `routes/` 和 `ui/`

**选 Page 优先时最该参考的：**

- [`openhanako/examples/plugins/sdk-showcase/`](https://github.com/liliMozi/openhanako/tree/main/examples/plugins/sdk-showcase)
- [`OH-Plugins/official-plugins/hanako-hyperframes/`](https://github.com/liliMozi/OH-Plugins/tree/main/official-plugins/hanako-hyperframes)

---

## 6. 高概率踩坑点

这 7 个坑，我在源码和实践中都亲眼撞见过——提前打上标签，别重蹈覆辙。

1. **以为 manifest 里写了 `contributes.tools` 就够了**  
   当前源码里，静态工具仍然按 `tools/` 目录扫描，不是按 manifest 枚举。

2. **page / widget 只写 manifest，不建 `routes/`**  
   宿主不会注册 UI 入口，页面就出不来。

3. **社区插件声明了 `full-access`，但忘了在 Hanako 里开启全权插件**  
   插件会卡在受限状态，很多能力看起来"像坏了"。

4. **工具产出本地文件时直接返回路径**  
   正确做法：先 `stageFile()`，把文件变成 `SessionFile`。

5. **在并发场景里假设 session 是全局唯一的**  
   和 session 相关的动作要明确依赖 `sessionPath`，不要假设"当前焦点 session"就是正在运行的那个。

6. **把内置插件特性当成社区插件特性**  
   例如 `settingsTab` 只对内置插件有效——社区插件声明了也会被忽略。

7. **一开始就上复杂生命周期**  
   如果功能本质上只是一个工具，先写 `tools/`，别急着加 `index.js`。

---

## 7. 当前最推荐的参考顺序

按这个优先级翻参考——从源码级到应用级，由内而外：

| 优先级 | 参考对象 | 理由 |
|--------|---------|------|
| ① | [`openhanako/examples/plugins/sdk-showcase/`](https://github.com/liliMozi/openhanako/tree/main/examples/plugins/sdk-showcase) | 最完整的官方模板，覆盖工具 + 页面 + 生命周期 |
| ② | [`openhanako/core/plugin-manager.js`](https://github.com/liliMozi/openhanako/blob/main/core/plugin-manager.js) | 插件加载的源码真相，比任何文档都准确 |
| ③a | [`acoolalien/hanako-todo-plugin`](https://github.com/acoolalien/hanako-todo-plugin) | 需要 widget 共享状态时参考 |
| ③b | [`hyjump/hanako-bilibili-intake`](https://github.com/hyjump/hanako-bilibili-intake) | 需要重工具链 + 外部 CLI 时参考 |
| ③c | [`hanako-hyperframes`](https://github.com/liliMozi/OH-Plugins/tree/main/official-plugins/hanako-hyperframes) | 需要 page + 资源 + 发行形态时参考 |
| ④ | `PLUGINS.md` + `PLUGIN_SDK.md` | 官方说明，作为最终确认

---

## 8. 一句话版结论

OpenHanako 当前的插件系统，本质是 **"目录约定优先，manifest 只补权限和元信息"** 的设计。

真正高效的开发顺序不是先啃完整文档，而是一步步来：

1. 先定形态
2. 先做最小工具
3. 需要 UI 再加 routes / page / widget
4. 需要常驻能力再加 index.js
5. 最后再考虑打包和市场发布

照这个顺序走，成本最低，和当前源码实现也最一致。
