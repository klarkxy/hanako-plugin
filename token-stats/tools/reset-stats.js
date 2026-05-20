// tools/reset-stats.js
// 重置所有 Token 用量统计数据（谨慎使用）
import fs from "node:fs";
import path from "node:path";

export const name = "reset_token_stats";
export const description = "⚠️ 重置所有 Token 用量统计数据，清空原始记录和汇总。此操作不可撤销！";
export const parameters = {
  type: "object",
  properties: {
    confirm: {
      type: "boolean",
      description: "必须设为 true 才能执行重置操作，防止误触",
    },
  },
  required: ["confirm"],
};

export async function execute(input, ctx) {
  if (input.confirm !== true) {
    return "⚠️ 操作已取消。如需重置请设置 confirm=true。";
  }

  const recordsPath = path.join(ctx.dataDir, "records.jsonl");
  const dailyPath = path.join(ctx.dataDir, "daily.json");

  let removed = 0;

  if (fs.existsSync(recordsPath)) {
    fs.unlinkSync(recordsPath);
    removed++;
  }
  if (fs.existsSync(dailyPath)) {
    fs.unlinkSync(dailyPath);
    removed++;
  }

  return `✅ 已清空 Token 用量数据（移除了 ${removed} 个文件）。从现在开始重新统计。`;
}
