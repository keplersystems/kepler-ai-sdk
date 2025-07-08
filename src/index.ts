// Core interfaces
export type {
  Message,
  ContentPart,
  JSONSchemaProperty,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
  ResponseFormat,
  TokenUsage,
  ToolDefinition,
  ToolCall,
  ToolResult,
  ModelCapabilities,
  ModelInfo,
  ModelPricing,
  EmbeddingRequest,
  EmbeddingResponse,
  ImageRequest,
  ImageResponse,
  AudioRequest,
  AudioResponse,
  ProviderAdapter,
} from "./core/interfaces";

// Essential OAuth interfaces (apps implement TokenStorage themselves)
export type {
  OAuthToken,
  OAuthConfig,
  TokenStorage,
  OAuthErrorType,
} from "./core/oauth";

// OAuth implementation
export { OAuth } from "./auth/oauth";

// Error handling
export { LLMError } from "./errors/LLMError";

// Provider adapters
export { OpenAIProvider } from "./providers/openai";
export { AnthropicProvider } from "./providers/anthropic";
export { GeminiProvider } from "./providers/gemini";
export { CohereProvider } from "./providers/cohere";
export { MistralProvider } from "./providers/mistral";
export { OpenRouterProvider } from "./providers/openrouter";
export { GitHubCopilotProvider } from "./providers/github-copilot";

// Model management
export { ModelManager } from "./models/ModelManager";
export { litellmModelManager } from "./utils/litellm-models";

// Pricing and usage tracking
export { PricingCalculator } from "./pricing/PricingCalculator";
export type { CostBreakdown } from "./pricing/PricingCalculator";

export { UsageTracker } from "./usage/UsageTracker";
export type {
  UsageStats,
  RequestRecord,
  UsageTrend,
} from "./usage/UsageTracker";

// Version
export const VERSION = "1.0.0";
