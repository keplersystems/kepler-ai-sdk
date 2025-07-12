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
  EmbeddingRequest,
  EmbeddingResponse,
  ImageRequest,
  ImageResponse,
  AudioRequest,
  AudioResponse,
} from "../core/interfaces";
import { LLMError } from "../errors/LLMError";
import { litellmModelManager } from "../utils/litellm-models";

/**
 * Provider adapter for OpenAI's API
 * Supports GPT models, DALL-E, Whisper, and embeddings
 */
export class OpenAIProvider implements ProviderAdapter {
  readonly name = "openai";

  /** OpenAI SDK client instance */
  private client: OpenAI;

  /**
   * Create a new OpenAI provider instance
   * @param config - Configuration options for the OpenAI client
   */
  constructor(config: {
    /** OpenAI API key */
    apiKey: string;

    /** Custom base URL (for proxies or local instances) */
    baseURL?: string;

    /** OpenAI organization ID */
    organization?: string;
  }) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      organization: config.organization,
    });
  }

  /**
   * Generate a completion using OpenAI's chat completions API
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

      return this.convertResponse(response);
    } catch (error) {
      throw this.handleError(error, "completion generation");
    }
  }

  /**
   * Generate a streaming completion using OpenAI's streaming API
   */
  async *streamCompletion(
    request: CompletionRequest
  ): AsyncIterable<CompletionChunk> {
    try {
      const stream = await this.client.chat.completions.create({
        ...this.prepareRequest(request),
        stream: true,
      });

      for await (const chunk of stream) {
        yield this.convertChunk(chunk);
      }
    } catch (error) {
      throw this.handleError(error, "streaming completion");
    }
  }

  /**
   * List all available OpenAI models using LiteLLM data
   */
  async listModels(): Promise<ModelInfo[]> {
    try {
      return await litellmModelManager.getModelsByProvider("openai");
    } catch (error) {
      throw new LLMError(
        `Failed to fetch OpenAI models from LiteLLM: ${error instanceof Error ? error.message : "Unknown error"
        }`,
        error instanceof Error ? error : undefined,
        { provider: "openai" }
      );
    }
  }

  /**
   * Get information about a specific OpenAI model using LiteLLM data
   */
  async getModel(modelId: string): Promise<ModelInfo | null> {
    try {
      return await litellmModelManager.getModelInfo(modelId, "openai");
    } catch (error) {
      throw new LLMError(
        `Failed to get OpenAI model '${modelId}' from LiteLLM: ${error instanceof Error ? error.message : "Unknown error"
        }`,
        error instanceof Error ? error : undefined,
        { provider: "openai" }
      );
    }
  }

  /**
   * Generate images using DALL-E
   */
  async generateImage(request: ImageRequest): Promise<ImageResponse> {
    try {
      const response = await this.client.images.generate({
        model: request.model || "dall-e-3",
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
   * Generate audio using TTS models
   */
  async generateAudio(request: AudioRequest): Promise<AudioResponse> {
    try {
      const response = await this.client.audio.speech.create({
        model: request.model || "tts-1",
        voice: request.voice || "alloy",
        input: request.text,
        response_format: request.format || "mp3",
      });

      return {
        audio: await response.arrayBuffer(),
      };
    } catch (error) {
      throw this.handleError(error, "audio generation");
    }
  }

  /**
   * Generate embeddings using OpenAI's embedding models
   */
  async generateEmbedding(
    request: EmbeddingRequest
  ): Promise<EmbeddingResponse> {
    try {
      const response = await this.client.embeddings.create({
        model: request.model || "text-embedding-3-small",
        input: request.input,
        encoding_format: "float",
      });

      return {
        embeddings: response.data.map((item) => item.embedding),
        usage: {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: 0,
          totalTokens: response.usage.total_tokens,
        },
      };
    } catch (error) {
      throw this.handleError(error, "embedding generation");
    }
  }

  /**
   * Convert unified messages to OpenAI format
   * Handles multimodal content and tool messages
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
                `OpenAI does not support content type: ${part.type}`
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
   * Convert OpenAI response to unified format
   */
  private convertResponse(
    response: OpenAI.Chat.ChatCompletion
  ): CompletionResponse {
    const choice = response.choices[0];
    const message = choice.message;

    return {
      id: response.id,
      content: message.content || "",
      model: response.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
      finishReason: this.convertFinishReason(choice.finish_reason),
      toolCalls: message.tool_calls?.map((call) => ({
        id: call.id,
        name: call.function.name,
        arguments: JSON.parse(call.function.arguments),
      })),
    };
  }

  /**
   * Convert OpenAI streaming chunk to unified format
   */
  private convertChunk(
    chunk: OpenAI.Chat.Completions.ChatCompletionChunk
  ): CompletionChunk {
    const choice = chunk.choices[0];
    const delta = choice?.delta;

    // Convert OpenAI tool call deltas to our format
    const toolCallDeltas = delta?.tool_calls?.map((toolCall) => ({
      index: toolCall.index,
      id: toolCall.id || undefined,
      name: toolCall.function?.name || undefined,
      arguments: toolCall.function?.arguments || "",
    }));

    return {
      id: chunk.id,
      delta: delta?.content || "",
      finished: choice?.finish_reason !== null,
      usage: chunk.usage
        ? {
          promptTokens: chunk.usage.prompt_tokens || 0,
          completionTokens: chunk.usage.completion_tokens || 0,
          totalTokens: chunk.usage.total_tokens || 0,
        }
        : undefined,
      toolCallDeltas: toolCallDeltas,
    };
  }

  /**
   * Convert OpenAI finish reason to unified format
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
   * Convert OpenAI model to unified format
   */

  /**
   * Handle OpenAI API errors and convert to LLMError
   */
  private handleError(error: unknown, operation: string): never {
    if (error instanceof OpenAI.APIError) {
      throw new LLMError(
        `OpenAI ${operation} failed: ${error.message}`,
        error,
        {
          provider: "openai",
          statusCode: error.status,
          type: error.name,
        }
      );
    }

    if (error instanceof Error) {
      throw new LLMError(`OpenAI ${operation} failed: ${error.message}`, error);
    }

    throw new LLMError(`OpenAI ${operation} failed with unknown error`);
  }

  /**
   * Prepare request for streaming (helper method)
   */
  private prepareRequest(
    request: CompletionRequest
  ): Omit<OpenAI.Chat.ChatCompletionCreateParams, "stream"> {
    const openAIRequest: Omit<
      OpenAI.Chat.ChatCompletionCreateParams,
      "stream"
    > = {
      model: request.model,
      messages: this.convertMessages(request.messages),
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stop: request.stop,
    };

    if (request.tools) {
      openAIRequest.tools = this.convertTools(request.tools);
      openAIRequest.tool_choice = this.convertToolChoice(request.toolChoice);
    }

    return openAIRequest;
  }
}
