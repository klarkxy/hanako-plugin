# Zhihu Search Plugin (zhihu-search)

> Zhihu Open Platform API integration plugin, providing Hanako Agent with Zhihu search, global web search, Zhida (direct Q&A), and hot list capabilities.

## Features

| Tool | Description |
|------|-------------|
| `zhihu_search` | Search within Zhihu content (uses daily free quota) |
| `global_search` | Search the entire web (includes Zhihu content, uses daily free quota) |
| `zhida` | Zhihu Direct Answer — deep Q&A, separate quota |
| `hot_list` | Zhihu real-time trending list |
| `set_zhihu_api_key` | Configure/update Access Secret |
| `query_zhihu_quota` | Check today's quota usage |

## Quota Management

- Free tier: **1,000 calls/day** (shared between zhihu_search + global_search)
- Zhida (direct answer) uses an independent quota
- Plugin automatically tracks daily usage and notifies when quota is exhausted
- Smart strategy: when quota is available, prefer zhihu_search/global_search; complex questions automatically route to zhida

## Quick Start

1. User obtains Access Secret from [Zhihu Open Platform](https://developer.zhihu.com/profile)
2. Agent calls `set_zhihu_api_key` tool to configure the secret
3. All search tools are ready to use

## Configuration

The Access Secret must be configured via the `set_zhihu_api_key` tool before first use. The secret is persisted in the plugin's data directory.

```bash
# Key configuration is handled by the Agent via the tool — no manual setup needed
```

## License

SATA-2.0
