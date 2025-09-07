import type { ToolDefinition, ToolCall, ToolResult } from "../core/interfaces";
import type { MCPServerConfig, MCPTool, MCPServerStatus } from "./interfaces";
import { MCPClient } from "./client";
import { LLMError } from "../errors/LLMError";

/**
 * Manages multiple MCP server connections and provides unified tool access
 */
export class MCPManager {
  private clients = new Map<string, MCPClient>();
  private toolCache = new Map<string, MCPTool[]>();
  private toolToServerMap = new Map<string, string>();
  private lastDiscovery: Date | null = null;

  /** Cache TTL for tool discovery */
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Add an MCP server to the manager
   */
  async addServer(config: MCPServerConfig): Promise<void> {
    if (this.clients.has(config.id)) {
      throw new LLMError(`MCP server with ID '${config.id}' already exists`);
    }

    const client = new MCPClient(config);

    try {
      await client.connect();
      this.clients.set(config.id, client);

      // Clear cache to force rediscovery
      this.toolCache.delete(config.id);
      this.lastDiscovery = null;

      console.debug(`Added MCP server: ${config.name} (${config.id})`);
    } catch (error) {
      throw new LLMError(
        `Failed to add MCP server ${config.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Remove an MCP server from the manager
   */
  async removeServer(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new LLMError(`MCP server with ID '${serverId}' not found`);
    }

    try {
      await client.disconnect();
      this.clients.delete(serverId);
      this.toolCache.delete(serverId);

      // Remove tools from server mapping
      for (const [toolName, serverIdInMap] of this.toolToServerMap.entries()) {
        if (serverIdInMap === serverId) {
          this.toolToServerMap.delete(toolName);
        }
      }
    } catch (error) {
      console.warn(`Error removing MCP server ${serverId}:`, error);
      // Still remove from our maps even if disconnect failed
      this.clients.delete(serverId);
      this.toolCache.delete(serverId);
    }
  }

  /**
   * Get status of all MCP servers
   */
  getServerStatus(): MCPServerStatus[] {
    return Array.from(this.clients.entries()).map(([serverId, client]) => {
      const config = client.getConfig();
      const context = client.getContext();

      return {
        config,
        connected: client.isConnected(),
        connectedAt: client.isConnected() ? new Date() : undefined,
        toolCount: context?.tools.length || 0,
        resourceCount: context?.resources.length || 0,
        promptCount: context?.prompts.length || 0,
      };
    });
  }

  /**
   * Discover all tools from all connected MCP servers
   */
  async discoverAllTools(): Promise<ToolDefinition[]> {
    const now = Date.now();

    // Return cached results if still valid
    if (
      this.lastDiscovery &&
      now - this.lastDiscovery.getTime() < this.CACHE_TTL
    ) {
      return this.getAllCachedTools();
    }

    const allTools: ToolDefinition[] = [];

    // Discover tools from each server
    for (const [serverId, client] of this.clients.entries()) {
      if (!client.isConnected()) {
        console.warn(
          `Skipping tool discovery from disconnected server: ${serverId}`,
        );
        continue;
      }

      try {
        const serverTools = await client.discoverTools();

        // Cache tools for this server
        this.toolCache.set(serverId, serverTools);

        // Update tool-to-server mapping
        for (const tool of serverTools) {
          this.toolToServerMap.set(tool.name, serverId);
          allTools.push(tool);
        }
      } catch (error) {
        console.error(
          `Failed to discover tools from server ${serverId}:`,
          error,
        );
        // Continue with other servers
      }
    }

    this.lastDiscovery = new Date();

    return allTools;
  }

  /**
   * Execute a tool call on the appropriate MCP server
   */
  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const serverId = this.findToolServer(toolCall.name);

    if (!serverId) {
      return {
        id: toolCall.id,
        content: "",
        error: `Tool '${toolCall.name}' not found in any MCP server`,
      };
    }

    const client = this.clients.get(serverId);
    if (!client || !client.isConnected()) {
      return {
        id: toolCall.id,
        content: "",
        error: `MCP server '${serverId}' is not connected`,
      };
    }

    try {
      const result = await client.executeTool(
        toolCall.name,
        toolCall.arguments,
      );

      return {
        id: toolCall.id,
        content: result,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `Tool execution failed for '${toolCall.name}' on server '${serverId}': ${errorMessage}`,
      );

      return {
        id: toolCall.id,
        content: "",
        error: errorMessage,
      };
    }
  }

  /**
   * Check if a tool is available from any MCP server
   */
  hasTool(toolName: string): boolean {
    return this.toolToServerMap.has(toolName);
  }

  /**
   * Get all connected server IDs
   */
  getServerIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Get tools from a specific server
   */
  getServerTools(serverId: string): MCPTool[] {
    return this.toolCache.get(serverId) || [];
  }

  /**
   * Refresh tool cache for all servers
   */
  async refreshAllTools(): Promise<void> {
    this.toolCache.clear();
    this.toolToServerMap.clear();
    this.lastDiscovery = null;

    await this.discoverAllTools();
  }

  /**
   * Disconnect from all MCP servers
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.entries()).map(
      async ([serverId, client]) => {
        try {
          await client.disconnect();
        } catch (error) {
          console.warn(`Error disconnecting from server ${serverId}:`, error);
        }
      },
    );

    await Promise.all(disconnectPromises);

    this.clients.clear();
    this.toolCache.clear();
    this.toolToServerMap.clear();
    this.lastDiscovery = null;
  }

  /**
   * Find which server provides a specific tool
   */
  private findToolServer(toolName: string): string | null {
    return this.toolToServerMap.get(toolName) || null;
  }

  /**
   * Get all cached tools across all servers
   */
  private getAllCachedTools(): ToolDefinition[] {
    const allTools: ToolDefinition[] = [];

    for (const serverTools of this.toolCache.values()) {
      allTools.push(...serverTools);
    }

    return allTools;
  }
}
