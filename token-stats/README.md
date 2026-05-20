# Token Stats

> 自动跟踪 LLM Token 消耗量，提供按日/周/月汇总查询与按模型筛选功能。

## 功能

- 自动记录每次 AI 对话的 token 用量（输入、输出、缓存读、缓存写、费用）
- 支持按日、周、月或自定义时间段汇总
- 支持按模型筛选和细分
- 后台静默运行，无感记录

## 工具

| 工具 | 说明 |
|------|------|
| `query_token_usage` | 查询 Token 消耗统计，支持 today / yesterday / this_week / last_week / this_month / last_month / custom 时间段 |
| `reset_token_stats` | 清空统计数据（需要确认） |

## 数据存储

- `records.jsonl`：原始记录（JSONL 格式，每条一行）
- `daily.json`：按日汇总（保留最近 90 天）
- 数据目录：`${HANA_HOME}/plugin-data/token-stats/`

## 许可证

SATA-2.0
