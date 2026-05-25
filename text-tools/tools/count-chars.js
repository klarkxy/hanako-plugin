// tools/count-chars.js
// 字数统计 — 统计指定文档的中文字数和所有字符数

import fs from "node:fs";
import path from "node:path";

export const name = "count_chars";
export const description =
  "统计指定文档的字数与字符数。返回中文字数、所有字符数（含标点、空格、换行等）、以及文件的字节大小。支持直接传入文本或传入文件路径。";
export const parameters = {
  type: "object",
  properties: {
    filePath: {
      type: "string",
      description: "要统计的文档的绝对路径。与 text 二选一，优先使用 filePath。",
    },
    text: {
      type: "string",
      description: "要统计的文本内容。当 filePath 为空时使用。",
    },
  },
  required: [],
};

/**
 * 判断一个字符是否为中文字（CJK 汉字）
 * 使用 Unicode Script=Han 属性，覆盖基本汉字区、扩展区与兼容汉字区
 */
function isHanChar(ch) {
  // \p{Script=Han} 需要 u flag
  return /\p{Script=Han}/u.test(ch);
}

/**
 * 执行字数统计
 */
export async function execute(input, ctx) {
  let source = "";
  let sourceLabel = "";

  // 优先读取文件
  if (input.filePath && input.filePath.trim()) {
    const filePath = input.filePath.trim();
    const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);

    try {
      source = fs.readFileSync(resolved, "utf-8");
      sourceLabel = path.basename(resolved);
    } catch (err) {
      return `❌ 无法读取文件：${err.message}`;
    }
  } else if (input.text && input.text.trim()) {
    source = input.text;
    sourceLabel = "输入文本";
  } else {
    return "❌ 请提供要统计的文档路径（filePath）或文本内容（text）。";
  }

  const totalChars = source.length;
  let hanChars = 0;

  for (const ch of source) {
    if (isHanChar(ch)) {
      hanChars++;
    }
  }

  const nonHanChars = totalChars - hanChars;
  const byteLength = Buffer.byteLength(source, "utf-8");

  const lines = [
    `📊 字数统计${sourceLabel ? `：${sourceLabel}` : ""}`,
    "",
    `| 项目 | 数量 |`,
    `|------|------|`,
    `| 中文字数 | ${hanChars.toLocaleString()} |`,
    `| 非中文其他字符 | ${nonHanChars.toLocaleString()} |`,
    `| 所有字符总数 | ${totalChars.toLocaleString()} |`,
    `| UTF-8 字节数 | ${byteLength.toLocaleString()} |`,
  ];

  return lines.join("\n");
}
