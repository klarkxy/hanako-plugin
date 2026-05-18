# OpenHanako 插件创建流程说明

这份文档不是重复官方 API 手册，而是把我在以下三类资料里确认过的信息整理成一份可直接执行的流程：

- OpenHanako 仓库里的官方文档与源码
- 官方社区市场仓库 OH-Plugins
- GitHub 上已经公开的第三方 Hanako / OpenHanako 插件仓库

适用目标：后续在当前目录下继续开发社区插件时，先看这份文档，再决定插件结构和实现顺序。

---

## 1. 先看哪些插件最值得参考

### 本地源码中的高价值参考

1. `openhanako/examples/plugins/sdk-showcase/`

最适合当第一份模板。它同时演示了：

- `tools/` 静态工具
- `index.js` 生命周期入口
- `routes/` iframe 路由
- `manifest.json` 中的 `page` / `widget`
- `@hana/plugin-sdk` 和 `@hana/plugin-components` 的基本用法

如果后面要做一个“有工具 + 有页面”的插件，优先照着它起步。

2. `openhanako/plugins/image-gen/`

适合参考“复杂 full-access 插件”的运行方式。它展示了：

- 生命周期里如何初始化运行时对象
- 如何通过 `bus.handle()` 暴露能力
- 如何做后台任务、轮询和插件私有数据目录管理
- 配置 schema 的实际使用方式

3. `openhanako/plugins/mcp/`

适合参考“最小生命周期插件”。它的重点不是 UI，而是：

- 在 `onload()` 中创建运行时对象
- 在卸载时清理资源
- 内置插件特有的 `settingsTab`

### 互联网上已公开、能直接参考的插件仓库

1. OH-Plugins 官方市场仓库

仓库：`https://github.com/liliMozi/OH-Plugins`

目前我确认到官方市场里至少已有一个公开插件条目：

- `hanako-hyperframes`

它的源码在 OH-Plugins 仓库的 `official-plugins/hanako-hyperframes/` 下，适合参考：

- 官方发布形态的社区插件长什么样
- 如何做一个完整的 `page` 插件
- 如何把外部 CLI 集成进 Hanako 插件
- 如何把渲染结果以 `SessionFile` 形式交给 Hanako

2. `acoolalien/hanako-todo-plugin`

仓库：`https://github.com/acoolalien/hanako-todo-plugin`

这个插件很适合参考“共享状态 + widget + tools + routes”的组合：

- 右侧 widget 面板
- CRUD 路由
- AI 工具和 UI 操作共用一份数据
- 目录结构清晰，适合照着抄骨架

3. `hyjump/hanako-bilibili-intake`

仓库：`https://github.com/hyjump/hanako-bilibili-intake`

这个插件适合参考“工具优先、外部运行时较重”的场景：

- 主入口是 `tools/`
- 有 `skills/` 帮 Agent 更好地选择工具
- 通过 Python / Whisper 做外部处理
- 配置项较多，适合参考 `manifest.json` 的 configuration 写法

4. `Yuexiye/Openhanako-crystal-speech-emote`

仓库：`https://github.com/Yuexiye/Openhanako-crystal-speech-emote`

它适合参考“工具 + page + 资源文件”的组织方式：

- 多个工具
- 插件页面
- 数据目录和素材目录如何一起组织

但要注意：它的 manifest 里写了 `contributes.tools`，而从 OpenHanako 当前源码看，静态工具实际还是靠 `tools/` 目录自动扫描加载，不能只依赖 manifest 枚举。

---

## 2. 从源码看，OpenHanako 插件到底怎么被加载

下面这些不是“文档建议”，而是我直接从源码里确认的实际行为。

### 2.1 扫描入口

宿主会扫描插件目录下的每个子目录。

- `manifest.json` 可选
- 没有 manifest 时，插件 id 默认取目录名
- 如果有 `manifest.json`，则优先用 manifest 里的 `id`、`name`、`version`、`description`

这意味着：

- 最简单的 tool-only 插件，甚至可以没有 manifest
- 但只要你需要 `full-access`、页面、配置、版本信息，最好还是写 manifest

### 2.2 实际加载顺序

从 `core/plugin-manager.js` 看，插件的大体加载顺序是：

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
8. 如果有 `index.js` 且激活条件满足，再执行生命周期 `onload()`

结论：

- 静态贡献是“目录驱动”的，不是“manifest 枚举驱动”的
- `index.js` 不负责工具扫描，工具是先按目录加载的
- 生命周期更像“运行时补充层”，不是插件的唯一入口

### 2.3 权限模型的真实含义

社区插件默认是 `restricted`。

只有 manifest 里明确写了：

```json
{
  "trust": "full-access"
}
```

并且用户在 Hanako 设置里开启了“允许全权插件”，这个社区插件才会真正以 `full-access` 加载。

否则会出现这些结果：

- `tools/` 可以正常工作
- `routes/`、`extensions/`、`providers/` 不会按 full-access 生效
- `page`、`widget` 不会正常注册
- `index.js` 生命周期能力不能按 full-access 跑起来

### 2.4 工具是怎么注册的

`tools/*.js` 只要导出下面这些字段，宿主就会自动加载：

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

- `pluginId`
- `pluginDir`
- `dataDir`
- `bus`
- `config`
- `log`
- `registerSessionFile`
- `stageFile`

另外，运行时上下文里还可能带：

- `sessionPath`
- `serverId`
- `serverNodeId`
- `userId`
- `studioId`
- `connectionKind`
- `credentialKind`
- `executionBoundary`

需要特别记住两点：

1. restricted 插件拿到的 `bus` 是裁剪过的，只能用一部分方法。
2. 插件要把本地文件返回给 Hanako 时，应该优先用 `stageFile()`，不要自己返回 `file://` 或随便拼本地路径。

### 2.6 routes 是怎么挂载的

`routes/` 目录只在 `full-access` 下有意义。

每个路由文件会被挂到插件自己的 API 前缀下：

`/api/plugins/{pluginId}/...`

路由里可以拿到：

- `pluginCtx`
- `agentId`

所以一个 page / widget 插件的典型做法是：

- manifest 声明 `page.route` 或 `widget.route`
- `routes/*.js` 提供 iframe 页面或数据 API
- iframe 页面里再加载自己的前端资源

### 2.7 page / widget 能否成功注册，取决于三个条件

缺一个都不行：

1. manifest 里声明了 `contributes.page` 或 `contributes.widget`
2. 插件具备 `full-access`
3. 插件目录里真的有 `routes/`

也就是说，只写 manifest 还不够，宿主还会检查 `routes/` 目录是否存在。

### 2.8 生命周期不是一定开机就跑

如果有 `index.js`，并且没有写 `activationEvents`，当前实现会默认按 `onStartup` 处理。

如果写了 `activationEvents`，就可以做按需激活，例如：

- `onStartup`
- `onPageOpen`
- `onWidgetOpen`
- `onToolCall`
- `onToolCall:name`

这个机制很适合避免“插件一启动就把所有重资源都拉起来”。

---

## 3. 创建插件前，先选形态

建议先问自己一句：这个插件到底是“给 Agent 加能力”，还是“给用户加界面”。

### 方案 A：tool-only 插件

适合：

- 只是给 Agent 增加工具
- 不需要页面
- 不需要 HTTP route
- 不需要生命周期常驻状态

建议：优先从这个形态起步。

最小目录：

```text
my-plugin/
  tools/
    hello.js
```

### 方案 B：tool + page / widget 插件

适合：

- 既要给 Agent 工具，也要给用户图形界面
- 需要 iframe 页面
- 需要宿主能力，比如复制、打开外链

最小目录：

```text
my-plugin/
  manifest.json
  routes/
    page.js
  tools/
    hello.js
  index.js
  ui/
    Panel.tsx
```

### 方案 C：runtime / integration 插件

适合：

- 要接外部 CLI
- 要跑后台任务
- 要注册 bus handler
- 要保存较复杂状态

这种形态通常一开始就需要 `full-access`。

---

## 4. 推荐的创建流程

下面这套顺序，是我结合官方规则和源码后，认为最稳的做法。

### 第 1 步：先做 MVP，不要一上来就 full-access

建议先回答这几个问题：

- 插件 id 是什么
- Agent 最终要调用什么工具
- 工具输入是什么
- 工具输出是纯文本、结构化结果，还是文件
- 有没有必须存在的页面

如果这些问题里只有“工具输入输出”很明确，那就先做 restricted 的 tool-only MVP。

### 第 2 步：先把目录搭出来

推荐从下面这个最小骨架开始：

```text
my-plugin/
  manifest.json
  README.md
  tools/
    hello.js
```

虽然 tool-only 插件理论上可以没有 manifest，但我还是建议从一开始就写上，后面扩展最省事。

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

如果插件开始需要页面、路由、生命周期或外部系统集成，再补 manifest：

```json
{
  "manifestVersion": 1,
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "0.1.0",
  "description": "My OpenHanako plugin",
  "minAppVersion": "0.158.0",
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
  }
}
```

### 第 5 步：做页面时，优先照着 sdk-showcase 组织

建议页面类插件直接沿用这个分层：

- `routes/page.js` 只负责返回 iframe shell
- `ui/` 放 React 或前端源码
- 打包后的静态资源放 `assets/`
- iframe 中通过 `@hana/plugin-sdk` 和宿主通信

一个最小 route shell 的思路是：

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

最小生命周期骨架：

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

1. 直接把插件文件夹拖到 Hanako 的设置 -> 插件页面
2. 检查插件状态是否成功加载
3. 用 Agent 调工具，确认工具名、参数、返回值都对
4. 如果有 UI，打开 page / widget 看是否成功渲染
5. 只有这些都稳定后，再考虑 zip 打包

如果后续改成 Agent 辅助开发，优先走 dev loop：

- `plugin.dev.install`
- `plugin.dev.reload`
- `plugin.dev.invokeTool`
- `plugin.dev.diagnostics`

不要把半成品直接塞进正式插件目录反复覆盖。

### 第 8 步：需要发布到市场时，再看 OH-Plugins

插件真正要公开分发时，才需要继续做这些事情：

- 产出 release zip
- 计算 `sha256`
- 在 OH-Plugins 提交市场条目
- 补 README、权限说明、兼容版本说明

在此之前，不必先做市场元数据。

---

## 5. 我建议你后续优先采用的起手模板

如果当前要在这个目录里继续做新插件，我建议直接选下面二选一。

### 起手模板 1：最稳妥的工具插件模板

适合绝大多数“先做能用”的场景。

```text
hanako-plugin/
  manifest.json
  README.md
  tools/
    main.js
```

建议：

- 先把核心能力都收敛到一个工具里
- 工具跑顺以后，再拆更多工具
- 如果后面才发现需要 UI，再加 `routes/` 和 `ui/`

### 起手模板 2：直接做 page 型插件

适合你已经非常确定“必须有界面”。

```text
hanako-plugin/
  manifest.json
  index.js
  README.md
  routes/
    page.js
  tools/
    main.js
  ui/
    Panel.tsx
  assets/
    panel.js
    panel.css
```

这时最应该参考的不是官方文档，而是：

- `openhanako/examples/plugins/sdk-showcase/`
- `OH-Plugins/official-plugins/hanako-hyperframes/`

---

## 6. 高概率踩坑点

1. 以为 manifest 里写了 `contributes.tools` 就够了

当前源码里，静态工具仍然是按 `tools/` 目录扫描，不是按 manifest 枚举扫描。

2. page / widget 只写 manifest，不建 `routes/`

这样宿主不会正常注册 UI 入口。

3. 社区插件声明了 `full-access`，但忘了在 Hanako 里开启全权插件

这会导致插件处于受限状态，很多能力看起来“像坏了”。

4. 工具产出本地文件时直接返回路径

正确做法是先 `stageFile()`，把文件变成 `SessionFile`。

5. 在并发场景里假设 session 是全局唯一

和 session 相关的动作要明确依赖 `sessionPath`，不要假设“当前焦点 session”就是正在运行的 session。

6. 把内置插件特性当成社区插件特性

例如 `settingsTab` 只对内置插件有效，社区插件声明了也会被忽略。

7. 一开始就上复杂生命周期

如果功能本质上只是一个工具，先写 `tools/`，不要急着加 `index.js`。

---

## 7. 当前最推荐的参考顺序

如果你后续要继续做插件，我建议按这个顺序看：

1. 先看 `openhanako/examples/plugins/sdk-showcase/`
2. 再看 `openhanako/core/plugin-manager.js`
3. 然后按需求选一个公开插件：
   - 要 widget：看 `acoolalien/hanako-todo-plugin`
   - 要重工具链：看 `hyjump/hanako-bilibili-intake`
   - 要 page + 资源 + 发行形态：看 `hanako-hyperframes`
4. 最后再补看 `PLUGINS.md` 和 `PLUGIN_SDK.md`

---

## 8. 一句话版结论

OpenHanako 当前的插件系统，更接近“目录约定优先 + manifest 只补权限和元信息”的设计。

真正高效的开发顺序不是先啃完整文档，而是：

1. 先确定插件形态
2. 先做最小工具
3. 需要 UI 再加 routes / page / widget
4. 需要常驻能力再加 index.js
5. 最后再考虑打包和市场发布

照这个顺序做，成本最低，和当前源码实现也最一致。