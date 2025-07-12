import OpenAI from "openai";
import type {
  ProviderAdapter,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
  ModelInfo,
  TokenUsage,
  Message,
  ToolDefinition,
  ToolCall,
  ResponseFormat,
  ImageRequest,
  ImageResponse,
} from "../core/interfaces";
import { LLMError } from "../errors/LLMError";
import { litellmModelManager } from "../utils/litellm-models";

/**
 * Provider adapter for OpenRouter's unified LLM API
 * Provides access to 300+ models from various providers through a single interface
 */
export class OpenRouterProvider implements ProviderAdapter {
  readonly name = "openrouter";

  /** OpenAI SDK client configured for OpenRouter */
  private client: OpenAI;

  /** Cache for model information */
  private modelCache: ModelInfo[] | null = null;
  private modelCacheExpiry: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /** OpenRouter configuration */
  private config: {
    apiKey: string;
    appName?: string;
    appUrl?: string;
    baseURL?: string;
  };

  /**
   * Create a new OpenRouter provider instance
   * @param config - Configuration options for the OpenRouter client
   */
  constructor(config: {
    /** OpenRouter API key */
    apiKey: string;

    /** Your app name for OpenRouter headers */
    appName?: string;

    /** Your app URL for OpenRouter headers */
    appUrl?: string;

    /** Custom base URL (defaults to OpenRouter API) */
    baseURL?: string;
  }) {
    this.config = config;

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": config.appUrl || "https://localhost:3000",
        "X-Title": config.appName || "Kepler AI SDK",
      },
    });
  }

  /**
   * Generate a completion using OpenRouter's chat completions API
   */
  async generateCompletion(
    request: CompletionRequest
  ): Promise<CompletionResponse> {
    try {
      const openAIRequest: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming =
      {
        model: request.model,
        messages: this.convertMessages(request.messages),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: false,
        stop: request.stop,
      };

      if (request.tools) {
        openAIRequest.tools = this.convertTools(request.tools);
        openAIRequest.tool_choice = this.convertToolChoice(request.toolChoice);
      }

      if (request.responseFormat) {
        openAIRequest.response_format = this.convertResponseFormat(
          request.responseFormat
        );
      }

      const response = await this.client.chat.completions.create(openAIRequest);

      return this.convertResponse(response, request.model);
    } catch (error) {
      throw this.handleError(error, "completion generation");
    }
  }

  /**
   * Generate a streaming completion using OpenRouter's streaming API
   */
  async *streamCompletion(
    request: CompletionRequest
  ): AsyncIterable<CompletionChunk> {
    try {
      const openAIRequest: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
        model: request.model,
        messages: this.convertMessages(request.messages),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: true,
        stop: request.stop,
      };

      if (request.tools) {
        openAIRequest.tools = this.convertTools(request.tools);
        openAIRequest.tool_choice = this.convertToolChoice(request.toolChoice);
      }

      const stream = await this.client.chat.completions.create(openAIRequest);

      for await (const chunk of stream) {
        yield this.convertChunk(chunk);
      }
    } catch (error) {
      throw this.handleError(error, "streaming completion");
    }
  }

  /**
   * List all available OpenRouter models
   * Fetches from OpenRouter's models API with caching
   */
  async listModels(): Promise<ModelInfo[]> {
    const now = Date.now();

    // Return cached models if still valid
    if (this.modelCache && now < this.modelCacheExpiry) {
      return this.modelCache;
    }

    try {
      // Fetch models from OpenRouter API
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "HTTP-Referer": this.config.appUrl || "https://localhost:3000",
          "X-Title": this.config.appName || "Kepler AI SDK",
        },
      });

      if (!response.ok) {
        throw new Error(
          `OpenRouter models API failed: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as { data?: any[] };
      const models =
        data.data?.map((model: any) => this.convertOpenRouterModel(model)) ||
        [];

      // Cache the results
      this.modelCache = models;
      this.modelCacheExpiry = now + this.CACHE_TTL;

      return models;
    } catch (error) {
      // If API fails, try LiteLLM data first
      try {
        console.warn("OpenRouter API failed, trying LiteLLM data:", error);
        const litellmModels = await litellmModelManager.getAllModels();
        if (litellmModels.length > 0) {
          // Cache LiteLLM results
          this.modelCache = litellmModels;
          this.modelCacheExpiry = now + this.CACHE_TTL;
          return litellmModels;
        }
      } catch (litellmError) {
        console.warn("LiteLLM also failed:", litellmError);
      }

      // If both fail, return cached models or hardcoded fallback
      if (this.modelCache) {
        console.warn("Using cached OpenRouter models");
        return this.modelCache;
      }

      throw new LLMError(
        `Failed to fetch OpenRouter models: OpenRouter API and LiteLLM both unavailable`,
        error instanceof Error ? error : undefined,
        { provider: "openrouter" }
      );
    }
  }

  /**
   * Get information about a specific OpenRouter model
   */
  async getModel(modelId: string): Promise<ModelInfo | null> {
    const models = await this.listModels();
    return models.find((m) => m.id === modelId) || null;
  }

  /**
   * Generate images using OpenRouter's image generation API
   */
  async generateImage(request: ImageRequest): Promise<ImageResponse> {
    try {
      const response = await this.client.images.generate({
        model: request.model || "openai/dall-e-3",
        prompt: request.prompt,
        size: request.size,
        quality: request.quality,
        n: request.n,
      });

      return {
        images:
          response.data?.map((img) => ({
            url: img.url!,
            revisedPrompt: img.revised_prompt,
          })) || [],
      };
    } catch (error) {
      throw this.handleError(error, "image generation");
    }
  }

  /**
   * Convert unified messages to OpenAI format (OpenRouter uses OpenAI-compatible API)
   */
  private convertMessages(
    messages: Message[]
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map((msg): OpenAI.Chat.ChatCompletionMessageParam => {
      // Handle tool response messages
      if (msg.role === "tool") {
        return {
          role: "tool",
          content: msg.content as string,
          tool_call_id: msg.toolCallId!,
        };
      }

      // Handle simple text messages
      if (typeof msg.content === "string") {
        // For assistant messages with tool calls, include tool_calls
        if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
          return {
            role: "assistant",
            content: msg.content,
            tool_calls: msg.toolCalls.map(toolCall => ({
              id: toolCall.id,
              type: "function" as const,
              function: {
                name: toolCall.name,
                arguments: JSON.stringify(toolCall.arguments),
              },
            })),
          };
        }
        
        return {
          role: msg.role as "system" | "user" | "assistant",
          content: msg.content,
        };
      }

      if (msg.content === null) {
        return {
          role: msg.role as "assistant",
          content: null,
          tool_calls: (msg as any).tool_calls,
        };
      }

      // Handle multimodal content
      const content: OpenAI.Chat.ChatCompletionContentPart[] = msg.content.map(
        (part) => {
          switch (part.type) {
            case "text":
              return { type: "text", text: part.text! };
            case "image":
              return {
                type: "image_url",
                image_url: { url: part.imageUrl! },
              };
            default:
              throw new LLMError(
                `OpenRouter does not support content type: ${part.type}`
              );
          }
        }
      );

      return {
        role: msg.role as "user",
        content,
      };
    });
  }

  /**
   * Convert unified tool definitions to OpenAI format
   */
  private convertTools(
    tools: ToolDefinition[]
  ): OpenAI.Chat.ChatCompletionTool[] {
    return tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Convert unified tool choice to OpenAI format
   */
  private convertToolChoice(choice?: CompletionRequest["toolChoice"]): any {
    if (!choice || choice === "auto") return "auto";
    if (choice === "none") return "none";
    if (choice === "required") return "required";
    if (typeof choice === "object") {
      return { type: "function", function: { name: choice.function.name } };
    }
    return "auto";
  }

  /**
   * Convert unified response format to OpenAI format
   */
  private convertResponseFormat(format?: ResponseFormat): any {
    if (!format) return undefined;

    switch (format.type) {
      case "json_object":
        return { type: "json_object" };
      case "json_schema":
        return {
          type: "json_schema",
          json_schema: format.jsonSchema,
        };
      default:
        return undefined;
    }
  }

  /**
   * Convert OpenRouter response to unified format
   */
  private convertResponse(
    response: OpenAI.Chat.ChatCompletion,
    requestModel: string
  ): CompletionResponse {
    const choice = response.choices[0];
    const message = choice.message;

    // Extract tool calls
    const toolCalls: ToolCall[] = [];
    if (message.tool_calls) {
      for (const call of message.tool_calls) {
        toolCalls.push({
          id: call.id,
          name: call.function.name,
          arguments: JSON.parse(call.function.arguments),
        });
      }
    }

    return {
      id: response.id,
      content: message.content || "",
      model: requestModel, // Use the requested model, not response model
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
      finishReason: this.convertFinishReason(choice.finish_reason),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  /**
   * Convert streaming chunk to unified format
   */
  private convertChunk(
    chunk: OpenAI.Chat.Completions.ChatCompletionChunk
  ): CompletionChunk {
    const choice = chunk.choices[0];
    const delta = choice?.delta;

    // Handle tool calls in streaming
    const toolCalls: Partial<ToolCall>[] = [];
    if (delta?.tool_calls) {
      for (const toolCall of delta.tool_calls) {
        if (toolCall.function) {
          toolCalls.push({
            id: toolCall.id,
            name: toolCall.function.name,
            arguments: toolCall.function.arguments
              ? JSON.parse(toolCall.function.arguments)
              : undefined,
          });
        }
      }
    }

    return {
      id: chunk.id,
      delta: delta?.content || "",
      finished: choice?.finish_reason !== null,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: chunk.usage
        ? {
          promptTokens: chunk.usage.prompt_tokens || 0,
          completionTokens: chunk.usage.completion_tokens || 0,
          totalTokens: chunk.usage.total_tokens || 0,
        }
        : undefined,
    };
  }

  /**
   * Convert finish reason to unified format
   */
  private convertFinishReason(
    reason: string | null
  ): CompletionResponse["finishReason"] {
    switch (reason) {
      case "stop":
        return "stop";
      case "length":
        return "length";
      case "tool_calls":
        return "tool_calls";
      case "content_filter":
        return "content_filter";
      default:
        return "stop";
    }
  }

  /**
   * Convert OpenRouter model info to unified format
   */
  private convertOpenRouterModel(model: any): ModelInfo {
    // Parse pricing information
    let pricing;
    if (model.pricing) {
      pricing = {
        inputTokens: parseFloat(model.pricing.prompt) * 1000000, // Convert to per million tokens
        outputTokens: parseFloat(model.pricing.completion) * 1000000,
        cachedTokens: model.pricing.cached
          ? parseFloat(model.pricing.cached) * 1000000
          : undefined,
        reasoningTokens: model.pricing.reasoning
          ? parseFloat(model.pricing.reasoning) * 1000000
          : undefined,
      };
    }

    // Determine capabilities based on model name and description
    const capabilities = this.inferModelCapabilities(model);

    return {
      id: model.id,
      provider: "openrouter",
      name: model.name || model.id,
      description: model.description,
      contextWindow: model.context_length || 4096,
      maxOutputTokens: model.max_output_tokens,
      capabilities,
      pricing,
      createdAt: model.created ? new Date(model.created * 1000) : undefined,
      type: model.type,
      metadata: {
        originalProvider: this.extractProvider(model.id),
        topProvider: model.top_provider,
        architecture: model.architecture,
        modality: model.modality,
      },
    };
  }

  /**
   * Infer model capabilities from OpenRouter model data
   */
  private inferModelCapabilities(model: any): any {
    const modelId = model.id.toLowerCase();
    const description = (model.description || "").toLowerCase();
    const modality = model.modality || "text";

    // Vision capabilities
    const hasVision =
      modality.includes("image") ||
      modelId.includes("vision") ||
      modelId.includes("claude-3") ||
      modelId.includes("gpt-4o") ||
      modelId.includes("gpt-4-turbo") ||
      modelId.includes("gemini") ||
      modelId.includes("pixtral") ||
      description.includes("vision") ||
      description.includes("image");

    // Audio capabilities
    const hasAudio =
      modality.includes("audio") ||
      description.includes("audio") ||
      description.includes("speech");

    // Video capabilities
    const hasVideo =
      modality.includes("video") ||
      description.includes("video") ||
      modelId.includes("gemini");

    // Document capabilities
    const hasDocuments =
      hasVision || // Vision models usually support documents
      description.includes("document") ||
      description.includes("pdf");

    // Function calling (most modern models support this)
    const hasFunctionCalling =
      !modelId.includes("instruct") &&
      !modelId.includes("base") &&
      !modelId.includes("completion") &&
      !modelId.includes("o1"); // o1 models don't support function calling

    // Reasoning capabilities
    const hasReasoning =
      modelId.includes("o1") ||
      modelId.includes("thinking") ||
      description.includes("reasoning") ||
      description.includes("chain-of-thought");

    // Embeddings (specific embedding models)
    const hasEmbeddings =
      modelId.includes("embed") || description.includes("embedding");

    return {
      streaming: true, // Most OpenRouter models support streaming
      functionCalling: hasFunctionCalling,
      vision: hasVision,
      audio: hasAudio,
      embeddings: hasEmbeddings,
      reasoning: hasReasoning,
      video: hasVideo,
      documents: hasDocuments,
    };
  }

  /**
   * Extract the original provider from model ID
   */
  private extractProvider(modelId: string): string {
    const parts = modelId.split("/");
    return parts.length > 1 ? parts[0] : "unknown";
  }

  /**
   * Get fallback models if API fails
   */
  private getFallbackModels(): ModelInfo[] {
    return [
      {
        id: "openai/gpt-4o",
        provider: "openrouter",
        name: "GPT-4o (OpenRouter)",
        contextWindow: 128000,
        capabilities: {
          streaming: true,
          functionCalling: true,
          vision: true,
          audio: false,
          embeddings: false,
          reasoning: false,
          video: false,
          documents: true,
        },
        pricing: { inputTokens: 5.0, outputTokens: 15.0 },
        metadata: { originalProvider: "openai" },
      },
      {
        id: "anthropic/claude-3.5-sonnet",
        provider: "openrouter",
        name: "Claude 3.5 Sonnet (OpenRouter)",
        contextWindow: 200000,
        capabilities: {
          streaming: true,
          functionCalling: true,
          vision: true,
          audio: false,
          embeddings: false,
          reasoning: false,
          video: false,
          documents: true,
        },
        pricing: { inputTokens: 3.0, outputTokens: 15.0 },
        metadata: { originalProvider: "anthropic" },
      },
      {
        id: "google/gemini-2.0-flash-exp",
        provider: "openrouter",
        name: "Gemini 2.0 Flash (OpenRouter)",
        contextWindow: 1048576,
        capabilities: {
          streaming: true,
          functionCalling: true,
          vision: true,
          audio: true,
          embeddings: false,
          reasoning: false,
          video: true,
          documents: true,
        },
        pricing: { inputTokens: 0.075, outputTokens: 0.3 },
        metadata: { originalProvider: "google" },
      },
      {
        id: "mistralai/mistral-large",
        provider: "openrouter",
        name: "Mistral Large (OpenRouter)",
        contextWindow: 128000,
        capabilities: {
          streaming: true,
          functionCalling: true,
          vision: false,
          audio: false,
          embeddings: false,
          reasoning: false,
          video: false,
          documents: true,
        },
        pricing: { inputTokens: 3.0, outputTokens: 9.0 },
        metadata: { originalProvider: "mistralai" },
      },
    ];
  }

  /**
   * Handle OpenRouter API errors and convert to LLMError
   */
  private handleError(error: unknown, operation: string): never {
    if (error instanceof OpenAI.APIError) {
      throw new LLMError(
        `OpenRouter ${operation} failed: ${error.message}`,
        error,
        {
          provider: "openrouter",
          statusCode: error.status,
          type: error.name,
        }
      );
    }

    if (error instanceof Error) {
      throw new LLMError(
        `OpenRouter ${operation} failed: ${error.message}`,
        error
      );
    }

    throw new LLMError(`OpenRouter ${operation} failed with unknown error`);
  }
}
