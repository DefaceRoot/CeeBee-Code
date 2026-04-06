# Providers

Pi supports provider authentication via `/login`, environment variables, and `auth.json`. Some `/login` providers return refreshable OAuth credentials, others save API keys after a provider-hosted login flow. For each built-in model provider, pi knows all available models. The list is updated with every pi release.

## Table of Contents

- [Interactive Login](#interactive-login)
- [API Keys](#api-keys)
- [Auth File](#auth-file)
- [Web Search](#web-search)
- [Cloud Providers](#cloud-providers)
- [Custom Providers](#custom-providers)
- [Resolution Order](#resolution-order)

## Interactive Login

Use `/login` in interactive mode to authenticate with a provider, and `/logout` to remove saved credentials for that provider.

**Refreshable OAuth providers:**
- Claude Pro/Max
- ChatGPT Plus/Pro (Codex)
- GitHub Copilot
- Google Gemini CLI
- Google Antigravity

**Other login-capable providers:**
- Kilo Gateway (device login, saves an API key)
- Apertis.ai
- Fireworks AI
- Tavily
- Parallel
- Perplexity
- Z.AI

### GitHub Copilot

- Press Enter for github.com, or enter your GitHub Enterprise Server domain
- If you get "model not supported", enable it in VS Code: Copilot Chat → model selector → select model → "Enable"

### Google Providers

- **Gemini CLI**: Standard Gemini models via Cloud Code Assist
- **Antigravity**: Sandbox with Gemini 3, Claude, and GPT-OSS models
- Both free with any Google account, subject to rate limits
- For paid Cloud Code Assist: set `GOOGLE_CLOUD_PROJECT` env var

### OpenAI Codex

- Requires ChatGPT Plus or Pro subscription
- Personal use only; for production, use the OpenAI Platform API

### Kilo Gateway

- `/login kilo` uses a device authorization flow and saves the resulting API key in `auth.json`
- The Kilo model provider also supports direct `KILO_API_KEY` configuration

### Perplexity

- `/login perplexity` requests an email one-time code and stores the returned API key in `auth.json`
- `web_search` can also use `PERPLEXITY_COOKIES` as an env-only fallback when no API key is configured

## API Keys

### Environment Variables or Auth File

Set via environment variable:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

| Provider | Environment Variable | `auth.json` key |
|----------|----------------------|------------------|
| Anthropic | `ANTHROPIC_API_KEY` | `anthropic` |
| Apertis.ai | `APERTIS_API_KEY` | `apertis` |
| Azure OpenAI Responses | `AZURE_OPENAI_API_KEY` | `azure-openai-responses` |
| Fireworks AI | `FIREWORKS_API_KEY` | `fireworks` |
| Google Gemini | `GEMINI_API_KEY` | `google` |
| Kilo Gateway | `KILO_API_KEY` | `kilo` |
| Mistral | `MISTRAL_API_KEY` | `mistral` |
| OpenAI | `OPENAI_API_KEY` | `openai` |
| Groq | `GROQ_API_KEY` | `groq` |
| Cerebras | `CEREBRAS_API_KEY` | `cerebras` |
| xAI | `XAI_API_KEY` | `xai` |
| OpenRouter | `OPENROUTER_API_KEY` | `openrouter` |
| Vercel AI Gateway | `AI_GATEWAY_API_KEY` | `vercel-ai-gateway` |
| Z.AI | `ZAI_API_KEY` | `zai` |
| Tavily (`web_search`) | `TAVILY_API_KEY` | `tavily` |
| Parallel (`web_search`) | `PARALLEL_API_KEY` | `parallel` |
| Perplexity (`web_search`) | `PERPLEXITY_API_KEY` | `perplexity` |
| OpenCode Zen | `OPENCODE_API_KEY` | `opencode` |
| OpenCode Go | `OPENCODE_API_KEY` | `opencode-go` |
| Hugging Face | `HF_TOKEN` | `huggingface` |
| Kimi For Coding | `KIMI_API_KEY` | `kimi-coding` |
| MiniMax | `MINIMAX_API_KEY` | `minimax` |
| MiniMax (China) | `MINIMAX_CN_API_KEY` | `minimax-cn` |

Reference for environment variables and `auth.json` keys: [`const envMap`](https://github.com/badlogic/pi-mono/blob/main/packages/ai/src/env-api-keys.ts) in [`packages/ai/src/env-api-keys.ts`](https://github.com/badlogic/pi-mono/blob/main/packages/ai/src/env-api-keys.ts).

#### Auth File

Store credentials in `~/.pi/agent/auth.json`:

```json
{
  "anthropic": { "type": "api_key", "key": "sk-ant-..." },
  "github-copilot": {
    "type": "oauth",
    "access": "...",
    "refresh": "...",
    "expires": 1760000000000
  },
  "perplexity": { "type": "api_key", "key": "pplx-..." },
  "tavily": { "type": "api_key", "key": "tvly-..." }
}
```

`/login` stores either `{ "type": "oauth", ... }` or `{ "type": "api_key", "key": "..." }`, depending on the provider. The file is created with `0600` permissions (user read/write only). Auth file credentials take priority over environment variables.

### Key Resolution

The `key` field supports three formats:

- **Shell command:** `"!command"` executes and uses stdout (cached for process lifetime)
  ```json
  { "type": "api_key", "key": "!security find-generic-password -ws 'anthropic'" }
  { "type": "api_key", "key": "!op read 'op://vault/item/credential'" }
  ```
- **Environment variable:** Uses the value of the named variable
  ```json
  { "type": "api_key", "key": "MY_ANTHROPIC_KEY" }
  ```
- **Literal value:** Used directly
  ```json
  { "type": "api_key", "key": "sk-ant-..." }
  ```

Refreshable OAuth credentials are also stored here after `/login` and refreshed automatically when they expire.

## Web Search

Enable the built-in web search tool by including `web_search` in your tool list:

```bash
pi --tools read,bash,edit,write,web_search
```

Built-in provider fallback order:

1. Tavily
2. Perplexity
3. Z.AI
4. Parallel

Credential resolution for `web_search`:

- **Tavily**: `TAVILY_API_KEY` or `auth.json` / `/login tavily`
- **Perplexity**: `PERPLEXITY_API_KEY`, `auth.json` / `/login perplexity`, or `PERPLEXITY_COOKIES`
- **Z.AI**: `ZAI_API_KEY` or `auth.json` / `/login zai`
- **Parallel**: `PARALLEL_API_KEY` or `auth.json` / `/login parallel`

Notes:

- Automatic mode walks the fallback order above and continues to the next configured provider if the current provider fails.
- Setting `provider` in the `web_search` tool input disables fallback. pi only queries that provider and does not probe the others.
- Tavily's current API expects its API key in the JSON request body rather than an `Authorization` header. This matches Tavily's documented API, but it means the key may appear in provider-side request logs.
- `PERPLEXITY_COOKIES` is env-only. It is used only for Perplexity web search when no API key is available. Set it to a single-line `Cookie` header value.
- The current Z.AI `web_search` implementation reports a limitation because this build does not include the remote MCP client required for Z.AI's search endpoint.

## Cloud Providers

### Azure OpenAI

```bash
export AZURE_OPENAI_API_KEY=...
export AZURE_OPENAI_BASE_URL=https://your-resource.openai.azure.com
# or use resource name instead of base URL
export AZURE_OPENAI_RESOURCE_NAME=your-resource

# Optional
export AZURE_OPENAI_API_VERSION=2024-02-01
export AZURE_OPENAI_DEPLOYMENT_NAME_MAP=gpt-4=my-gpt4,gpt-4o=my-gpt4o
```

### Amazon Bedrock

```bash
# Option 1: AWS Profile
export AWS_PROFILE=your-profile

# Option 2: IAM Keys
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...

# Option 3: Bearer Token
export AWS_BEARER_TOKEN_BEDROCK=...

# Optional region (defaults to us-east-1)
export AWS_REGION=us-west-2
```

Also supports ECS task roles (`AWS_CONTAINER_CREDENTIALS_*`) and IRSA (`AWS_WEB_IDENTITY_TOKEN_FILE`).

```bash
pi --provider amazon-bedrock --model us.anthropic.claude-sonnet-4-20250514-v1:0
```

Prompt caching is enabled automatically for Claude models whose ID contains a recognizable model name (base models and system-defined inference profiles). For application inference profiles (whose ARNs don't contain the model name), set `AWS_BEDROCK_FORCE_CACHE=1` to enable cache points:

```bash
export AWS_BEDROCK_FORCE_CACHE=1
pi --provider amazon-bedrock --model arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/abc123
```

If you are connecting to a Bedrock API proxy, the following environment variables can be used:

```bash
# Set the URL for the Bedrock proxy (standard AWS SDK env var)
export AWS_ENDPOINT_URL_BEDROCK_RUNTIME=https://my.corp.proxy/bedrock

# Set if your proxy does not require authentication
export AWS_BEDROCK_SKIP_AUTH=1

# Set if your proxy only supports HTTP/1.1
export AWS_BEDROCK_FORCE_HTTP1=1
```

### Google Vertex AI

Uses Application Default Credentials:

```bash
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT=your-project
export GOOGLE_CLOUD_LOCATION=us-central1
```

Or set `GOOGLE_APPLICATION_CREDENTIALS` to a service account key file.

## Custom Providers

**Via models.json:** Add Ollama, LM Studio, vLLM, or any provider that speaks a supported API (OpenAI Completions, OpenAI Responses, Anthropic Messages, Google Generative AI). See [models.md](models.md).

**Via extensions:** For providers that need custom API implementations or OAuth flows, create an extension. See [custom-provider.md](custom-provider.md) and [examples/extensions/custom-provider-gitlab-duo](../examples/extensions/custom-provider-gitlab-duo/).

## Resolution Order

When resolving credentials for a provider:

1. CLI `--api-key` flag
2. `auth.json` entry (API key or OAuth token)
3. Environment variable
4. Custom provider keys from `models.json`

Provider-specific fallbacks can add extra sources on top of this. For example, Perplexity `web_search` also checks `PERPLEXITY_COOKIES` when no API key is configured.
