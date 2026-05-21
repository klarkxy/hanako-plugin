// token-stats/index.js
// 自动记录 LLM Token 消耗量，提供查询工具
// 无外部依赖——所有逻辑内联
import fs from "node:fs";
import path from "node:path";

// ─── 数值辅助 ───────────────────────────────────────

function firstNumber(...values) {
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function maybeNumber(...values) {
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// ─── usage 归一化（兼容 Pi SDK / OpenAI / Anthropic） ──

function normalizeUsage(usage) {
  if (!usage || typeof usage !== "object") return null;

  const inputTokens = firstNumber(
    usage.input, usage.inputTokens, usage.input_tokens, usage.prompt_tokens,
  );
  const outputTokens = firstNumber(
    usage.output, usage.outputTokens, usage.output_tokens, usage.completion_tokens,
  );
  const cacheReadTokens = firstNumber(
    usage.cacheRead, usage.cacheReadTokens, usage.cache_read_input_tokens,
    usage.prompt_tokens_details?.cached_tokens,
    usage.input_tokens_details?.cached_tokens,
  );
  const cacheWriteTokens = firstNumber(
    usage.cacheWrite, usage.cacheWriteTokens, usage.cache_creation_input_tokens,
    usage.cache_creation?.ephemeral_5m_input_tokens,
    usage.cache_creation?.ephemeral_1h_input_tokens,
  );
  const totalTokens = firstNumber(
    usage.totalTokens, usage.total_tokens,
    inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens,
  );
  const costTotal = maybeNumber(usage.costTotal, usage.cost?.total);

  return {
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    totalTokens,
    costTotal, // null 表示无法计算
    cacheHit: cacheReadTokens > 0,
    cacheCreated: cacheWriteTokens > 0,
  };
}

// ─── 日期辅助 ───────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── 持久化 ─────────────────────────────────────────

function appendRecord(dataDir, record) {
  const filePath = path.join(dataDir, "records.jsonl");
  try {
    fs.appendFileSync(filePath, JSON.stringify(record) + "\n", "utf-8");
  } catch (e) {
    console.error("[token-stats] appendRecord error:", e.message);
  }
}

function updateDaily(dataDir, date, modelId, modelProvider, norm) {
  const filePath = path.join(dataDir, "daily.json");

  let daily = {};
  try {
    if (fs.existsSync(filePath)) {
      daily = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch {
    // 文件损坏则重新开始
  }

  if (!daily[date]) {
    daily[date] = {
      date,
      totalTokens: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheReadTokens: 0,
      totalCacheWriteTokens: 0,
      totalCost: 0,
      callCount: 0,
      models: {},
    };
  }

  const day = daily[date];
  day.totalTokens += norm.totalTokens;
  day.totalInputTokens += norm.inputTokens;
  day.totalOutputTokens += norm.outputTokens;
  day.totalCacheReadTokens += norm.cacheReadTokens;
  day.totalCacheWriteTokens += norm.cacheWriteTokens;
  if (norm.costTotal !== null) day.totalCost += norm.costTotal;
  day.callCount += 1;

  if (!day.models[modelId]) {
    day.models[modelId] = {
      modelId,
      modelProvider: modelProvider || "",
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 0,
      cost: 0,
      callCount: 0,
    };
  }
  const m = day.models[modelId];
  m.inputTokens += norm.inputTokens;
  m.outputTokens += norm.outputTokens;
  m.cacheReadTokens += norm.cacheReadTokens;
  m.cacheWriteTokens += norm.cacheWriteTokens;
  m.totalTokens += norm.totalTokens;
  if (norm.costTotal !== null) m.cost += norm.costTotal;
  m.callCount += 1;

  // 保留最近 90 天
  const cutoff = daysAgoStr(90);
  for (const d of Object.keys(daily)) {
    if (d < cutoff && d !== date) delete daily[d];
  }

  try {
    fs.writeFileSync(filePath, JSON.stringify(daily, null, 2), "utf-8");
  } catch (e) {
    console.error("[token-stats] updateDaily error:", e.message);
  }
}

// ─── 插件生命周期 ──────────────────────────────────

export default class TokenStatsPlugin {
  async onload() {
    const { dataDir, bus, log } = this.ctx;

    // 确保数据目录存在
    try { fs.mkdirSync(dataDir, { recursive: true }); } catch { /* 忽略 */ }

    log.info("token-stats 已加载，正在订阅 token_usage 事件");

    const unsubscribe = bus.subscribe((event, sessionPath) => {
      if (event?.type !== "token_usage") return;
      if (!event.usage) return;

      const normalized = normalizeUsage(event.usage);
      if (!normalized) return;

      const date = todayStr();
      const now = new Date();
      const record = {
        ts: now.getTime(),
        date,
        hour: now.getHours(),
        modelId: event.modelId ?? "unknown",
        modelProvider: event.modelProvider ?? "",
        sessionPath: sessionPath ?? null,
        ...normalized,
      };

      appendRecord(dataDir, record);
      updateDaily(dataDir, date, event.modelId ?? "unknown", event.modelProvider ?? "", normalized);
    });

    // 注册清理函数，插件卸载时取消订阅
    this.register?.(() => unsubscribe());
    this._unsubscribe = unsubscribe;
  }

  async onunload() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
  }
}
