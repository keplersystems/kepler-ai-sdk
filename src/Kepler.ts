import type {
  ProviderAdapter,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
  ToolDefinition,
  ToolCall,
  ToolResult,
  Message,
  ModelInfo,
  TokenUsage,
} from "./core/interfaces";
import { ModelManager } from "./models/ModelManager";
import { MCPManager } from "./mcp/MCPManager";
import type { MCPServerConfig, MCPServerStatus } from "./mcp/interfaces";
import { LLMError } from "./errors/LLMError";

/**
 * Configuration for the Kepler AI SDK
 */
export interface KeplerConfig {
  /** Array of LLM providers to add */
  providers: Array<{
    provider: ProviderAdapter;
    apiKey?: string;
  }>;

  /** Optional MCP server configurations */
  mcpServers?: MCPServerConfig[];

  /** Whether to automatically discover tools on startup */
  autoDiscoverTools?: boolean;
}

/**
 * User-defined tool handler function
 */
export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

/**
 * Main Kepler class that provides unified access to LLMs with MCP tool integration
 */
export class Kepler {
  private modelManager: ModelManager;
  private mcpManager: MCPManager;
  private userTools = new Map<
    string,
    { definition: ToolDefinition; handler: ToolHandler }
  >();
  private allTools = new Map<string, ToolDefinition>();
  private autoDiscoverTools: boolean;
  private toolsDiscovered: boolean = false;
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(config: KeplerConfig) {
    // Initialize managers
    this.modelManager = new ModelManager();
    this.mcpManager = new MCPManager();
    this.autoDiscoverTools = config.autoDiscoverTools !== false; // Default to true

    // Add all providers
    for (const { provider } of config.providers) {
      this.modelManager.addProvider(provider);
    }

    // Start initialization process
    this.initializationPromise = this.initialize(config);
  }

  /**
   * Initialize the Kepler instance with MCP servers
   */
  private async initialize(config: KeplerConfig): Promise<void> {
    try {
      // Initialize MCP servers if provided
      if (config.mcpServers && config.mcpServers.length > 0) {
        await this.initializeMCPServers(config.mcpServers);
      }

      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize Kepler:", error);
      throw error;
    }
  }

  /**
   * Ensure the instance is initialized before use
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    throw new LLMError("Kepler instance not properly initialized");
  }

  /**
   * Generate a completion with automatic tool discovery and execution
   */
  async generateCompletion(
    request: CompletionRequest,
  ): Promise<CompletionResponse> {
    // Ensure initialization is complete
    await this.ensureInitialized();

    // Ensure tools are discovered
    await this.ensureToolsDiscovered();

    // Merge tools into the request
    const requestWithTools = await this.mergeToolsIntoRequest(request);

    // Find the appropriate provider
    const provider = await this.getProviderForModel(requestWithTools.model);

    // Generate completion
    let response = await provider.generateCompletion(requestWithTools);

    // Process any tool calls in the response
    if (response.toolCalls && response.toolCalls.length > 0) {
      response = await this.processToolCallsAndContinueConversation(
        response,
        requestWithTools,
      );
    }

    return response;
  }

  /**
   * Stream a completion with automatic tool discovery and execution
   */
  async *streamCompletion(
    request: CompletionRequest,
  ): AsyncIterable<CompletionChunk> {
    // Ensure initialization is complete
    await this.ensureInitialized();

    // Ensure tools are discovered
    await this.ensureToolsDiscovered();

    // Merge tools into the request
    const requestWithTools = await this.mergeToolsIntoRequest(request);

    // Find the appropriate provider
    const provider = await this.getProviderForModel(requestWithTools.model);

    // Collect the response for tool processing
    let fullResponse: CompletionResponse | null = null;
    let toolCalls: ToolCall[] = [];

    // Stream the initial response
    for await (const chunk of provider.streamCompletion(requestWithTools)) {
      yield chunk;

      // Collect tool calls from chunks
      if (chunk.toolCalls) {
        // Filter out partial tool calls that don't have all required properties
        const validToolCalls = chunk.toolCalls.filter((tc): tc is ToolCall => {
          return (
            typeof tc.id === "string" &&
            typeof tc.name === "string" &&
            tc.arguments !== undefined
          );
        });
        toolCalls.push(...validToolCalls);
      }

      // Build full response when finished
      if (chunk.finished && chunk.usage) {
        fullResponse = {
          id: chunk.id,
          content: "", // Will be filled by processToolCallsInResponse
          model: requestWithTools.model,
          usage: chunk.usage,
          finishReason: "stop",
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        };
        break;
      }
    }

    // Process tool calls if any were found
    if (fullResponse && toolCalls.length > 0) {
      const processedResponse = await this.processToolCallsInResponse(
        fullResponse,
        requestWithTools,
      );

      // If there are new tool results, we need to continue the conversation
      if (
        processedResponse.content ||
        processedResponse.toolCalls?.length !== toolCalls.length
      ) {
        // Create a follow-up request with tool results
        const followUpMessages: Message[] = [
          ...requestWithTools.messages,
          {
            role: "assistant",
            content: processedResponse.content,
            toolCalls: toolCalls,
          },
        ];

        // Add tool result messages
        if (processedResponse.metadata?.toolResults) {
          for (const toolResult of processedResponse.metadata
            .toolResults as ToolResult[]) {
            followUpMessages.push({
              role: "tool",
              content: toolResult.content,
              toolCallId: toolResult.id,
            });
          }
        }

        const followUpRequest = {
          ...requestWithTools,
          messages: followUpMessages,
        };

        // Stream the follow-up response
        for await (const chunk of provider.streamCompletion(followUpRequest)) {
          yield chunk;
        }
      }
    }
  }

  /**
   * Add a user-defined tool with its handler function
   */
  async addUserTool(tool: ToolDefinition, handler: ToolHandler): Promise<void> {
    this.userTools.set(tool.name, { definition: tool, handler });
    await this.refreshAllTools();
  }

  /**
   * Remove a user-defined tool
   */
  async removeUserTool(toolName: string): Promise<void> {
    this.userTools.delete(toolName);
    await this.refreshAllTools();
  }

  /**
   * Get all available tools (MCP + user-defined)
   */
  async getAllTools(): Promise<ToolDefinition[]> {
    await this.ensureInitialized();
    await this.ensureToolsDiscovered();
    return Array.from(this.allTools.values());
  }

  /**
   * Add an MCP server
   */
  async addMCPServer(config: MCPServerConfig): Promise<void> {
    await this.mcpManager.addServer(config);
    if (this.autoDiscoverTools) {
      await this.refreshAllTools();
    }
  }

  /**
   * Remove an MCP server
   */
  async removeMCPServer(serverId: string): Promise<void> {
    await this.mcpManager.removeServer(serverId);
    if (this.autoDiscoverTools) {
      await this.refreshAllTools();
    }
  }

  /**
   * Get status of all MCP servers
   */
  getMCPServerStatus(): MCPServerStatus[] {
    return this.mcpManager.getServerStatus();
  }

  /**
   * Refresh all tools from all sources
   */
  async refreshAllTools(): Promise<void> {
    // Clear current tools
    this.allTools.clear();

    // Add user-defined tools
    for (const [name, { definition }] of this.userTools.entries()) {
      this.allTools.set(name, definition);
    }

    // Discover and add MCP tools
    try {
      const mcpTools = await this.mcpManager.discoverAllTools();
      for (const tool of mcpTools) {
        this.allTools.set(tool.name, tool);
      }
    } catch (error) {
      console.warn("Failed to discover MCP tools:", error);
    }
  }

  /**
   * Get the model manager (for advanced use cases)
   */
  getModelManager(): ModelManager {
    return this.modelManager;
  }

  /**
   * Get the MCP manager (for advanced use cases)
   */
  getMCPManager(): MCPManager {
    return this.mcpManager;
  }

  /**
   * List all available models
   */
  async listModels(
    provider?: string,
    forceRefresh = false,
  ): Promise<ModelInfo[]> {
    return this.modelManager.listModels(provider, forceRefresh);
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.mcpManager.disconnectAll();
  }

  /**
   * Initialize MCP servers during construction
   */
  private async initializeMCPServers(
    configs: MCPServerConfig[],
  ): Promise<void> {
    for (const config of configs) {
      try {
        await this.mcpManager.addServer(config);
      } catch (error) {
        const errorMsg = `Failed to initialize MCP server ${config.name}: ${error instanceof Error ? error.message : "Unknown error"}`;
        console.error(errorMsg);
      }
    }

    if (this.autoDiscoverTools) {
      await this.refreshAllTools();
    }
  }

  /**
   * Ensure tools are discovered if auto-discovery is enabled
   */
  private async ensureToolsDiscovered(): Promise<void> {
    if (this.autoDiscoverTools && !this.toolsDiscovered) {
      await this.refreshAllTools();
      this.toolsDiscovered = true;
    }
  }

  /**
   * Merge discovered tools into a completion request
   */
  private async mergeToolsIntoRequest(
    request: CompletionRequest,
  ): Promise<CompletionRequest> {
    const availableTools = Array.from(this.allTools.values());

    if (availableTools.length === 0) {
      return request;
    }

    // Merge tools with existing ones in the request
    const existingTools = request.tools || [];
    const allTools = [...existingTools, ...availableTools];

    // Remove duplicates by name
    const uniqueTools = allTools.filter(
      (tool, index, array) =>
        array.findIndex((t) => t.name === tool.name) === index,
    );

    return {
      ...request,
      tools: uniqueTools,
    };
  }

  /**
   * Process tool calls and continue the conversation with results
   */
  private async processToolCallsAndContinueConversation(
    response: CompletionResponse,
    originalRequest: CompletionRequest,
    accumulatedUsage?: TokenUsage,
  ): Promise<CompletionResponse> {
    // Execute all tool calls
    const toolResults: ToolResult[] = [];

    for (const toolCall of response.toolCalls!) {
      try {
        const result = await this.executeToolCall(toolCall);
        toolResults.push(result);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        toolResults.push({
          id: toolCall.id,
          content: "",
          error: errorMessage,
        });
      }
    }

    // Build conversation with tool results
    const conversationMessages: Message[] = [
      ...originalRequest.messages,
      {
        role: "assistant",
        content: response.content,
        toolCalls: response.toolCalls,
      },
    ];

    // Add tool result messages
    for (const toolResult of toolResults) {
      conversationMessages.push({
        role: "tool",
        content: toolResult.error || toolResult.content,
        toolCallId: toolResult.id,
      });
    }

    // Send updated conversation back to LLM for final response
    const followUpRequest: CompletionRequest = {
      ...originalRequest,
      messages: conversationMessages,
    };

    const provider = await this.getProviderForModel(originalRequest.model);
    let finalResponse = await provider.generateCompletion(followUpRequest);

    // Calculate accumulated usage
    const baseUsage = accumulatedUsage || response.usage;
    let combinedUsage: TokenUsage = {
      promptTokens: baseUsage.promptTokens + finalResponse.usage.promptTokens,
      completionTokens:
        baseUsage.completionTokens + finalResponse.usage.completionTokens,
      totalTokens: baseUsage.totalTokens + finalResponse.usage.totalTokens,
      cachedTokens:
        (baseUsage.cachedTokens || 0) + (finalResponse.usage.cachedTokens || 0),
      reasoningTokens:
        (baseUsage.reasoningTokens || 0) +
        (finalResponse.usage.reasoningTokens || 0),
    };

    // Recursively process any additional tool calls in the final response
    if (finalResponse.toolCalls && finalResponse.toolCalls.length > 0) {
      finalResponse = await this.processToolCallsAndContinueConversation(
        finalResponse,
        followUpRequest,
        combinedUsage,
      );
      combinedUsage = finalResponse.usage; // Use the final accumulated usage
    }

    return {
      ...finalResponse,
      usage: combinedUsage,
      metadata: {
        ...finalResponse.metadata,
        toolResults,
        originalToolCalls: response.toolCalls,
      },
    };
  }

  /**
   * Process tool calls in a completion response (legacy method)
   */
  private async processToolCallsInResponse(
    response: CompletionResponse,
    originalRequest: CompletionRequest,
  ): Promise<CompletionResponse> {
    if (!response.toolCalls || response.toolCalls.length === 0) {
      return response;
    }

    const toolResults: ToolResult[] = [];

    // Execute each tool call
    for (const toolCall of response.toolCalls) {
      try {
        const result = await this.executeToolCall(toolCall);
        toolResults.push(result);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        toolResults.push({
          id: toolCall.id,
          content: "",
          error: errorMessage,
        });
      }
    }

    // Store tool results in metadata for potential follow-up requests
    const responseWithMetadata = {
      ...response,
      metadata: {
        ...response.metadata,
        toolResults,
      },
    };

    return responseWithMetadata;
  }

  /**
   * Execute a single tool call
   */
  private async executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
    // Check if it's a user-defined tool
    const userTool = this.userTools.get(toolCall.name);
    if (userTool) {
      try {
        const result = await userTool.handler(toolCall.arguments);
        return {
          id: toolCall.id,
          content: result,
        };
      } catch (error) {
        return {
          id: toolCall.id,
          content: "",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    // Check if it's an MCP tool
    if (this.mcpManager.hasTool(toolCall.name)) {
      return await this.mcpManager.executeTool(toolCall);
    }

    // Tool not found
    return {
      id: toolCall.id,
      content: "",
      error: `Tool '${toolCall.name}' not found`,
    };
  }

  /**
   * Find the appropriate provider for a given model
   */
  private async getProviderForModel(modelId: string): Promise<ProviderAdapter> {
    const model = await this.modelManager.getModel(modelId);
    if (!model) {
      throw new LLMError(`Model '${modelId}' not found in any provider`);
    }

    const provider = this.modelManager.getProvider(model.provider);
    if (!provider) {
      throw new LLMError(`Provider '${model.provider}' not found`);
    }

    return provider;
  }
}
