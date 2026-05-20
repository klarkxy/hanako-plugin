# Token Stats

`token-stats` 是一个自动跟踪 LLM Token 消耗量的插件。它会在后台静默记录每次 AI 对话的 token 用量，并提供查询工具。

## 能力

- 自动记录每次对话回合的 token 消耗（输入、输出、缓存、费用）
- 支持按日、周、月或自定义时间段汇总查询
- 支持按模型筛选和细分

## 工具

### `query_token_usage`

当用户询问"今天用了多少 token"、"本周 token 消耗"、"费用情况"等问题时，调用此工具。

**常用查询模式：**

| 场景 | period 参数 |
|------|-------------|
| 今天的用量 | `today` |
| 昨天 | `yesterday` |
| 本周 | `this_week` |
| 上周 | `last_week` |
| 本月 | `this_month` |
| 上月 | `last_month` |
| 自定义日期 | `custom` 配合 startDate |

支持 `modelId` 参数按模型筛选（如 `deepseek`, `gpt-4`）。

### `reset_token_stats`

⚠️ 仅当用户明确要求清空统计数据时才使用。必须传递 `confirm=true`。

## 数据存储

- `records.jsonl`: 原始记录（JSONL 格式，每条一行）
- `daily.json`: 按日汇总（保留最近 90 天）
- 数据目录：`${HANA_HOME}/plugin-data/token-stats/`
