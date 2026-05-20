// tools/global-search.js
// 全网搜索 — 在互联网范围内搜索（含知乎内容），消耗免费额度

import { callZhihuApi, hasQuotaRemaining, formatQuotaInfo } from "../lib/api.js";

export const name = "global_search";
export const description = "在全网范围搜索（含知乎高质量内容），适合需要最新资讯或非知乎域内信息。消耗每日免费额度（1000 次/天）。";
export const parameters = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "搜索关键词或问题",
    },
    limit: {
      type: "number",
      description: "返回结果数量，默认 5，最大 20",
      default: 5,
    },
  },
  required: ["query"],
};

export async function execute(input, ctx) {
  const query = (input.query || "").trim();
  if (!query) {
    return "❌ 搜索词不能为空。";
  }

  const limit = Math.min(Math.max(input.limit || 5, 1), 20);

  // 检查额度
  if (!hasQuotaRemaining(ctx.dataDir)) {
    return (
      `❌ 今日免费额度（${1000} 次）已用尽。\n\n` +
      `建议：\n` +
      `1. 使用 zhida（知乎直答）工具，它使用独立额度\n` +
      `2. 等待次日额度重置（每日 1000 次）\n` +
      `3. 联系知乎开放平台提升额度`
    );
  }

  try {
    const result = await callZhihuApi("global_search", { Query: query, Limit: limit }, ctx.dataDir);

    // 格式化结果
    const data = result.Data || [];
    if (!Array.isArray(data) || data.length === 0) {
      return `🌐 全网搜索「${query}」未找到相关结果。`;
    }

    const lines = [`🌐 全网搜索「${query}」结果：\n`];
    data.forEach((item, index) => {
      const title = item.Title || item.title || "无标题";
      const url = item.Url || item.url || "";
      const summary = item.Summary || item.summary || item.Content || item.content || "";
      const source = item.Source || item.source || item.Domain || item.domain || "";

      lines.push(`**${index + 1}. ${title}**`);
      if (source) lines.push(`   来源：${source}`);
      if (summary) lines.push(`   ${summary.slice(0, 200)}${summary.length > 200 ? "…" : ""}`);
      if (url) lines.push(`   链接：${url}`);
      lines.push("");
    });

    const quotaInfo = formatQuotaInfo(ctx.dataDir);
    lines.push("---");
    lines.push(quotaInfo);

    return lines.join("\n").trim();
  } catch (err) {
    return `❌ 全网搜索失败：${err.message}`;
  }
}
