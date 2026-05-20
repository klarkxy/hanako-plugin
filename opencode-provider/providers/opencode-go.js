/**
 * OpenCode Go provider
 *
 * 订阅制模式（首月 $5，之后 $10/月），覆盖 DeepSeek V4 Pro/Flash、
 * Kimi K2.5/K2.6、Qwen3.5/3.6 Plus、MiniMax M2.7 等精选开源模型。
 *
 * API Base URL: https://opencode.ai/zen/go/v1
 * 认证方式: API Key（从 https://opencode.ai/auth 订阅 Go 后获取）
 * 协议: OpenAI 兼容（/v1/chat/completions）
 */

export const id = "opencode-go";
export const displayName = "OpenCode Go";
export const authType = "api-key";
export const defaultBaseUrl = "https://opencode.ai/zen/go/v1";
export const defaultApi = "openai-completions";
