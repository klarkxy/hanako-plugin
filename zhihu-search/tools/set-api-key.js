// tools/set-api-key.js
// 设置知乎开放平台 Access Secret — Agent 调用此工具来存储密钥

import { setAccessSecret, callZhihuApi } from "../lib/api.js";

export const name = "set_zhihu_api_key";
export const description = "设置知乎开放平台的 Access Secret（密钥），密钥会持久保存。请用户在 https://developer.zhihu.com/profile 获取。";
export const parameters = {
  type: "object",
  properties: {
    accessSecret: {
      type: "string",
      description: "知乎开放平台的 Access Secret（Bearer Token）。从 https://developer.zhihu.com/profile 获取。",
    },
  },
  required: ["accessSecret"],
};

export async function execute(input, ctx) {
  const secret = (input.accessSecret || "").trim();
  if (!secret) {
    return "❌ Access Secret 不能为空。请从 https://developer.zhihu.com/profile 获取。";
  }

  setAccessSecret(ctx.dataDir, secret);

  // 验证密钥是否可用
  try {
    // 用 hot_list?Limit=1 做轻量验证
    await callZhihuApi("hot_list", { Limit: 1 }, ctx.dataDir);
    return `✅ Access Secret 已保存并通过验证。\n\n${getUsageHint()}`;
  } catch (err) {
    // 保存成功了但验证失败 — 可能是密钥不对或网络问题
    return (
      `⚠️ Access Secret 已保存，但验证失败：${err.message}\n\n` +
      `请检查：\n` +
      `1. 密钥是否从 https://developer.zhihu.com/profile 正确复制\n` +
      `2. 是否已注册并开通 API 服务\n` +
      `3. 网络是否能访问 developer.zhihu.com\n\n` +
      `密钥已保存，可以稍后重试。`
    );
  }
}

function getUsageHint() {
  return [
    `📋 接下来你可以：`,
    `• 使用 zhihu_search 工具进行知乎站内搜索`,
    `• 使用 global_search 工具进行全网搜索`,
    `• 使用 zhida 工具进行知乎直答（适合复杂问题）`,
    `• 使用 hot_list 工具查看知乎热榜`,
    `• 使用 query_zhihu_quota 工具查看今日额度使用情况`,
  ].join("\n");
}
