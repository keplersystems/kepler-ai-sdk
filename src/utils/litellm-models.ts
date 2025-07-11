import type {
  ModelInfo,
  ModelCapabilities,
  ModelPricing,
} from "../core/interfaces";

/**
 * LiteLLM model data structure
 * Based on https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json
 */
interface LiteLLMModel {
  max_tokens?: number;
  max_input_tokens?: number;
  max_output_tokens?: number;
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  output_cost_per_reasoning_token?: number;
  litellm_provider?: string;
  mode?: string;
  supports_function_calling?: boolean;
  supports_parallel_function_calling?: boolean;
  supports_vision?: boolean;
  supports_audio_input?: boolean;
  supports_audio_output?: boolean;
  supports_prompt_caching?: boolean;
  supports_response_schema?: boolean;
  supports_system_messages?: boolean;
  supports_reasoning?: boolean;
  supports_web_search?: boolean;
  supports_pdf_input?: boolean;
  supports_video_input?: boolean;
  supports_tool_choice?: boolean;
  supported_modalities?: string[];
  deprecation_date?: string;
}

/**
 * Manages LiteLLM model data with caching and fallback support
 */
export class LiteLLMModelManager {
  private modelData: Record<string, LiteLLMModel> | null = null;
  private lastFetch: number = 0;
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour cache
  private readonly LITELLM_URL =
    "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";

  /**
   * Fetch latest model data from LiteLLM repository
   */
  async fetchModelData(
    forceRefresh = false
  ): Promise<Record<string, LiteLLMModel>> {
    const now = Date.now();

    // Return cached data if still valid
    if (
      !forceRefresh &&
      this.modelData &&
      now - this.lastFetch < this.CACHE_TTL
    ) {
      return this.modelData;
    }

    try {
      console.debug("Fetching LiteLLM model data...");
      const response = await fetch(this.LITELLM_URL);

      if (!response.ok) {
        throw new Error(`Failed to fetch LiteLLM data: ${response.status}`);
      }

      const data = (await response.json()) as Record<string, LiteLLMModel>;

      // Remove the sample_spec entry
      delete data.sample_spec;

      this.modelData = data;
      this.lastFetch = now;

      console.debug(`Loaded ${Object.keys(data).length} models from LiteLLM`);
      return data;
    } catch (error) {
      console.warn("Failed to fetch LiteLLM model data:", error);

      // Return cached data if available
      if (this.modelData) {
        console.debug("Using cached LiteLLM data");
        return this.modelData;
      }

      // Return empty object as fallback
      return {};
    }
  }

  /**
   * Get model information for a specific model ID
   */
  async getModelInfo(
    modelId: string,
    provider?: string
  ): Promise<ModelInfo | null> {
    const data = await this.fetchModelData();

    // If user requests a prefixed model from problematic providers, try to find the non-prefixed version
    if (modelId.startsWith('gemini/') || modelId.startsWith('mistral/')) {
      const unprefixedId = modelId.split('/').slice(1).join('/');
      const unprefixedData = data[unprefixedId];
      if (unprefixedData) {
        return this.convertToModelInfo(unprefixedId, unprefixedData);
      }
    }

    // Try exact match first
    let modelData = data[modelId];

    // Try with provider prefix if not found
    if (!modelData && provider) {
      modelData = data[`${provider}/${modelId}`];
    }

    // Try OpenRouter format
    if (!modelData) {
      modelData = data[`openrouter/${modelId}`];
    }

    if (!modelData) {
      return null;
    }

    return this.convertToModelInfo(modelId, modelData);
  }

  /**
   * Get all available models from LiteLLM
   */
  async getAllModels(): Promise<ModelInfo[]> {
    const data = await this.fetchModelData();
    const models: ModelInfo[] = [];
    const seenModels = new Set<string>();

    for (const [modelId, modelData] of Object.entries(data)) {
      // Remove provider prefix for gemini and mistral to avoid duplicates
      let normalizedId = modelId;
      if (modelId.startsWith('gemini/') || modelId.startsWith('mistral/')) {
        normalizedId = modelId.split('/').slice(1).join('/');
      }
      
      // Skip if we've already seen this normalized model
      if (seenModels.has(normalizedId)) {
        continue;
      }
      seenModels.add(normalizedId);

      const modelInfo = this.convertToModelInfo(normalizedId, modelData);
      if (modelInfo) {
        models.push(modelInfo);
      }
    }

    return models.sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * Get all models for a specific provider
   */
  async getModelsByProvider(provider: string): Promise<ModelInfo[]> {
    const data = await this.fetchModelData();
    const models: ModelInfo[] = [];
    const seenModels = new Set<string>();

    for (const [modelId, modelData] of Object.entries(data)) {
      if (modelData.litellm_provider === provider) {
        // Remove provider prefix for gemini and mistral to avoid duplicates
        let normalizedId = modelId;
        if (modelId.startsWith('gemini/') || modelId.startsWith('mistral/')) {
          normalizedId = modelId.split('/').slice(1).join('/');
        }
        
        // Skip if we've already seen this normalized model
        if (seenModels.has(normalizedId)) {
          continue;
        }
        seenModels.add(normalizedId);

        const modelInfo = this.convertToModelInfo(normalizedId, modelData);
        if (modelInfo) {
          models.push(modelInfo);
        }
      }
    }

    return models;
  }

  /**
   * Search models by a single capability
   */
  async findModelsByCapability(
    capability: keyof ModelCapabilities
  ): Promise<ModelInfo[]> {
    return this.findModelsByCapabilities([capability]);
  }

  /**
   * Search models by capabilities
   */
  async findModelsByCapabilities(
    capabilities: (keyof ModelCapabilities)[]
  ): Promise<ModelInfo[]> {
    const data = await this.fetchModelData();
    const models: ModelInfo[] = [];
    const seenModels = new Set<string>();

    for (const [modelId, modelData] of Object.entries(data)) {
      // Remove provider prefix for gemini and mistral to avoid duplicates
      let normalizedId = modelId;
      if (modelId.startsWith('gemini/') || modelId.startsWith('mistral/')) {
        normalizedId = modelId.split('/').slice(1).join('/');
      }
      
      // Skip if we've already seen this normalized model
      if (seenModels.has(normalizedId)) {
        continue;
      }
      seenModels.add(normalizedId);

      const modelInfo = this.convertToModelInfo(normalizedId, modelData);
      if (!modelInfo) continue;

      // Check if model has all required capabilities
      const hasAllCapabilities = capabilities.every((capability) => {
        switch (capability) {
          case "functionCalling":
            return modelData.supports_function_calling;
          case "vision":
            return modelData.supports_vision;
          case "audio":
            return (
              modelData.supports_audio_input || modelData.supports_audio_output
            );
          case "reasoning":
            return modelData.supports_reasoning;
          case "documents":
            return modelData.supports_pdf_input;
          case "video":
            return modelData.supports_video_input;
          case "embeddings":
            return modelData.mode === "embedding";
          case "streaming":
            return modelData.mode === "chat"; // Most chat models support streaming
          default:
            return false;
        }
      });

      if (hasAllCapabilities) {
        models.push(modelInfo);
      }
    }

    return models.sort(
      (a, b) => (a.pricing?.inputTokens || 0) - (b.pricing?.inputTokens || 0)
    );
  }

  /**
   * Get the cheapest model with specific capabilities
   */
  async getCheapestModel(
    capabilities: (keyof ModelCapabilities)[] = []
  ): Promise<ModelInfo | null> {
    const compatibleModels = await this.findModelsByCapabilities(capabilities);
    const modelsWithPricing = compatibleModels.filter(
      (m) => m.pricing?.inputTokens
    );

    if (modelsWithPricing.length === 0) return null;

    return modelsWithPricing.sort(
      (a, b) => a.pricing!.inputTokens - b.pricing!.inputTokens
    )[0];
  }

  /**
   * Convert LiteLLM model data to our ModelInfo format
   */
  private convertToModelInfo(
    modelId: string,
    data: LiteLLMModel
  ): ModelInfo | null {
    if (!data.litellm_provider) return null;

    // Extract provider from model ID or use litellm_provider
    const provider = this.extractProvider(modelId, data.litellm_provider);

    // Convert capabilities
    const capabilities: ModelCapabilities = {
      streaming: data.mode === "chat", // Most chat models support streaming
      functionCalling: data.supports_function_calling || false,
      vision: data.supports_vision || false,
      audio: data.supports_audio_input || data.supports_audio_output || false,
      embeddings: data.mode === "embedding",
      reasoning: data.supports_reasoning || false,
      video: data.supports_video_input || false,
      documents: data.supports_pdf_input || false,
    };

    // Convert pricing
    let pricing: ModelPricing | undefined;
    if (data.input_cost_per_token && data.output_cost_per_token) {
      pricing = {
        inputTokens: data.input_cost_per_token * 1_000_000, // Convert to per million tokens
        outputTokens: data.output_cost_per_token * 1_000_000,
        reasoningTokens: data.output_cost_per_reasoning_token
          ? data.output_cost_per_reasoning_token * 1_000_000
          : undefined,
      };
    }

    return {
      id: modelId,
      provider,
      name: this.formatModelName(modelId),
      contextWindow: data.max_input_tokens || data.max_tokens || 4096,
      maxOutputTokens: data.max_output_tokens,
      capabilities,
      pricing,
      metadata: {
        litellmProvider: data.litellm_provider,
        mode: data.mode,
        deprecationDate: data.deprecation_date,
        supportedModalities: data.supported_modalities,
      },
    };
  }

  /**
   * Extract provider name from model ID
   */
  private extractProvider(modelId: string, litellmProvider: string): string {
    // Handle OpenRouter format
    if (modelId.startsWith("openrouter/")) {
      return "openrouter";
    }

    // Handle provider/model format
    if (modelId.includes("/")) {
      const parts = modelId.split("/");
      return parts[0];
    }

    // Map LiteLLM providers to our provider names
    const providerMap: Record<string, string> = {
      openai: "openai",
      anthropic: "anthropic",
      gemini: "gemini",
      mistral: "mistral",
      cohere: "cohere",
      openrouter: "openrouter",
    };

    return providerMap[litellmProvider] || litellmProvider;
  }

  /**
   * Format model name for display
   */
  private formatModelName(modelId: string): string {
    // Remove provider prefix
    const name = modelId.includes("/")
      ? modelId.split("/").slice(1).join("/")
      : modelId;

    // Capitalize and format
    return name
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }


  /**
   * Get cache statistics
   */
  getCacheInfo(): {
    cached: boolean;
    lastFetch: Date | null;
    modelCount: number;
  } {
    return {
      cached: this.modelData !== null,
      lastFetch: this.lastFetch ? new Date(this.lastFetch) : null,
      modelCount: this.modelData ? Object.keys(this.modelData).length : 0,
    };
  }
}

// Global instance
export const litellmModelManager = new LiteLLMModelManager();
