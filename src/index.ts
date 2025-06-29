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
    ProviderAdapter
} from './core/interfaces.js';

// Error handling
export { LLMError } from './errors/LLMError.js';

// Provider adapters
export { OpenAIProvider } from './providers/openai.js';
export { AnthropicProvider } from './providers/anthropic.js';
export { GeminiProvider } from './providers/gemini.js';
export { OpenRouterProvider } from './providers/openrouter.js';

// Model management
export { ModelManager } from './models/ModelManager.js';

// Pricing and usage tracking
export { PricingCalculator } from './pricing/PricingCalculator.js';
export type { CostBreakdown } from './pricing/PricingCalculator.js';

export { UsageTracker } from './usage/UsageTracker.js';
export type {
    UsageStats,
    RequestRecord,
    UsageTrend
} from './usage/UsageTracker.js';

// Version
export const VERSION = '1.0.0';
