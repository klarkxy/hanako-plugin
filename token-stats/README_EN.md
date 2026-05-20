# Token Stats

> Automatically track LLM token consumption with daily, weekly, and monthly aggregation and per-model filtering.

## Features

- Automatically records token usage per AI conversation turn (input, output, cache read, cache write, cost)
- Supports daily, weekly, monthly, or custom date range aggregation
- Supports per-model filtering and breakdown
- Runs silently in the background with no user intervention needed

## Tools

| Tool | Description |
|------|-------------|
| `query_token_usage` | Query token consumption statistics, supports today / yesterday / this_week / last_week / this_month / last_month / custom periods |
| `reset_token_stats` | Clear all statistics (requires confirmation) |

## Data Storage

- `records.jsonl`: Raw records (JSONL format, one record per line)
- `daily.json`: Daily aggregation (retains last 90 days)
- Data directory: `${HANA_HOME}/plugin-data/token-stats/`

## License

SATA-2.0
