# OpenCode Providers

Integrates [OpenCode](https://opencode.ai) model subscription services into Hanako:

## OpenCode Zen

Pay-as-you-go access to GPT 5.5, Claude Opus 4.7, Gemini 3.1 Pro, Kimi K2.5, Qwen3.6 Plus, and more.

- **Base URL**: `https://opencode.ai/zen/v1`
- **Auth**: API Key (from [opencode.ai/auth](https://opencode.ai/auth))
- **Protocol**: OpenAI-compatible

## OpenCode Go

Subscription plan ($5 first month, $10/month thereafter) for DeepSeek V4 Pro/Flash, Kimi K2.5/K2.6, Qwen3.5/3.6 Plus, MiniMax M2.7, and other curated open-source models.

- **Base URL**: `https://opencode.ai/zen/go/v1`
- **Auth**: API Key (subscribe to Go first, then get key from [opencode.ai/auth](https://opencode.ai/auth))
- **Protocol**: OpenAI-compatible

## Usage

1. Install this plugin, go to Settings → Providers
2. Find **OpenCode Zen** or **OpenCode Go** in the API Key provider list
3. Enter your API Key and save
4. Select the model in your agent settings
