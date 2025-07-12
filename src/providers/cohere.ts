import { CohereClientV2 } from "cohere-ai";
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
 * Provider adapter for Cohere's API
 * Supports Command R models with tools, RAG, and embeddings
 */
export class CohereProvider implements ProviderAdapter {
  readonly name = "cohere";

  /** Cohere SDK client instance */
  private client: CohereClientV2;

  /**
   * Create a new Cohere provider instance
   * @param config - Configuration options for the Cohere client
   */
  constructor(config: {
    /** Cohere API key */
    apiKey: string;

    /** Custom base URL (for proxies) */
    baseURL?: string;
  }) {
    this.client = new CohereClientV2({
      token: config.apiKey,
      environment: config.baseURL,
    });
  }

  /**
   * Generate a completion using Cohere's chat API
   */
  async generateCompletion(
    request: CompletionRequest
  ): Promise<CompletionResponse> {
    try {
      const messages = this.convertMessages(request.messages);

      const cohereRequest: any = {
        model: request.model,
        messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: false,
        stop_sequences: Array.isArray(request.stop)
          ? request.stop
          : request.stop
            ? [request.stop]
            : undefined,
      };

      if (request.tools && request.tools.length > 0) {
        cohereRequest.tools = this.convertTools(request.tools);
      }

      const response = await this.client.chat(cohereRequest);

      return this.convertResponse(response);
    } catch (error) {
      throw this.handleError(error, "completion generation");
    }
  }

  /**
   * Generate a streaming completion using Cohere's streaming API
   */
  async *streamCompletion(
    request: CompletionRequest
  ): AsyncIterable<CompletionChunk> {
    try {
      const messages = this.convertMessages(request.messages);

      const cohereRequest: any = {
        model: request.model,
        messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: true,
        stop_sequences: Array.isArray(request.stop)
          ? request.stop
          : request.stop
            ? [request.stop]
            : undefined,
      };

      if (request.tools && request.tools.length > 0) {
        cohereRequest.tools = this.convertTools(request.tools);
      }

      const stream = await this.client.chatStream(cohereRequest);

      for await (const chunk of stream) {
        yield this.convertChunk(chunk);
      }
    } catch (error) {
      throw this.handleError(error, "streaming completion");
    }
  }

  /**
   * List all available Cohere models using LiteLLM data
   */
  async listModels(): Promise<ModelInfo[]> {
    try {
      return await litellmModelManager.getModelsByProvider("cohere");
    } catch (error) {
      throw new LLMError(
        `Failed to fetch Cohere models from LiteLLM: ${error instanceof Error ? error.message : "Unknown error"
        }`,
        error instanceof Error ? error : undefined,
        { provider: "cohere" }
      );
    }
  }

  /**
   * Get information about a specific Cohere model using LiteLLM data
   */
  async getModel(modelId: string): Promise<ModelInfo | null> {
    try {
      return await litellmModelManager.getModelInfo(modelId, "cohere");
    } catch (error) {
      throw new LLMError(
        `Failed to get Cohere model '${modelId}' from LiteLLM: ${error instanceof Error ? error.message : "Unknown error"
        }`,
        error instanceof Error ? error : undefined,
        { provider: "cohere" }
      );
    }
  }

  /**
   * Generate embeddings using Cohere's embedding models
   */
  async generateEmbedding(
    request: EmbeddingRequest
  ): Promise<EmbeddingResponse> {
    try {
      const response = await this.client.embed({
        model: request.model || "embed-english-v3.0",
        texts: Array.isArray(request.input) ? request.input : [request.input],
        inputType: "search_document",
        embeddingTypes: ["float"],
      });

      // Handle different response structures
      let embeddings: number[][] = [];
      if (Array.isArray(response.embeddings)) {
        embeddings = response.embeddings;
      } else if (
        response.embeddings &&
        typeof response.embeddings === "object" &&
        "float" in response.embeddings
      ) {
        // Handle case where embeddings is an object with float property
        embeddings = (response.embeddings as any).float || [];
      }

      return {
        embeddings,
        usage: {
          promptTokens: response.meta?.billedUnits?.inputTokens || 0,
          completionTokens: 0,
          totalTokens: response.meta?.billedUnits?.inputTokens || 0,
        },
        model: request.model,
      };
    } catch (error) {
      throw this.handleError(error, "embedding generation");
    }
  }

  /**
   * Convert unified messages to Cohere v2 format
   * Uses the standard messages array format
   */
  private convertMessages(messages: Message[]): any[] {
    if (messages.length === 0) {
      throw new LLMError("At least one message is required");
    }

    return messages.map((msg) => {
      if (msg.role === "system") {
        return {
          role: "system" as const,
          content: this.extractTextFromMessage(msg),
        };
      } else if (msg.role === "user") {
        return {
          role: "user" as const,
          content: this.extractTextFromMessage(msg),
        };
      } else if (msg.role === "assistant") {
        const assistantMsg: any = {
          role: "assistant" as const,
          content: this.extractTextFromMessage(msg),
        };

        // Add tool calls if present
        if ((msg as any).toolCalls) {
          assistantMsg.tool_calls = (msg as any).toolCalls.map((call: ToolCall) => ({
            id: call.id,
            type: "function",
            function: {
              name: call.name,
              arguments: JSON.stringify(call.arguments),
            },
          }));
        }

        return assistantMsg;
      } else if (msg.role === "tool") {
        return {
          role: "tool" as const,
          toolCallId: (msg as any).toolCallId || "unknown",
          content: this.extractTextFromMessage(msg),
        };
      }

      throw new LLMError(`Unsupported message role: ${msg.role}`);
    });
  }

  /**
   * Extract text content from a message
   */
  private extractTextFromMessage(message: Message): string {
    if (typeof message.content === "string") {
      return message.content;
    }

    if (Array.isArray(message.content)) {
      // Only extract text parts, Cohere doesn't support multimodal in chat
      const textParts = message.content.filter((part) => part.type === "text");
      if (textParts.length === 0) {
        throw new LLMError(
          "Cohere chat requires at least one text content part"
        );
      }
      return textParts.map((part) => part.text).join("\n");
    }

    return "";
  }

  /**
   * Convert unified tool definitions to Cohere v2 format
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
   * Convert Cohere response to unified format
   */
  private convertResponse(response: any): CompletionResponse {
    const text = response.message?.content || "";

    // Handle tool calls
    const toolCalls: ToolCall[] = [];
    if (response.message?.toolCalls && Array.isArray(response.message.toolCalls)) {
      for (const call of response.message.toolCalls) {
        toolCalls.push({
          id: call.id,
          name: call.function.name,
          arguments: JSON.parse(call.function.arguments || "{}"),
        });
      }
    }

    // Extract usage information
    const usage: TokenUsage = {
      promptTokens: response.usage?.billedUnits?.inputTokens || 0,
      completionTokens: response.usage?.billedUnits?.outputTokens || 0,
      totalTokens:
        (response.usage?.billedUnits?.inputTokens || 0) +
        (response.usage?.billedUnits?.outputTokens || 0),
    };

    return {
      id: response.id || `cohere_${Date.now()}`,
      content: text,
      model: "unknown", // V2 API doesn't seem to include model in response
      usage,
      finishReason: this.convertFinishReason(response.finishReason),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  /**
   * Convert Cohere streaming chunk to unified format
   */
  private convertChunk(chunk: any): CompletionChunk {
    // Handle CohereClientV2 streaming events
    if (chunk.type === "content-delta") {
      return {
        id: chunk.id || "streaming",
        delta: chunk.delta?.message?.content?.text || "",
        finished: false,
      };
    }

    if (chunk.type === "message-end") {
      const usage = chunk.delta?.usage?.billedUnits
        ? {
          promptTokens: chunk.delta.usage.billedUnits.inputTokens || 0,
          completionTokens: chunk.delta.usage.billedUnits.outputTokens || 0,
          totalTokens:
            (chunk.delta.usage.billedUnits.inputTokens || 0) +
            (chunk.delta.usage.billedUnits.outputTokens || 0),
        }
        : undefined;

      return {
        id: chunk.id || "streaming",
        delta: "",
        finished: true,
        usage,
      };
    }

    // Handle other event types (message-start, content-start, content-end, citations)
    if (chunk.type === "message-start" || chunk.type === "content-start" || 
        chunk.type === "content-end" || chunk.type === "citation-start" || 
        chunk.type === "citation-end") {
      return {
        id: chunk.id || "streaming",
        delta: "",
        finished: false,
      };
    }

    // Handle tool streaming events based on Cohere v2 API
    if (chunk.type === "tool-plan-delta") {
      // Tool planning phase - just pass through
      return {
        id: chunk.id || "streaming",
        delta: "",
        finished: false,
      };
    }

    if (chunk.type === "tool-call-start") {
      // Tool call start - contains id and function name
      const toolCallStart = chunk.delta?.message?.toolCalls;
      if (toolCallStart) {
        return {
          id: chunk.id || "streaming", 
          delta: "",
          finished: false,
          toolCallDeltas: [{
            index: chunk.index,
            id: toolCallStart.id,
            name: toolCallStart.function?.name,
            arguments: "", // Arguments start empty and accumulate in deltas
          }],
        };
      }
      
      return {
        id: chunk.id || "streaming", 
        delta: "",
        finished: false,
      };
    }

    if (chunk.type === "tool-call-delta") {
      // Tool call delta - contains partial arguments
      const argumentsDelta = chunk.delta?.message?.toolCalls?.function?.arguments || "";
      
      return {
        id: chunk.id || "streaming",
        delta: "",
        finished: false,
        toolCallDeltas: [{
          index: chunk.index,
          id: undefined, // Only in start event
          name: undefined, // Only in start event  
          arguments: argumentsDelta,
        }],
      };
    }

    if (chunk.type === "tool-call-end") {
      // End of tool calls
      return {
        id: chunk.id || "streaming",
        delta: "",
        finished: false,
      };
    }

    // Default chunk for other event types
    return {
      id: chunk.id || "streaming",
      delta: "",
      finished: false,
    };
  }

  /**
   * Convert Cohere finish reason to unified format
   */
  private convertFinishReason(
    reason: string | undefined
  ): CompletionResponse["finishReason"] {
    switch (reason) {
      case "COMPLETE":
        return "stop";
      case "MAX_TOKENS":
        return "length";
      case "ERROR":
        return "content_filter";
      case "ERROR_TOXIC":
        return "content_filter";
      case "USER_CANCEL":
        return "cancelled";
      default:
        return "stop";
    }
  }

  /**
   * Handle Cohere API errors and convert to LLMError
   */
  private handleError(error: unknown, operation: string): never {
    // Handle Cohere SDK specific errors
    if (error && typeof error === "object" && "status" in error) {
      const cohereError = error as any;
      throw new LLMError(
        `Cohere ${operation} failed: ${cohereError.message || "Unknown error"}`,
        error instanceof Error ? error : undefined,
        {
          provider: "cohere",
          statusCode: cohereError.status,
          type: cohereError.name || "CohereError",
        }
      );
    }

    if (error instanceof Error) {
      throw new LLMError(
        `Cohere ${operation} failed: ${error.message}`,
        error,
        {
          provider: "cohere",
        }
      );
    }

    throw new LLMError(
      `Cohere ${operation} failed with unknown error`,
      undefined,
      {
        provider: "cohere",
      }
    );
  }
}
