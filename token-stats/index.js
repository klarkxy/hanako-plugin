// token-stats/index.js
// 生命周期入口：订阅 token_usage 事件，持久化原始记录到 JSONL
import fs from "node:fs";
import path from "node:path";
import { definePlugin } from "@hana/plugin-runtime";

export default definePlugin({
  async onload(ctx, { register }) {
    const recordsPath = path.join(ctx.dataDir, "records.jsonl");
    const dailyPath = path.join(ctx.dataDir, "daily.json");

    // 保证数据目录存在
    fs.mkdirSync(ctx.dataDir, { recursive: true });

    // ── 订阅 token_usage 事件 ──
    // 事件载荷: { type: "token_usage", usage: { inputTokens, outputTokens, ... }, modelId, modelProvider }
    // 第二个参数是 sessionPath
    const unsub = ctx.bus.subscribe((event, sessionPath) => {
      if (!event || event.type !== "token_usage") return;
      try {
        appendRecord(ctx, recordsPath, dailyPath, event, sessionPath);
      } catch (err) {
        ctx.log.error("Failed to persist token usage:", err.message);
      }
    });
    register(unsub);

    ctx.log.info("Token Stats loaded — now tracking LLM token usage.");
  },

  async onunload(ctx) {
    ctx.log.info("Token Stats unloaded.");
  },
});

// ─── 写入记录 ───

function appendRecord(ctx, recordsPath, dailyPath, event, sessionPath) {
  const { usage, modelId, modelProvider } = event;
  if (!usage || typeof usage !== "object") return;

  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10); // YYYY-MM-DD

  const record = {
    ts: now.getTime(),
    date: dateKey,
    hour: now.getHours(),
    modelId: modelId || "unknown",
    modelProvider: modelProvider || "unknown",
    sessionPath: sessionPath || null,
    inputTokens: usage.inputTokens || 0,
    outputTokens: usage.outputTokens || 0,
    cacheReadTokens: usage.cacheReadTokens || 0,
    cacheWriteTokens: usage.cacheWriteTokens || 0,
    totalTokens: usage.totalTokens || 0,
    costTotal: usage.costTotal != null ? usage.costTotal : null,
    cacheHit: !!usage.cacheHit,
    cacheCreated: !!usage.cacheCreated,
  };

  // 追加到 JSONL
  fs.appendFileSync(recordsPath, JSON.stringify(record) + "\n", "utf-8");

  // 更新日汇总
  updateDailySummary(dailyPath, record);
}

// ─── 日汇总 ───

function updateDailySummary(dailyPath, record) {
  let daily = {};
  try {
    if (fs.existsSync(dailyPath)) {
      daily = JSON.parse(fs.readFileSync(dailyPath, "utf-8"));
    }
  } catch { /* 忽略坏文件，重新开始 */ }

  const key = record.date;

  if (!daily[key]) {
    daily[key] = {
      date: record.date,
      modelProvider: record.modelProvider,
      models: {},
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheReadTokens: 0,
      totalCacheWriteTokens: 0,
      totalTokens: 0,
      totalCost: 0,
      callCount: 0,
    };
  }

  const day = daily[key];
  day.totalInputTokens += record.inputTokens;
  day.totalOutputTokens += record.outputTokens;
  day.totalCacheReadTokens += record.cacheReadTokens;
  day.totalCacheWriteTokens += record.cacheWriteTokens;
  day.totalTokens += record.totalTokens;
  day.totalCost += record.costTotal || 0;
  day.callCount += 1;

  // 按模型细分
  if (!day.models[record.modelId]) {
    day.models[record.modelId] = {
      modelId: record.modelId,
      modelProvider: record.modelProvider,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 0,
      cost: 0,
      callCount: 0,
    };
  }
  const m = day.models[record.modelId];
  m.inputTokens += record.inputTokens;
  m.outputTokens += record.outputTokens;
  m.cacheReadTokens += record.cacheReadTokens;
  m.cacheWriteTokens += record.cacheWriteTokens;
  m.totalTokens += record.totalTokens;
  m.cost += record.costTotal || 0;
  m.callCount += 1;

  // 只保留最近 90 天
  const dates = Object.keys(daily).sort();
  if (dates.length > 90) {
    const toRemove = dates.slice(0, dates.length - 90);
    for (const d of toRemove) delete daily[d];
  }

  fs.writeFileSync(dailyPath, JSON.stringify(daily, null, 2), "utf-8");
}
