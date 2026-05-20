# 知乎搜索插件 (zhihu-search)

> 知乎开放平台 API 集成插件，为 Hanako Agent 提供知乎搜索、全网搜索、知乎直答和热榜能力。

## 功能

| 工具 | 说明 |
|------|------|
| `zhihu_search` | 知乎站内搜索，消耗免费额度 |
| `global_search` | 全网搜索（含知乎内容），消耗免费额度 |
| `zhida` | 知乎直答——深度问答，独立额度 |
| `hot_list` | 知乎实时热榜 |
| `set_zhihu_api_key` | 配置/更新 Access Secret |
| `query_zhihu_quota` | 查询今日额度使用情况 |

## 额度管理

- 免费套餐：**1000 次/天**（zhihu_search + global_search 共享）
- zhida（直答）使用独立额度
- 插件自动追踪每日用量，额度用尽时自动提示
- 智能策略：额度充足时优先用 zhihu_search/global_search，复杂问题自动转向 zhida

## 快速开始

1. 用户前往 [知乎开放平台](https://developer.zhihu.com/profile) 获取 Access Secret
2. Agent 调用 `set_zhihu_api_key` 工具配置密钥
3. 即可使用全部搜索工具

## 配置

首次使用前需要通过 `set_zhihu_api_key` 工具配置 Access Secret。密钥保存在插件数据目录中。

```bash
# 密钥配置由 Agent 通过工具完成，无需手动操作
```

## 许可证

SATA-2.0
