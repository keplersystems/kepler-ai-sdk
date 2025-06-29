import { CohereClient } from "cohere-ai";
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
} from "../core/interfaces.js";
import { LLMError } from "../errors/LLMError.js";
import { litellmModelManager } from "../utils/litellm-models.js";

/**
 * Provider adapter for Cohere's API
 * Supports Command R models with tools, RAG, and embeddings
 */
export class CohereProvider implements ProviderAdapter {
  readonly name = "cohere";

  /** Cohere SDK client instance */
  private client: CohereClient;

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
    this.client = new CohereClient({
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
      const { message, chatHistory, preamble } = this.convertMessages(
        request.messages
      );

      const cohereRequest: any = {
        model: request.model,
        message,
        chatHistory: chatHistory.length > 0 ? chatHistory : undefined,
        preamble,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        stream: false,
        stopSequences: Array.isArray(request.stop)
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
      const { message, chatHistory, preamble } = this.convertMessages(
        request.messages
      );

      const cohereRequest: any = {
        model: request.model,
        message,
        chatHistory: chatHistory.length > 0 ? chatHistory : undefined,
        preamble,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        stream: true,
        stopSequences: Array.isArray(request.stop)
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
        `Failed to fetch Cohere models from LiteLLM: ${
          error instanceof Error ? error.message : "Unknown error"
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
        `Failed to get Cohere model '${modelId}' from LiteLLM: ${
          error instanceof Error ? error.message : "Unknown error"
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
   * Convert unified messages to Cohere format
   * Cohere expects the latest message separately from chat history
   */
  private convertMessages(messages: Message[]): {
    message: string;
    chatHistory: any[];
    preamble?: string;
  } {
    // Extract system message as preamble
    const systemMessages = messages.filter((m) => m.role === "system");
    const preamble =
      systemMessages.length > 0
        ? systemMessages.map((m) => m.content as string).join("\n")
        : undefined;

    // Filter out system messages and tool messages for chat history
    const conversationMessages = messages.filter((m) => m.role !== "system");

    if (conversationMessages.length === 0) {
      throw new LLMError("At least one non-system message is required");
    }

    // The last message should be from the user
    const lastMessage = conversationMessages[conversationMessages.length - 1];
    if (lastMessage.role !== "user") {
      throw new LLMError("Last message must be from user");
    }

    const message = this.extractTextFromMessage(lastMessage);

    // Convert previous messages to chat history
    const chatHistory = conversationMessages.slice(0, -1).map((msg) => {
      const text = this.extractTextFromMessage(msg);

      if (msg.role === "user") {
        return {
          role: "USER" as const,
          message: text,
        };
      } else if (msg.role === "assistant") {
        const response: any = {
          role: "CHATBOT" as const,
          message: text,
        };

        // Add tool calls if present
        if ((msg as any).toolCalls) {
          response.toolCalls = (msg as any).toolCalls.map((call: ToolCall) => ({
            name: call.name,
            parameters: call.arguments,
          }));
        }

        return response;
      } else if (msg.role === "tool") {
        return {
          role: "TOOL" as const,
          toolResults: [
            {
              call: {
                name: "tool_result",
                parameters: {},
              },
              outputs: [
                {
                  text: text,
                },
              ],
            },
          ],
        };
      }

      throw new LLMError(`Unsupported message role: ${msg.role}`);
    });

    return { message, chatHistory, preamble };
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
   * Convert unified tool definitions to Cohere format
   */
  private convertTools(tools: ToolDefinition[]): any[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameterDefinitions: this.convertParameterDefinitions(
        tool.parameters.properties
      ),
    }));
  }

  /**
   * Convert JSON Schema properties to Cohere parameter definitions
   */
  private convertParameterDefinitions(
    properties: Record<string, any>
  ): Record<string, any> {
    const definitions: Record<string, any> = {};

    for (const [name, prop] of Object.entries(properties)) {
      definitions[name] = {
        description: prop.description || "",
        type: this.mapJsonSchemaType(prop.type),
        required: prop.required || false,
      };
    }

    return definitions;
  }

  /**
   * Map JSON Schema types to Cohere types
   */
  private mapJsonSchemaType(jsonType: string): string {
    switch (jsonType) {
      case "string":
        return "str";
      case "number":
        return "float";
      case "integer":
        return "int";
      case "boolean":
        return "bool";
      case "array":
        return "list";
      case "object":
        return "dict";
      default:
        return "str";
    }
  }

  /**
   * Convert Cohere response to unified format
   */
  private convertResponse(response: any): CompletionResponse {
    const text = response.text || "";

    // Handle tool calls
    const toolCalls: ToolCall[] = [];
    if (response.toolCalls && Array.isArray(response.toolCalls)) {
      for (const [index, call] of response.toolCalls.entries()) {
        toolCalls.push({
          id: `call_${Date.now()}_${index}`,
          name: call.name,
          arguments: call.parameters || {},
        });
      }
    }

    // Extract usage information
    const usage: TokenUsage = {
      promptTokens: response.meta?.billedUnits?.inputTokens || 0,
      completionTokens: response.meta?.billedUnits?.outputTokens || 0,
      totalTokens:
        (response.meta?.billedUnits?.inputTokens || 0) +
        (response.meta?.billedUnits?.outputTokens || 0),
    };

    return {
      id: response.generationId || `cohere_${Date.now()}`,
      content: text,
      model: response.meta?.model || "unknown",
      usage,
      finishReason: this.convertFinishReason(response.finishReason),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  /**
   * Convert Cohere streaming chunk to unified format
   */
  private convertChunk(chunk: any): CompletionChunk {
    // Handle different chunk types
    if (chunk.eventType === "text-generation") {
      return {
        id: chunk.generationId || "streaming",
        delta: chunk.text || "",
        finished: false,
      };
    }

    if (chunk.eventType === "stream-end") {
      const usage = chunk.response?.meta?.billedUnits
        ? {
            promptTokens: chunk.response.meta.billedUnits.inputTokens || 0,
            completionTokens: chunk.response.meta.billedUnits.outputTokens || 0,
            totalTokens:
              (chunk.response.meta.billedUnits.inputTokens || 0) +
              (chunk.response.meta.billedUnits.outputTokens || 0),
          }
        : undefined;

      return {
        id: chunk.generationId || "streaming",
        delta: "",
        finished: true,
        usage,
      };
    }

    if (chunk.eventType === "tool-calls-generation") {
      return {
        id: chunk.generationId || "streaming",
        delta: "",
        finished: false,
        toolCalls: chunk.toolCalls?.map((call: any, index: number) => ({
          id: `call_${Date.now()}_${index}`,
          name: call.name,
          arguments: call.parameters || {},
        })),
      };
    }

    // Default chunk for other event types
    return {
      id: chunk.generationId || "streaming",
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
