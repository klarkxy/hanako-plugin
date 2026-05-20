// tools/query-usage.js
// 查询 Token 用量统计：每日 / 每周 / 每月 / 自定义范围
import fs from "node:fs";
import path from "node:path";

export const name = "query_token_usage";
export const description = "查询 LLM Token 消耗统计，支持按日/周/月/自定义时间段和按模型筛选";
export const parameters = {
  type: "object",
  properties: {
    period: {
      type: "string",
      enum: ["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "custom"],
      description: "查询的时间范围。默认为 today",
    },
    startDate: {
      type: "string",
      description: "自定义起始日期，格式 YYYY-MM-DD。当 period=custom 时必填",
    },
    endDate: {
      type: "string",
      description: "自定义结束日期，格式 YYYY-MM-DD。默认为 startDate 当天",
    },
    modelId: {
      type: "string",
      description: "可选，按模型 ID 筛选（支持部分匹配，如 'deepseek'）",
    },
    format: {
      type: "string",
      enum: ["text", "json"],
      description: "返回格式。text 返回人类可读文本，json 返回结构化数据。默认为 text",
    },
  },
};

export async function execute(input, ctx) {
  const period = input.period || "today";
  let startDate, endDate;

  // ── 计算日期范围 ──
  const now = new Date();
  const today = dateStr(now);

  switch (period) {
    case "today":
      startDate = endDate = today;
      break;
    case "yesterday":
      startDate = endDate = dateStr(new Date(now.getTime() - 86400000));
      break;
    case "this_week": {
      const dow = now.getDay(); // 0=Sun
      const diff = dow === 0 ? 6 : dow - 1; // Mon=0
      const monday = new Date(now);
      monday.setDate(now.getDate() - diff);
      startDate = dateStr(monday);
      endDate = today;
      break;
    }
    case "last_week": {
      const dow = now.getDay();
      const diff = dow === 0 ? 6 : dow - 1;
      const thisMonday = new Date(now);
      thisMonday.setDate(now.getDate() - diff);
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      const lastSunday = new Date(thisMonday);
      lastSunday.setDate(thisMonday.getDate() - 1);
      startDate = dateStr(lastMonday);
      endDate = dateStr(lastSunday);
      break;
    }
    case "this_month":
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      endDate = today;
      break;
    case "last_month": {
      const y = now.getFullYear();
      const m = now.getMonth(); // 0-based
      const firstOfLast = new Date(y, m - 1, 1);
      const firstOfThis = new Date(y, m, 1);
      const lastOfLast = new Date(firstOfThis.getTime() - 86400000);
      startDate = dateStr(firstOfLast);
      endDate = dateStr(lastOfLast);
      break;
    }
    case "custom":
      startDate = input.startDate;
      endDate = input.endDate || startDate;
      if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        return "❌ custom 模式下需要提供有效的 startDate（格式 YYYY-MM-DD）";
      }
      break;
    default:
      return `❌ 未知的时间范围: ${period}`;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return "❌ 日期格式无效，请使用 YYYY-MM-DD";
  }

  // ── 读取汇总数据 ──
  const dailyPath = path.join(ctx.dataDir, "daily.json");
  if (!fs.existsSync(dailyPath)) {
    return "📊 尚无 Token 用量数据。开始对话后数据会自动记录。";
  }

  let daily;
  try {
    daily = JSON.parse(fs.readFileSync(dailyPath, "utf-8"));
  } catch {
    return "❌ 汇总数据文件损坏，请尝试重置。";
  }

  // ── 筛选日期范围 ──
  const matchedDates = Object.keys(daily)
    .filter((d) => d >= startDate && d <= endDate)
    .sort();

  if (matchedDates.length === 0) {
    return `📊 ${periodLabel(period, startDate, endDate)} 没有 Token 用量记录。`;
  }

  // ── 聚合 ──
  const modelFilter = input.modelId ? input.modelId.toLowerCase() : null;

  const agg = {
    totalTokens: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCacheWriteTokens: 0,
    totalCost: 0,
    callCount: 0,
    activeDays: matchedDates.length,
    models: {},
  };

  for (const d of matchedDates) {
    const day = daily[d];
    if (!day) continue;
    agg.totalTokens += day.totalTokens || 0;
    agg.totalInputTokens += day.totalInputTokens || 0;
    agg.totalOutputTokens += day.totalOutputTokens || 0;
    agg.totalCacheReadTokens += day.totalCacheReadTokens || 0;
    agg.totalCacheWriteTokens += day.totalCacheWriteTokens || 0;
    agg.totalCost += day.totalCost || 0;
    agg.callCount += day.callCount || 0;

    for (const [mid, m] of Object.entries(day.models || {})) {
      if (modelFilter && !mid.toLowerCase().includes(modelFilter)) continue;
      if (!agg.models[mid]) {
        agg.models[mid] = { ...m };
      } else {
        agg.models[mid].inputTokens += m.inputTokens;
        agg.models[mid].outputTokens += m.outputTokens;
        agg.models[mid].cacheReadTokens += m.cacheReadTokens;
        agg.models[mid].cacheWriteTokens += m.cacheWriteTokens;
        agg.models[mid].totalTokens += m.totalTokens;
        agg.models[mid].cost += m.cost;
        agg.models[mid].callCount += m.callCount;
      }
    }
  }

  const modelCount = Object.keys(agg.models).length;

  if (input.format === "json") {
    return formatJson(agg, startDate, endDate, period);
  }

  return formatText(agg, startDate, endDate, period, modelFilter);
}

// ─── 辅助 ───

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function periodLabel(period, start, end) {
  const labels = {
    today: "📅 今日",
    yesterday: "📅 昨日",
    this_week: "📅 本周",
    last_week: "📅 上周",
    this_month: "📅 本月",
    last_month: "📅 上月",
  };
  if (labels[period]) return labels[period];
  return `📅 ${start} ~ ${end}`;
}

function fmt(n) {
  if (n == null) return "—";
  return n.toLocaleString("zh-CN");
}

function fmtCost(n) {
  if (n == null || n === 0) return "—";
  return `¥${n.toFixed(4)}`;
}

function formatText(agg, start, end, period, modelFilter) {
  const lines = [];
  const title = periodLabel(period, start, end);
  const rangeNote = start === end ? `（${start}）` : `（${start} ~ ${end}）`;
  lines.push(`📊 **Token 用量统计 ${title}** ${rangeNote}`);
  lines.push("");
  lines.push(`| 指标 | 数值 |`);
  lines.push(`| --- | --- |`);
  if (agg.callCount > 0) lines.push(`| 🤖 调用次数 | ${fmt(agg.callCount)} |`);
  lines.push(`| 📥 输入 Token | ${fmt(agg.totalInputTokens)} |`);
  lines.push(`| 📤 输出 Token | ${fmt(agg.totalOutputTokens)} |`);
  lines.push(`| 💾 缓存命中 Token | ${fmt(agg.totalCacheReadTokens)} |`);
  lines.push(`| 📝 缓存写入 Token | ${fmt(agg.totalCacheWriteTokens)} |`);
  lines.push(`| 🔢 **合计 Token** | **${fmt(agg.totalTokens)}** |`);
  lines.push(`| 💰 估算费用 | ${fmtCost(agg.totalCost)} |`);
  lines.push(`| 📆 活跃天数 | ${agg.activeDays} |`);

  const models = Object.values(agg.models).sort((a, b) => b.totalTokens - a.totalTokens);
  if (models.length > 0) {
    lines.push("");
    lines.push(`**按模型细分**${modelFilter ? `（筛选: ${modelFilter}）` : ""}:`);
    lines.push("");
    lines.push(`| 模型 | 调用次数 | 合计 Token | 费用 |`);
    lines.push(`| --- | --- | --- | --- |`);
    for (const m of models) {
      lines.push(`| ${m.modelId} | ${fmt(m.callCount)} | ${fmt(m.totalTokens)} | ${fmtCost(m.cost)} |`);
    }
  }

  if (modelFilter && modelCount === 0) {
    lines.push("");
    lines.push(`⚠️ 未找到匹配 "${modelFilter}" 的模型数据。`);
  }

  return lines.join("\n");
}

function formatJson(agg, start, end, period) {
  return JSON.stringify({
    period,
    startDate: start,
    endDate: end,
    stats: {
      callCount: agg.callCount,
      inputTokens: agg.totalInputTokens,
      outputTokens: agg.totalOutputTokens,
      cacheReadTokens: agg.totalCacheReadTokens,
      cacheWriteTokens: agg.totalCacheWriteTokens,
      totalTokens: agg.totalTokens,
      costTotal: agg.totalCost,
      activeDays: agg.activeDays,
    },
    models: Object.values(agg.models).sort((a, b) => b.totalTokens - a.totalTokens),
  }, null, 2);
}
