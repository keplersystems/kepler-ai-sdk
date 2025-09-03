import { Mistral } from "@mistralai/mistralai";
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
  EmbeddingRequest,
  EmbeddingResponse,
} from "../core/interfaces";
import { LLMError } from "../errors/LLMError";
import { litellmModelManager } from "../utils/litellm-models";

/**
 * Provider adapter for Mistral AI's API
 * Supports Mistral models with advanced reasoning, code generation, and multimodal capabilities
 */
export class MistralProvider implements ProviderAdapter {
  readonly name = "mistral";

  /** Mistral AI SDK client instance */
  private client: Mistral;

  /**
   * Create a new Mistral provider instance
   * @param config - Configuration options for the Mistral client
   */
  constructor(config: {
    /** Mistral AI API key */
    apiKey: string;

    /** Custom base URL (for proxies) */
    baseURL?: string;
  }) {
    this.client = new Mistral({
      apiKey: config.apiKey,
      serverURL: config.baseURL,
    });
  }

  /**
   * Generate a completion using Mistral's chat completions API
   */
  async generateCompletion(
    request: CompletionRequest
  ): Promise<CompletionResponse> {
    try {
      const messages = this.convertMessages(request.messages);

      const requestBody: any = {
        model: request.model,
        messages,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        stream: false,
        stop: Array.isArray(request.stop)
          ? request.stop
          : request.stop
            ? [request.stop]
            : undefined,
      };

      // Add tools if provided
      if (request.tools && request.tools.length > 0) {
        requestBody.tools = this.convertTools(request.tools);
        requestBody.toolChoice = this.convertToolChoice(request.toolChoice);
        // Explicitly set parallel_tool_calls to false for simpler conversation flow
        requestBody.parallel_tool_calls = false;
      }

      // Add response format if specified
      if (request.responseFormat?.type === "json_object") {
        requestBody.responseFormat = { type: "json_object" };
      }

      const response = await this.client.chat.complete(requestBody);

      return this.convertResponse(response, request.model);
    } catch (error) {
      throw this.handleError(error, "completion generation");
    }
  }

  /**
   * Generate a streaming completion using Mistral's streaming API
   */
  async *streamCompletion(
    request: CompletionRequest
  ): AsyncIterable<CompletionChunk> {
    try {
      const messages = this.convertMessages(request.messages);

      const requestBody: any = {
        model: request.model,
        messages,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        stream: true,
        stop: Array.isArray(request.stop)
          ? request.stop
          : request.stop
            ? [request.stop]
            : undefined,
      };

      // Add tools if provided
      if (request.tools && request.tools.length > 0) {
        requestBody.tools = this.convertTools(request.tools);
        requestBody.toolChoice = this.convertToolChoice(request.toolChoice);
        // Explicitly set parallel_tool_calls to false for simpler conversation flow
        requestBody.parallel_tool_calls = false;
      }

      const stream = await this.client.chat.stream(requestBody);

      for await (const chunk of stream) {
        if (chunk.data) {
          const completionChunk = this.convertStreamChunk(chunk.data);
          if (completionChunk) {
            yield completionChunk;
          }
        }
      }
    } catch (error) {
      throw this.handleError(error, "streaming completion");
    }
  }

  /**
   * List all available Mistral models using LiteLLM data
   */
  async listModels(): Promise<ModelInfo[]> {
    try {
      return await litellmModelManager.getModelsByProvider("mistral");
    } catch (error) {
      throw this.handleError(error, "model listing");
    }
  }

  /**
   * Get information about a specific Mistral model using LiteLLM data
   */
  async getModel(modelId: string): Promise<ModelInfo | null> {
    try {
      return await litellmModelManager.getModelInfo(modelId, "mistral");
    } catch (error) {
      throw new LLMError(
        `Failed to get Mistral model '${modelId}' from LiteLLM: ${error instanceof Error ? error.message : "Unknown error"
        }`,
        error instanceof Error ? error : undefined,
        { provider: "mistral" }
      );
    }
  }

  /**
   * Generate embeddings using Mistral's embeddings API
   */
  async generateEmbedding(
    request: EmbeddingRequest
  ): Promise<EmbeddingResponse> {
    try {
      const inputs = Array.isArray(request.input)
        ? request.input
        : [request.input];

      const response = await this.client.embeddings.create({
        model: request.model,
        inputs,
      });

      return {
        embeddings: response.data?.map((item: any) => item.embedding) || [],
        usage: {
          promptTokens: response.usage?.promptTokens || 0,
          completionTokens: 0,
          totalTokens: response.usage?.totalTokens || 0,
        },
        model: request.model,
      };
    } catch (error) {
      throw this.handleError(error, "embedding generation");
    }
  }

  /**
   * Convert unified messages to Mistral format
   */
  private convertMessages(messages: Message[]): any[] {
    return messages.map((message, index) => {
      const converted: any = {
        role: message.role,
        content:
          typeof message.content === "string"
            ? message.content
            : this.convertContentParts(message.content),
      };

      // For assistant messages with tool calls, add toolCalls and set empty content
      if (message.role === "assistant" && message.toolCalls && message.toolCalls.length > 0) {
        converted.content = ""; // Mistral expects empty content when there are tool calls
        converted.toolCalls = message.toolCalls.map(toolCall => ({
          id: toolCall.id,
          type: "function",
          function: {
            name: toolCall.name,
            arguments: JSON.stringify(toolCall.arguments),
          },
        }));
      }

      // For tool messages, ensure we have the required name field
      if (message.role === "tool") {
        // Extract tool name from the tool call ID or find it from previous assistant message
        if (!message.name && (message as any).toolCallId) {
          // Find the corresponding tool call in previous messages to get the tool name
          for (let i = index - 1; i >= 0; i--) {
            const prevMessage = messages[i];
            if (prevMessage.role === "assistant" && prevMessage.toolCalls) {
              const matchingCall = prevMessage.toolCalls.find(
                call => call.id === (message as any).toolCallId
              );
              if (matchingCall) {
                converted.name = matchingCall.name;
                break;
              }
            }
          }
        } else if (message.name) {
          converted.name = message.name;
        }
        
        // Ensure toolCallId is set
        if ((message as any).toolCallId) {
          converted.toolCallId = (message as any).toolCallId;
        }
      }

      // Handle legacy name and toolCallId fields for other message types
      if (message.name && message.role !== "tool") {
        converted.name = message.name;
      }

      if (message.toolCallId && message.role !== "tool") {
        converted.toolCallId = message.toolCallId;
      }

      return converted;
    });
  }

  /**
   * Convert content parts for multimodal messages
   */
  private convertContentParts(parts: any[]): any[] {
    return parts.map((part) => {
      switch (part.type) {
        case "text":
          return {
            type: "text",
            text: part.text,
          };
        case "image":
          return {
            imageUrl: part.imageUrl,
            type: "image_url",
          };
        case "image_url":
          // Pass through OpenAI-compatible format, adapting to Mistral's structure
          return {
            imageUrl: (part as any).image_url.url,
            type: "image_url",
          };
        default:
          return {
            type: "text",
            text: JSON.stringify(part),
          };
      }
    });
  }

  /**
   * Convert unified tool definitions to Mistral format
   */
  private convertTools(tools: ToolDefinition[]): any[] {
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
   * Convert unified tool choice to Mistral format
   */
  private convertToolChoice(toolChoice?: CompletionRequest["toolChoice"]): any {
    if (!toolChoice || toolChoice === "auto") {
      return "auto";
    }
    if (toolChoice === "none") {
      return "none";
    }
    if (toolChoice === "required") {
      return "any";
    }
    if (typeof toolChoice === "object" && toolChoice.type === "function") {
      return {
        type: "function",
        function: {
          name: toolChoice.function.name,
        },
      };
    }
    return "auto";
  }

  /**
   * Convert Mistral response to unified format
   */
  private convertResponse(response: any, model: string): CompletionResponse {
    const choice = response.choices?.[0];
    const message = choice?.message;

    const toolCalls: ToolCall[] = [];
    if (message?.toolCalls) {
      for (const toolCall of message.toolCalls) {
        toolCalls.push({
          id: toolCall.id,
          name: toolCall.function.name,
          arguments:
            typeof toolCall.function.arguments === "string"
              ? JSON.parse(toolCall.function.arguments)
              : toolCall.function.arguments,
        });
      }
    }

    return {
      id: response.id || "unknown",
      content: message?.content || "",
      model,
      usage: this.convertUsage(response.usage),
      finishReason: this.convertFinishReason(choice?.finishReason),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  /**
   * Convert Mistral streaming chunk to unified format
   */
  private convertStreamChunk(chunk: any): CompletionChunk | null {
    const choice = chunk.choices?.[0];
    if (!choice) return null;

    const delta = choice.delta;
    let content = "";

    if (delta?.content) {
      content = delta.content;
    }

    const toolCalls: Partial<ToolCall>[] = [];
    if (delta?.toolCalls) {
      for (const toolCall of delta.toolCalls) {
        if (toolCall.function) {
          toolCalls.push({
            id: toolCall.id,
            name: toolCall.function.name,
            arguments: toolCall.function.arguments
              ? typeof toolCall.function.arguments === "string"
                ? JSON.parse(toolCall.function.arguments)
                : toolCall.function.arguments
              : undefined,
          });
        }
      }
    }

    return {
      id: chunk.id || "unknown",
      delta: content,
      finished: choice.finishReason !== null,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: chunk.usage ? this.convertUsage(chunk.usage) : undefined,
    };
  }

  /**
   * Convert Mistral usage to unified format
   */
  private convertUsage(usage: any): TokenUsage {
    return {
      promptTokens: usage?.promptTokens || 0,
      completionTokens: usage?.completionTokens || 0,
      totalTokens: usage?.totalTokens || 0,
    };
  }

  /**
   * Convert Mistral finish reason to unified format
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
   * Handle Mistral API errors and convert to LLMError
   */
  private handleError(error: unknown, operation: string): never {
    if (error && typeof error === "object" && "message" in error) {
      const errorObj = error as any;
      throw new LLMError(
        `Mistral ${operation} failed: ${errorObj.message}`,
        error as Error,
        {
          provider: "mistral",
          statusCode: errorObj.status || errorObj.statusCode,
          type: errorObj.name || "MISTRAL_ERROR",
        }
      );
    }

    if (error instanceof Error) {
      throw new LLMError(
        `Mistral ${operation} failed: ${error.message}`,
        error
      );
    }

    throw new LLMError(`Mistral ${operation} failed with unknown error`);
  }
}
