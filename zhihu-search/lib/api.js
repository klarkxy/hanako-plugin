// lib/api.js — 知乎开放平台 API 共享调用库
// 处理鉴权、额度追踪、API 请求封装

import fs from "node:fs";
import path from "node:path";

// ─── 常量 ───

const BASE_URL = "https://developer.zhihu.com/api/v1/content";
const DAILY_QUOTA = 1000; // 免费套餐每日调用上限（zhihu_search + global_search）
const QUOTA_FILE = "quota.json";
const CONFIG_FILE = "config.json";

// ─── 配置读写 ───

/** 从 dataDir 读取配置文件 */
function readConfig(dataDir) {
  const configPath = path.join(dataDir, CONFIG_FILE);
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    return {};
  }
}

/** 写入配置文件 */
function writeConfig(dataDir, config) {
  fs.mkdirSync(dataDir, { recursive: true });
  const configPath = path.join(dataDir, CONFIG_FILE);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
}

/** 获取保存的 Access Secret */
export function getAccessSecret(dataDir) {
  const config = readConfig(dataDir);
  return config.accessSecret || null;
}

/** 保存 Access Secret */
export function setAccessSecret(dataDir, secret) {
  const config = readConfig(dataDir);
  config.accessSecret = secret;
  writeConfig(dataDir, config);
}

/** 检查是否已配置密钥 */
export function hasAccessSecret(dataDir) {
  return !!getAccessSecret(dataDir);
}

// ─── 额度追踪 ───

/** 获取今日额度使用情况 */
export function getQuotaInfo(dataDir) {
  const quotaPath = path.join(dataDir, QUOTA_FILE);
  let quota = {};
  try {
    quota = JSON.parse(fs.readFileSync(quotaPath, "utf8"));
  } catch {
    quota = {};
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayData = quota[today] || { zhihuSearch: 0, globalSearch: 0, zhida: 0, hotList: 0 };

  return {
    date: today,
    zhihuSearch: todayData.zhihuSearch || 0,
    globalSearch: todayData.globalSearch || 0,
    zhida: todayData.zhida || 0,
    hotList: todayData.hotList || 0,
    quotaRemaining: DAILY_QUOTA - (todayData.zhihuSearch || 0) - (todayData.globalSearch || 0),
    quotaTotal: DAILY_QUOTA,
  };
}

/** 记录一次 API 调用 */
export function recordUsage(dataDir, endpoint) {
  const quotaPath = path.join(dataDir, QUOTA_FILE);
  let quota = {};
  try {
    quota = JSON.parse(fs.readFileSync(quotaPath, "utf8"));
  } catch {
    quota = {};
  }

  const today = new Date().toISOString().slice(0, 10);
  if (!quota[today]) {
    quota[today] = { zhihuSearch: 0, globalSearch: 0, zhida: 0, hotList: 0 };
  }

  // 将 endpoint 映射到统计字段
  const keyMap = {
    "zhihu_search": "zhihuSearch",
    "global_search": "globalSearch",
    "zhida": "zhida",
    "hot_list": "hotList",
  };
  const key = keyMap[endpoint] || endpoint;
  quota[today][key] = (quota[today][key] || 0) + 1;

  // 只保留最近 90 天
  const dates = Object.keys(quota).sort();
  if (dates.length > 90) {
    const toRemove = dates.slice(0, dates.length - 90);
    for (const d of toRemove) delete quota[d];
  }

  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(quotaPath, JSON.stringify(quota, null, 2), "utf8");
}

/** 检查 zhihu_search / global_search 是否还有免费额度 */
export function hasQuotaRemaining(dataDir) {
  const info = getQuotaInfo(dataDir);
  return info.quotaRemaining > 0;
}

// ─── API 请求封装 ───

/** 生成秒级 Unix 时间戳 */
function unixTimestamp() {
  return Math.floor(Date.now() / 1000);
}

/** 调用知乎开放平台 API */
export async function callZhihuApi(endpoint, params, dataDir) {
  const accessSecret = getAccessSecret(dataDir);
  if (!accessSecret) {
    throw new Error("未配置 Access Secret。请使用 set_zhihu_api_key 工具先配置密钥。");
  }

  const url = new URL(`${BASE_URL}/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const timestamp = unixTimestamp();

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessSecret}`,
      "X-Request-Timestamp": String(timestamp),
      "Content-Type": "application/json",
    },
  });

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`API 返回非 JSON 响应 (HTTP ${response.status})：${text.slice(0, 200)}`);
  }

  // 知乎 API 错误处理
  if (payload.Code && payload.Code !== 0) {
    // Code 20001 = 鉴权失败
    if (payload.Code === 20001) {
      throw new Error(`知乎 API 鉴权失败：${payload.Message}。请检查 Access Secret 是否正确。`);
    }
    throw new Error(`知乎 API 错误 (${payload.Code})：${payload.Message || "未知错误"}`);
  }

  // 记录调用次数
  recordUsage(dataDir, endpoint);

  return payload;
}

/** 获取额度信息的格式化文本 */
export function formatQuotaInfo(dataDir) {
  const info = getQuotaInfo(dataDir);
  return [
    `📊 今日额度使用情况`,
    `├─ 知乎搜索 (zhihu_search)：${info.zhihuSearch} 次`,
    `├─ 全网搜索 (global_search)：${info.globalSearch} 次`,
    `├─ 知乎直答 (zhida)：${info.zhida} 次`,
    `├─ 热榜 (hot_list)：${info.hotList} 次`,
    `├─ 已用额度：${info.zhihuSearch + info.globalSearch} / ${info.quotaTotal}`,
    `└─ 剩余免费额度：${info.quotaRemaining}`,
  ].join("\n");
}

/** 判断一个问题是否「复杂」到需要直答 */
export function isComplexQuestion(query) {
  if (!query || typeof query !== "string") return false;
  const q = query.trim();

  // 长度超过 80 字视为复杂
  if (q.length > 80) return true;

  // 包含多个问号或分句
  const questionMarks = (q.match(/[？?]/g) || []).length;
  if (questionMarks >= 2) return true;

  // 分析类关键词
  const complexKeywords = [
    "为什么", "如何", "怎样", "怎么才能", "原理", "机制",
    "分析", "比较", "区别", "差异", "优缺点", "影响",
    "关系", "联系", "论证", "解释", "背景", "原因",
    "发展", "趋势", "未来", "展望", "综述", "概述",
    "详细", "深入", "全面", "系统",
  ];
  for (const kw of complexKeywords) {
    if (q.includes(kw)) return true;
  }

  return false;
}
