// tools/zhida.js
// 知乎直答 — 适合复杂问题，调用独立额度（不计入每日 1000 次免费搜索额度）

import { callZhihuApi, formatQuotaInfo } from "../lib/api.js";

export const name = "zhida";
export const description = "知乎直答——适合复杂、深度问题的问答。不计入每日免费额度。当问题较复杂（超过 80 字、含分析类关键词等）时应优先使用此工具。";
export const parameters = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "要询问的问题或话题，支持复杂、多句子的深度提问",
    },
    limit: {
      type: "number",
      description: "返回回答数量，默认 3，最大 10",
      default: 3,
    },
  },
  required: ["query"],
};

export async function execute(input, ctx) {
  const query = (input.query || "").trim();
  if (!query) {
    return "❌ 问题不能为空。";
  }

  const limit = Math.min(Math.max(input.limit || 3, 1), 10);

  try {
    const result = await callZhihuApi("zhida", { Query: query, Limit: limit }, ctx.dataDir);

    // 格式化结果
    const rawData = result.Data || {};

    // 尝试多种格式：Items 数组 / 直接数组 / 对象内容
    let items = [];
    if (Array.isArray(rawData)) {
      items = rawData;
    } else if (rawData.Items && Array.isArray(rawData.Items)) {
      items = rawData.Items;
    } else if (rawData.Answer || rawData.Content || rawData.content) {
      items = [rawData];
    } else if (rawData.state !== undefined) {
      // 只有 init 事件，可能是直答还需额外请求
      return `🤔 知乎直答收到会话初始化（session: ${rawData.req_session_id || "?"}），但没有回答数据。这可能是直答 API 需要多轮交互。`;
    }

    if (items.length === 0) {
      return `🤔 知乎直答未找到「${query}」的相关回答。`;
    }

    const lines = [`🤔 知乎直答 — "${query}"\n`];
    items.forEach((item, index) => {
      const answer = item.Content || item.content || item.Answer || item.answer || item.Summary || item.summary || "";
      const author = item.Author || item.author || "";
      const url = item.Url || item.url || "";
      const voteCount = item.VoteCount ?? item.voteCount ?? null;

      lines.push(`**回答 ${index + 1}**${author ? ` — ${author}` : ""}`);
      if (voteCount !== null) lines.push(`  赞同：${voteCount}`);
      if (answer) {
        const truncated = answer.length > 800 ? answer.slice(0, 800) + "…" : answer;
        lines.push(`  ${truncated}`);
      }
      if (url) lines.push(`  链接：${url}`);
      lines.push("");
    });

    const quotaInfo = formatQuotaInfo(ctx.dataDir);
    lines.push("---");
    lines.push(quotaInfo);

    return lines.join("\n").trim();
  } catch (err) {
    return `❌ 知乎直答失败：${err.message}`;
  }
}
