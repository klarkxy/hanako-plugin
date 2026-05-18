# Programmer Tools

[English version ->](README_EN.md)

Programmer Tools 是一个纯工具型 Hanako 插件。

它只做一件事：给 agent 一组更窄、更安全的程序员命令入口，让它在能用结构化工具时，优先不要直接走 `bash`。

第一版只包含最小可用集：

- `programmer-tools_python`
- `programmer-tools_node`
- `programmer-tools_http_request`

这些工具都依赖宿主提供的受控执行 helper：

- 总是强制走沙箱执行链路
- Python / Node 默认不开网络
- HTTP 请求只放开受控公网访问
- 工作目录、脚本路径、下载落点都限制在工作区内

## 适用场景

- 跑一个 Python 脚本或模块
- 执行一段 Node 脚本
- 查看 Python / Node 版本
- 下载一个公开 HTTP(S) 资源到工作区
- 对公开 URL 发 GET / HEAD 请求

## 不做的事

- 不替代完整 shell
- 不提供包管理
- 不支持任意外部库注入
- 不支持复杂管道、重定向、后台任务、复合命令

## 工具说明

### `programmer-tools_python`

用于运行受控 Python。

参数：

- `scriptPath`: 工作区内脚本路径
- `module`: 模块名，等价于 `python -m`
- `code`: 行内代码，等价于 `python -c`
- `version`: 查看版本
- `args`: 参数数组
- `cwd`: 工作目录，必须在工作区内

### `programmer-tools_node`

用于运行受控 Node。

参数：

- `scriptPath`: 工作区内脚本路径
- `code`: 行内代码，等价于 `node -e`
- `version`: 查看版本
- `args`: 参数数组
- `cwd`: 工作目录，必须在工作区内

### `programmer-tools_http_request`

用于替代简单的 `curl` / `wget`。

参数：

- `url`: 只允许 `http` / `https`
- `method`: `GET` 或 `HEAD`
- `headers`: 额外请求头
- `saveTo`: 下载到工作区内路径；不传则直接返回响应文本
- `followRedirects`: 是否跟随重定向，默认开启
- `cwd`: 工作目录，必须在工作区内

限制：

- 只允许公网地址，不允许内网 / loopback
- 下载目标必须在工作区内
- 复杂认证、脚本拼接、shell 管道不在第一版范围内

## 测试

- `node tests/smoke.mjs`

当前 smoke test 只验证工具导出和 helper 转发，不依赖运行中的 Hanako 实例。