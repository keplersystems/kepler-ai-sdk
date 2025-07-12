import Anthropic from "@anthropic-ai/sdk";
import type {
  ProviderAdapter,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
  ModelInfo,
  Message,
  ToolDefinition,
} from "../core/interfaces";
import { LLMError } from "../errors/LLMError";
import { litellmModelManager } from "../utils/litellm-models";
import { OAuthConfig } from "../core/oauth";
import { OAuth } from "../auth/oauth";

/**
 * Provider adapter for Anthropic's Claude API
 * Supports both API key and OAuth authentication
 */
export class AnthropicProvider implements ProviderAdapter {
  readonly name = "anthropic";

  /** Anthropic SDK client instance */
  private client: Anthropic;
  
  /** OAuth instance (if using OAuth) */
  private oauth?: OAuth;

  /** State for tracking partial tool calls during streaming */
  private streamingToolCalls: Map<number, {
    id: string;
    name: string;
    partialArguments: string;
  }> = new Map();

  /**
   * Create a new Anthropic provider instance
   * @param config - Configuration options for the Anthropic client
   */
  constructor(config: {
    /** API key for authentication */
    apiKey: string;
    /** Custom base URL (for proxies) */
    baseURL?: string;
  } | {
    /** OAuth configuration */
    oauth: OAuthConfig;
    /** Custom base URL (for proxies) */
    baseURL?: string;
  }) {
    // Initialize client
    this.client = new Anthropic({
      apiKey: 'apiKey' in config ? config.apiKey : 'placeholder', // OAuth will override this
      baseURL: config.baseURL,
    });
    
    // Set up OAuth if provided
    if ('oauth' in config) {
      this.oauth = new OAuth({ ...config.oauth, provider: 'anthropic' });
    }
  }

  /**
   * Generate a completion using Anthropic's messages API
   */
  async generateCompletion(
    request: CompletionRequest
  ): Promise<CompletionResponse> {
    try {
      const { system, messages } = this.extractSystemMessage(request.messages);
      const client = await this.getClient();

      const response = await client.messages.create({
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
      // Reset tool calls state for new stream
      this.streamingToolCalls.clear();
      
      const { system, messages } = this.extractSystemMessage(request.messages);
      const client = await this.getClient();

      const stream = await client.messages.create({
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
        `Failed to fetch Anthropic models from LiteLLM: ${error instanceof Error ? error.message : "Unknown error"
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
        `Failed to get Anthropic model '${modelId}' from LiteLLM: ${error instanceof Error ? error.message : "Unknown error"
        }`,
        error instanceof Error ? error : undefined,
        { provider: "anthropic" }
      );
    }
  }

  /**
   * OAuth helper methods (if using OAuth)
   */
  async initiateOAuth() {
    if (!this.oauth) {
      throw new LLMError('OAuth not configured for this provider');
    }
    return await this.oauth.initiateAuth();
  }

  async completeOAuth(code: string, codeVerifier?: string) {
    if (!this.oauth) {
      throw new LLMError('OAuth not configured for this provider');
    }
    await this.oauth.completeAuth(code, codeVerifier);
  }

  /**
   * Get OAuth authorization URL (uses centralized OAuth class)
   */
  async getOAuthUrl() {
    if (!this.oauth) {
      throw new LLMError('OAuth not configured for this provider');
    }
    return await this.oauth.initiateAuth();
  }

  /**
   * Get OAuth authorization URL with proper SHA256 hashing (async)
   * @deprecated Use getOAuthUrl() instead - both now use proper SHA256 hashing
   */
  async getOAuthUrlSecure() {
    return await this.getOAuthUrl();
  }


  /**
   * Get configured client with proper authentication
   */
  private async getClient(): Promise<Anthropic> {
    if (this.oauth) {
      // Use OAuth token with custom fetch (Claude Code spoofing approach)
      return new Anthropic({
        apiKey: undefined as any, // Explicitly undefined to prevent SDK from setting auth
        authToken: undefined as any, // Explicitly undefined
        baseURL: this.client.baseURL,
        defaultHeaders: {}, // Empty default headers
        fetch: async (input: any, init: any) => {
          const accessToken = await this.oauth!.getAccessToken();
          
          // Start with fresh headers to avoid conflicts
          const cleanHeaders: Record<string, string> = {
            "content-type": "application/json",
            "authorization": `Bearer ${accessToken}`,
            "anthropic-beta": "oauth-2025-04-20",
            "anthropic-version": "2023-06-01",
            "user-agent": "ai-sdk/anthropic",
          };
          
          // Add any other headers from init, but skip auth-related ones
          if (init.headers) {
            Object.entries(init.headers).forEach(([key, value]) => {
              const lowerKey = key.toLowerCase();
              if (!lowerKey.includes('auth') && !lowerKey.includes('api-key') && 
                  lowerKey !== 'x-api-key' && lowerKey !== 'authorization') {
                cleanHeaders[key] = value as string;
              }
            });
          }
          
          return fetch(input, {
            ...init,
            headers: cleanHeaders,
          });
        },
      });
    }
    
    // Use existing API key client
    return this.client;
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

    let systemText = systemMessages.length > 0
      ? systemMessages.map((m) => m.content as string).join("\n")
      : "";

    // Add Claude Code spoofing for OAuth authentication (following Fabric approach)
    if (this.oauth) {
      const claudeCodeMessage = "You are Claude Code, Anthropic's official CLI for Claude.";
      systemText = systemText 
        ? `${claudeCodeMessage}\n\n${systemText}`
        : claudeCodeMessage;
    }

    return { 
      system: systemText || undefined, 
      messages: nonSystemMessages 
    };
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
        // For assistant messages with tool calls, create content blocks
        if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
          const content: Anthropic.ContentBlockParam[] = [
            { type: "text", text: msg.content },
            ...msg.toolCalls.map(toolCall => ({
              type: "tool_use" as const,
              id: toolCall.id,
              name: toolCall.name,
              input: toolCall.arguments,
            }))
          ];
          
          return {
            role: "assistant",
            content,
          };
        }
        
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
    
    // Handle text content deltas
    if (chunk.type === "content_block_delta" && chunk.delta?.text) {
      return {
        id: "streaming",
        delta: chunk.delta.text,
        finished: false,
      };
    }

    // Handle tool use content block start
    if (chunk.type === "content_block_start" && chunk.content_block?.type === "tool_use") {
      const toolBlock = chunk.content_block;
      this.streamingToolCalls.set(chunk.index, {
        id: toolBlock.id,
        name: toolBlock.name,
        partialArguments: "",
      });
      
      return {
        id: "streaming",
        delta: "",
        finished: false,
      };
    }

    // Handle tool use argument deltas
    if (chunk.type === "content_block_delta" && chunk.delta?.type === "input_json_delta") {
      const toolCall = this.streamingToolCalls.get(chunk.index);
      if (toolCall) {
        toolCall.partialArguments += chunk.delta.partial_json;
      }
      
      return {
        id: "streaming",
        delta: "",
        finished: false,
      };
    }

    // Handle tool use content block stop
    if (chunk.type === "content_block_stop" && this.streamingToolCalls.has(chunk.index)) {
      const toolCall = this.streamingToolCalls.get(chunk.index)!;
      
      // Try to parse the accumulated arguments
      let parsedArguments: Record<string, unknown> = {};
      try {
        parsedArguments = JSON.parse(toolCall.partialArguments);
      } catch (error) {
        // If parsing fails, keep as empty object
        console.warn("Failed to parse tool arguments:", toolCall.partialArguments);
      }
      
      // Create the complete tool call
      const completedToolCall = {
        id: toolCall.id,
        name: toolCall.name,
        arguments: parsedArguments,
      };
      
      // Clean up the partial tool call
      this.streamingToolCalls.delete(chunk.index);
      
      return {
        id: "streaming",
        delta: "",
        finished: false,
        toolCalls: [completedToolCall],
      };
    }

    // Handle message stop
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

    // Default case for unhandled chunk types
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