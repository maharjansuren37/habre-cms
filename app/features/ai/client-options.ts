/**
 * The SDK clients' options (18b2, F-347). Both SDKs read settings from the
 * environment that the app never validates: a base URL (the request and key go
 * elsewhere), Anthropic's auth token (an extra credential), and a log level
 * whose `debug` writes request bodies - the customer's description - to the
 * journal. Every one is pinned here, so only our own variables configure a
 * provider. `warn` keeps the SDKs' own warnings and never logs a request.
 */
const LOG_LEVEL = "warn" as const;

export const openRouterClientOptions = (apiKey: string) => ({
  apiKey,
  baseURL: "https://openrouter.ai/api/v1",
  logLevel: LOG_LEVEL,
  maxRetries: 2,
  defaultHeaders: { "X-Title": "Habre" },
});

export const openAIClientOptions = (apiKey: string) => ({
  apiKey,
  baseURL: "https://api.openai.com/v1",
  logLevel: LOG_LEVEL,
  maxRetries: 2,
});

export const anthropicClientOptions = (apiKey: string) => ({
  apiKey,
  authToken: null,
  baseURL: "https://api.anthropic.com",
  logLevel: LOG_LEVEL,
  maxRetries: 2,
});
