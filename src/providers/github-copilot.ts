import OpenAI from "openai";
import type {
  ProviderAdapter,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
  ModelInfo,
  Message,
  ToolDefinition,
  ToolCall,
  ResponseFormat,
} from "../core/interfaces";
import { LLMError } from "../errors/LLMError";
import { litellmModelManager } from "../utils/litellm-models";
import { OAuthConfig } from "../core/oauth";
import { OAuth } from "../auth/oauth";

/**
 * Provider adapter for GitHub Copilot's API
 * Uses OpenAI-compatible API with OAuth authentication
 */
export class GitHubCopilotProvider implements ProviderAdapter {
  readonly name = "github-copilot";

  /** OpenAI SDK client instance (GitHub Copilot uses OpenAI-compatible API) */
  private client: OpenAI;
  
  /** OAuth instance (required for GitHub Copilot) */
  private oauth: OAuth;

  /**
   * Create a new GitHub Copilot provider instance
   * @param config - Configuration options for the GitHub Copilot client
   */
  constructor(config: {
    /** OAuth configuration (required for GitHub Copilot) */
    oauth: OAuthConfig;
    /** Custom base URL */
    baseURL?: string;
  }) {
    // GitHub Copilot uses https://api.githubcopilot.com
    const baseURL = config.baseURL || "https://api.githubcopilot.com";
    
    // Initialize OAuth
    this.oauth = new OAuth({ ...config.oauth, provider: 'github-copilot' });
    
    // Initialize client with custom fetch for OAuth
    this.client = new OpenAI({
      apiKey: "", // Empty API key, we'll use custom fetch
      baseURL,
      fetch: async (input: any, init: any) => {
        const accessToken = await this.oauth.getAccessToken();
        
        // Check if this is an agent call based on message content
        let isAgentCall = false;
        try {
          const body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
          if (body?.messages) {
            isAgentCall = body.messages.some((msg: any) => msg.role && ["tool", "assistant"].includes(msg.role));
          }
        } catch {}
        
        const headers = {
          ...init.headers,
          authorization: `Bearer ${accessToken}`,
          "Openai-Intent": "conversation-edits",
          "X-Initiator": isAgentCall ? "agent" : "user",
          "user-agent": "GitHubCopilotChat/0.26.7",
          "Editor-Version": "vscode/1.99.3",
          "Editor-Plugin-Version": "copilot-chat/0.26.7",
          "Copilot-Integration-Id": "vscode-chat",
        };
        // Remove any existing auth headers
        delete headers["x-api-key"];
        delete headers["X-Api-Key"];
        
        return fetch(input, {
          ...init,
          headers,
        });
      },
    });
  }

  /**
   * Generate a completion using GitHub Copilot's chat API
   */
  async generateCompletion(
    request: CompletionRequest
  ): Promise<CompletionResponse> {
    try {
      const completionParams: any = {
        model: request.model,
        messages: this.convertMessages(request.messages),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: false,
        stop: Array.isArray(request.stop) ? request.stop : request.stop ? [request.stop] : undefined,
        response_format: request.responseFormat ? this.convertResponseFormat(request.responseFormat) : undefined,
      };
      
      // Only add tools and tool_choice if tools are provided
      if (request.tools) {
        completionParams.tools = this.convertTools(request.tools);
        completionParams.tool_choice = this.convertToolChoice(request.toolChoice);
      }
      
      const response = await this.client.chat.completions.create(completionParams);

      return this.convertResponse(response);
    } catch (error) {
      throw this.handleError(error, "completion generation");
    }
  }

  /**
   * Generate a streaming completion using GitHub Copilot's streaming API
   */
  async *streamCompletion(
    request: CompletionRequest
  ): AsyncIterable<CompletionChunk> {
    try {
      const completionParams: any = {
        model: request.model,
        messages: this.convertMessages(request.messages),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: true,
        stop: Array.isArray(request.stop) ? request.stop : request.stop ? [request.stop] : undefined,
      };
      
      // Only add tools and tool_choice if tools are provided
      if (request.tools) {
        completionParams.tools = this.convertTools(request.tools);
        completionParams.tool_choice = this.convertToolChoice(request.toolChoice);
      }
      
      const stream = await this.client.chat.completions.create(completionParams) as any;

      for await (const chunk of stream) {
        yield this.convertChunk(chunk);
      }
    } catch (error) {
      throw this.handleError(error, "streaming completion");
    }
  }

  /**
   * List all available GitHub Copilot models using LiteLLM data
   */
  async listModels(): Promise<ModelInfo[]> {
    try {
      return await litellmModelManager.getModelsByProvider("github-copilot");
    } catch (error) {
      throw new LLMError(
        `Failed to fetch GitHub Copilot models from LiteLLM: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error : undefined,
        { provider: "github-copilot" }
      );
    }
  }

  /**
   * Get information about a specific GitHub Copilot model using LiteLLM data
   */
  async getModel(modelId: string): Promise<ModelInfo | null> {
    try {
      return await litellmModelManager.getModelInfo(modelId, "github-copilot");
    } catch (error) {
      throw new LLMError(
        `Failed to get GitHub Copilot model '${modelId}' from LiteLLM: ${error instanceof Error ? error.message : "Unknown error"}`,
        error instanceof Error ? error : undefined,
        { provider: "github-copilot" }
      );
    }
  }

  /**
   * OAuth helper methods
   */
  async initiateOAuth() {
    return await this.oauth.initiateAuth();
  }

  async completeOAuth(code: string, codeVerifier?: string) {
    await this.oauth.completeAuth(code, codeVerifier);
  }

  /**
   * Convert unified messages to OpenAI format
   */
  private convertMessages(messages: Message[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map((msg): OpenAI.Chat.ChatCompletionMessageParam => {
      if (msg.role === "tool") {
        return {
          role: "tool",
          content: msg.content as string,
          tool_call_id: msg.toolCallId!,
        };
      }

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

      // Handle multimodal content for user messages only
      if (msg.role === "user") {
        const content: OpenAI.Chat.ChatCompletionContentPart[] = msg.content.map((part) => {
          switch (part.type) {
            case "text":
              return { type: "text", text: part.text! };
            case "image":
              return {
                type: "image_url",
                image_url: { url: part.imageUrl! },
              };
            case "image_url":
              // Pass through OpenAI-compatible format directly
              return {
                type: "image_url",
                image_url: (part as any).image_url,
              };
            case "document":
              throw new LLMError("Documents are not supported by GitHub Copilot");
            default:
              throw new LLMError(`GitHub Copilot does not support content type: ${part.type}`);
          }
        });

        return {
          role: "user",
          content,
        };
      } else {
        // For assistant messages, convert to string
        const textContent = msg.content
          .filter(part => part.type === "text")
          .map(part => part.text)
          .join("");
          
        return {
          role: "assistant",
          content: textContent,
        };
      }
    });
  }

  /**
   * Convert unified tool definitions to OpenAI format
   */
  private convertTools(tools: ToolDefinition[]): OpenAI.Chat.ChatCompletionTool[] {
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
  private convertToolChoice(choice?: CompletionRequest["toolChoice"]): OpenAI.Chat.ChatCompletionToolChoiceOption | undefined {
    if (!choice || choice === "auto") return "auto";
    if (choice === "none") return "none";
    if (choice === "required") return "required";
    if (typeof choice === "object") {
      return {
        type: "function",
        function: { name: choice.function.name },
      };
    }
    return undefined;
  }

  /**
   * Convert unified response format to OpenAI format
   */
  private convertResponseFormat(format: ResponseFormat): any {
    if (!format) return undefined;
    
    if (format.type === "json_object") {
      return { type: "json_object" };
    }
    
    if (format.type === "json_schema") {
      return {
        type: "json_schema",
        json_schema: {
          name: (format as any).schema?.title || "response",
          schema: (format as any).schema,
          strict: true,
        },
      };
    }
    
    return undefined;
  }

  /**
   * Convert OpenAI response to unified format
   */
  private convertResponse(response: OpenAI.Chat.ChatCompletion): CompletionResponse {
    const choice = response.choices[0];
    const message = choice.message;

    const toolCalls: ToolCall[] | undefined = message.tool_calls?.map((call) => ({
      id: call.id,
      name: call.function.name,
      arguments: JSON.parse(call.function.arguments),
    }));

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
      toolCalls,
    };
  }

  /**
   * Convert OpenAI streaming chunk to unified format
   */
  private convertChunk(chunk: OpenAI.Chat.ChatCompletionChunk): CompletionChunk {
    const choice = chunk.choices[0];
    const delta = choice?.delta;

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
    };
  }

  /**
   * Convert OpenAI finish reason to unified format
   */
  private convertFinishReason(reason: string | null): CompletionResponse["finishReason"] {
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
   * Handle GitHub Copilot API errors and convert to LLMError
   */
  private handleError(error: unknown, operation: string): never {
    if (error instanceof OpenAI.APIError) {
      throw new LLMError(
        `GitHub Copilot ${operation} failed: ${error.message}`,
        error,
        {
          provider: "github-copilot",
          statusCode: error.status,
          type: error.name,
        }
      );
    }

    if (error instanceof Error) {
      throw new LLMError(
        `GitHub Copilot ${operation} failed: ${error.message}`,
        error
      );
    }

    throw new LLMError(`GitHub Copilot ${operation} failed with unknown error`);
  }
}