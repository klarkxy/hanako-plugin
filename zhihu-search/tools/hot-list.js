// tools/hot-list.js
// 知乎热榜 — 查看知乎当前热门话题

import { callZhihuApi, formatQuotaInfo } from "../lib/api.js";

export const name = "hot_list";
export const description = "查看知乎实时热榜。仅当用户主动要求查看热榜时使用，不要主动或定时推送热榜内容。";
export const parameters = {
  type: "object",
  properties: {
    limit: {
      type: "number",
      description: "返回热榜条目数量，默认 10，最大 50",
      default: 10,
    },
  },
};

export async function execute(input, ctx) {
  const limit = Math.min(Math.max(input.limit || 10, 1), 50);

  try {
    const result = await callZhihuApi("hot_list", { Limit: limit }, ctx.dataDir);

    // 格式化结果
    const items = (result.Data && result.Data.Items) || [];
    if (!Array.isArray(items) || items.length === 0) {
      return "🔥 热榜暂无数据。";
    }

    const lines = ["🔥 **知乎热榜**\n"];
    items.forEach((item, index) => {
      const title = item.Title || item.title || "无标题";
      const url = item.Url || item.url || "";
      const hotScore = item.HotScore ?? item.hotScore ?? item.Heat ?? item.heat ?? null;
      const summary = item.Summary || item.summary || item.Content || item.content || "";
      const tag = item.Tag || item.tag || "";

      lines.push(`**${index + 1}. ${title}**`);
      if (tag) lines.push(`  标签：${tag}`);
      if (hotScore !== null) lines.push(`  热度：${hotScore}`);
      if (summary) lines.push(`  ${summary.slice(0, 150)}${summary.length > 150 ? "…" : ""}`);
      if (url) lines.push(`  链接：${url}`);
      lines.push("");
    });

    const quotaInfo = formatQuotaInfo(ctx.dataDir);
    lines.push("---");
    lines.push(quotaInfo);

    return lines.join("\n").trim();
  } catch (err) {
    return `❌ 获取热榜失败：${err.message}`;
  }
}
