// tools/query-quota.js
// 查询当前额度使用情况

import { formatQuotaInfo } from "../lib/api.js";

export const name = "query_zhihu_quota";
export const description = "查询今日知乎 API 额度使用情况。当用户询问额度、配额、剩余次数时使用。";
export const parameters = {
  type: "object",
  properties: {},
};

export async function execute(input, ctx) {
  return formatQuotaInfo(ctx.dataDir);
}
