import Anthropic from "@anthropic-ai/sdk";
import type {
  ProviderAdapter,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
  ModelInfo,
  Message,
  ToolDefinition,
} from "../core/interfaces.js";
import { LLMError } from "../errors/LLMError.js";
import { litellmModelManager } from "../utils/litellm-models.js";

/**
 * Provider adapter for Anthropic's Claude API
 * Supports Claude models with advanced reasoning capabilities
 */
export class AnthropicProvider implements ProviderAdapter {
  readonly name = "anthropic";

  /** Anthropic SDK client instance */
  private client: Anthropic;

  /**
   * Create a new Anthropic provider instance
   * @param config - Configuration options for the Anthropic client
   */
  constructor(config: {
    /** Anthropic API key */
    apiKey: string;

    /** Custom base URL (for proxies) */
    baseURL?: string;
  }) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }

  /**
   * Generate a completion using Anthropic's messages API
   */
  async generateCompletion(
    request: CompletionRequest
  ): Promise<CompletionResponse> {
    try {
      const { system, messages } = this.extractSystemMessage(request.messages);

      const response = await this.client.messages.create({
        model: request.model,
        system,
        messages: this.convertMessages(messages),
        temperature: request.temperature,
        max_tokens: request.maxTokens || 1024, // Anthropic requires max_tokens
        tools: request.tools ? this.convertTools(request.tools) : undefined,
        tool_choice: this.convertToolChoice(request.toolChoice),
        stream: false,
        stop_sequences: Array.isArray(request.stop)
          ? request.stop
          : request.stop
          ? [request.stop]
          : undefined,
      });

      return this.convertResponse(response);
    } catch (error) {
      throw this.handleError(error, "completion generation");
    }
  }

  /**
   * Generate a streaming completion using Anthropic's streaming API
   */
  async *streamCompletion(
    request: CompletionRequest
  ): AsyncIterable<CompletionChunk> {
    try {
      const { system, messages } = this.extractSystemMessage(request.messages);

      const stream = await this.client.messages.create({
        model: request.model,
        system,
        messages: this.convertMessages(messages),
        temperature: request.temperature,
        max_tokens: request.maxTokens || 1024,
        tools: request.tools ? this.convertTools(request.tools) : undefined,
        tool_choice: this.convertToolChoice(request.toolChoice),
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
   * List all available Anthropic models using LiteLLM data
   */
  async listModels(): Promise<ModelInfo[]> {
    try {
      return await litellmModelManager.getModelsByProvider("anthropic");
    } catch (error) {
      throw new LLMError(
        `Failed to fetch Anthropic models from LiteLLM: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        error instanceof Error ? error : undefined,
        { provider: "anthropic" }
      );
    }
  }

  /**
   * Get information about a specific Anthropic model using LiteLLM data
   */
  async getModel(modelId: string): Promise<ModelInfo | null> {
    try {
      return await litellmModelManager.getModelInfo(modelId, "anthropic");
    } catch (error) {
      throw new LLMError(
        `Failed to get Anthropic model '${modelId}' from LiteLLM: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        error instanceof Error ? error : undefined,
        { provider: "anthropic" }
      );
    }
  }

  /**
   * Extract system message from messages array
   * Anthropic requires system messages to be separate from the conversation
   */
  private extractSystemMessage(messages: Message[]): {
    system?: string;
    messages: Message[];
  } {
    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    const system =
      systemMessages.length > 0
        ? systemMessages.map((m) => m.content as string).join("\n")
        : undefined;

    return { system, messages: nonSystemMessages };
  }

  /**
   * Convert unified messages to Anthropic format
   */
  private convertMessages(messages: Message[]): Anthropic.MessageParam[] {
    return messages.map((msg): Anthropic.MessageParam => {
      // Handle tool result messages
      if (msg.role === "tool") {
        return {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: msg.toolCallId!,
              content: msg.content as string,
            },
          ],
        };
      }

      // Handle simple text messages
      if (typeof msg.content === "string") {
        return {
          role: msg.role as "user" | "assistant",
          content: msg.content,
        };
      }

      // Handle multimodal content
      const content: Anthropic.ContentBlockParam[] = msg.content.map((part) => {
        switch (part.type) {
          case "text":
            return { type: "text", text: part.text! };
          case "image":
            return {
              type: "image",
              source: {
                type: "base64",
                media_type: (part.mimeType as any) || "image/jpeg",
                data: part.imageUrl!.replace(/^data:image\/[^;]+;base64,/, ""),
              },
            };
          case "document":
            throw new LLMError(
              "Documents are not supported in this format for Anthropic"
            );
          default:
            throw new LLMError(
              `Anthropic does not support content type: ${part.type}`
            );
        }
      });

      return {
        role: msg.role as "user" | "assistant",
        content,
      };
    });
  }

  /**
   * Convert unified tool definitions to Anthropic format
   */
  private convertTools(tools: ToolDefinition[]): Anthropic.Tool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
  }

  /**
   * Convert unified tool choice to Anthropic format
   */
  private convertToolChoice(choice?: CompletionRequest["toolChoice"]): any {
    if (!choice || choice === "auto") return undefined;
    if (choice === "none") return { type: "none" };
    if (choice === "required") return { type: "any" };
    if (typeof choice === "object") {
      return { type: "tool", name: choice.function.name };
    }
    return undefined;
  }

  /**
   * Convert Anthropic response to unified format
   */
  private convertResponse(response: Anthropic.Message): CompletionResponse {
    const textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    const toolCalls = response.content
      .filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      )
      .map((block) => ({
        id: block.id,
        name: block.name,
        arguments: block.input as Record<string, unknown>,
      }));

    return {
      id: response.id,
      content: textContent,
      model: response.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason: this.convertFinishReason(response.stop_reason),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  /**
   * Convert Anthropic streaming chunk to unified format
   */
  private convertChunk(chunk: any): CompletionChunk {
    // Handle different chunk types from Anthropic streaming
    if (chunk.type === "content_block_delta" && chunk.delta?.text) {
      return {
        id: "streaming",
        delta: chunk.delta.text,
        finished: false,
      };
    }

    if (chunk.type === "message_stop") {
      return {
        id: "streaming",
        delta: "",
        finished: true,
        usage: chunk.usage
          ? {
              promptTokens: chunk.usage.input_tokens,
              completionTokens: chunk.usage.output_tokens,
              totalTokens: chunk.usage.input_tokens + chunk.usage.output_tokens,
            }
          : undefined,
      };
    }

    return {
      id: "streaming",
      delta: "",
      finished: false,
    };
  }

  /**
   * Convert Anthropic finish reason to unified format
   */
  private convertFinishReason(
    reason: string | null
  ): CompletionResponse["finishReason"] {
    switch (reason) {
      case "end_turn":
        return "stop";
      case "max_tokens":
        return "length";
      case "tool_use":
        return "tool_calls";
      case "stop_sequence":
        return "stop";
      default:
        return "stop";
    }
  }

  /**
   * Convert Anthropic model info to unified format
   */

  /**
   * Handle Anthropic API errors and convert to LLMError
   */
  private handleError(error: unknown, operation: string): never {
    if (error instanceof Anthropic.APIError) {
      throw new LLMError(
        `Anthropic ${operation} failed: ${error.message}`,
        error,
        {
          provider: "anthropic",
          statusCode: error.status,
          type: error.name,
        }
      );
    }

    if (error instanceof Error) {
      throw new LLMError(
        `Anthropic ${operation} failed: ${error.message}`,
        error
      );
    }

    throw new LLMError(`Anthropic ${operation} failed with unknown error`);
  }
}
