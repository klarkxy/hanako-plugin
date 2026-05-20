/**
 * OpenCode Zen provider
 *
 * 按量付费模式，覆盖 GPT 5.5、Claude Opus 4.7、Gemini 3.1 Pro、Kimi K2.5
 * 等全系列主流模型。
 *
 * API Base URL: https://opencode.ai/zen/v1
 * 认证方式: API Key（从 https://opencode.ai/auth 获取）
 * 协议: OpenAI 兼容（/v1/chat/completions）
 */

export const id = "opencode-zen";
export const displayName = "OpenCode Zen";
export const authType = "api-key";
export const defaultBaseUrl = "https://opencode.ai/zen/v1";
export const defaultApi = "openai-completions";
