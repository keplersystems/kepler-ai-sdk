import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type {
  ListToolsResult,
  ListResourcesResult,
  ListPromptsResult,
  CallToolResult,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import type { ToolDefinition, JSONSchemaProperty } from "../core/interfaces";
import type { MCPServerConfig, MCPContext, MCPTool } from "./interfaces";
import { LLMError } from "../errors/LLMError";

/**
 * Client for connecting to and interacting with a single MCP server
 */
export class MCPClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private connected: boolean = false;
  private context: MCPContext | null = null;

  constructor(private config: MCPServerConfig) {
    // Initialize MCP client with basic capabilities
    this.client = new Client(
      {
        name: "kepler-ai-sdk",
        version: "1.0.6",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      },
    );
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      // Create stdio transport
      this.transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args || [],
        env: this.config.env,
      });

      // Connect (automatically initializes)
      await this.client.connect(this.transport);

      this.connected = true;

      // Discover initial context
      await this.refreshContext();
    } catch (error) {
      this.connected = false;
      this.transport = null;
      throw new LLMError(
        `Failed to connect to MCP server ${this.config.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.connected || !this.client) {
      return;
    }

    try {
      await this.client.close();
    } catch (error) {
      console.warn(
        `Error disconnecting from MCP server ${this.config.name}:`,
        error,
      );
    } finally {
      this.connected = false;
      this.transport = null;
      this.context = null;
    }
  }

  /**
   * Check if the client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get the server configuration
   */
  getConfig(): MCPServerConfig {
    return { ...this.config };
  }

  /**
   * Refresh the context (tools, resources, prompts) from the server
   */
  async refreshContext(): Promise<MCPContext> {
    if (!this.connected) {
      throw new LLMError("Cannot refresh context: not connected to server");
    }

    try {
      // Discover all capabilities in parallel
      const [toolsResult, resourcesResult, promptsResult] = await Promise.all([
        this.client.listTools().catch((): ListToolsResult => ({ tools: [] })),
        this.client
          .listResources()
          .catch((): ListResourcesResult => ({ resources: [] })),
        this.client
          .listPrompts()
          .catch((): ListPromptsResult => ({ prompts: [] })),
      ]);

      // Convert MCP tools to Kepler format
      const tools = toolsResult.tools.map((mcpTool: Tool) =>
        this.convertMCPToolToKepler(mcpTool),
      );

      this.context = {
        tools,
        resources: resourcesResult.resources || [],
        prompts: promptsResult.prompts || [],
      };

      return this.context;
    } catch (error) {
      throw new LLMError(
        `Failed to refresh context from MCP server ${this.config.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get the current context
   */
  getContext(): MCPContext | null {
    return this.context;
  }

  /**
   * Discover all available tools from the server
   */
  async discoverTools(): Promise<MCPTool[]> {
    if (!this.context) {
      await this.refreshContext();
    }

    return this.context!.tools.map((tool) => ({
      ...tool,
      serverId: this.config.id,
      mcpToolId: tool.name,
    }));
  }

  /**
   * Execute a tool on the MCP server
   */
  async executeTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    if (!this.connected) {
      throw new LLMError("Cannot execute tool: not connected to server");
    }

    try {
      const result = await this.client.callTool({ name, arguments: args });

      // Check if it's an error result
      if ("isError" in result && result.isError) {
        const content = "content" in result ? result.content : undefined;
        const errorMessage =
          Array.isArray(content) &&
          content[0]?.type === "text" &&
          "text" in content[0]
            ? content[0].text
            : "Unknown error";
        throw new LLMError(`Tool execution failed: ${errorMessage}`);
      }

      // Get content from the result
      const content = "content" in result ? result.content : [];
      if (!Array.isArray(content)) {
        return "";
      }

      // Return the text content from the tool result
      return content
        .filter(
          (item) =>
            item &&
            typeof item === "object" &&
            "type" in item &&
            item.type === "text" &&
            "text" in item,
        )
        .map((item) => (item as { text: string }).text)
        .join("\n");
    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }
      throw new LLMError(
        `Failed to execute tool ${name} on server ${this.config.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Convert MCP tool definition to Kepler ToolDefinition format
   */
  private convertMCPToolToKepler(mcpTool: Tool): ToolDefinition {
    return {
      name: mcpTool.name,
      description:
        mcpTool.description || `Tool from MCP server: ${this.config.name}`,
      parameters: {
        type: "object" as const,
        properties: this.convertJSONSchemaProperties(
          mcpTool.inputSchema?.properties || {},
        ),
        required: mcpTool.inputSchema?.required || [],
      },
    };
  }

  /**
   * Convert JSON Schema properties to Kepler format
   */
  private convertJSONSchemaProperties(
    properties: Record<string, any>,
  ): Record<string, JSONSchemaProperty> {
    const converted: Record<string, JSONSchemaProperty> = {};

    for (const [key, value] of Object.entries(properties)) {
      converted[key] = this.convertJSONSchemaProperty(value);
    }

    return converted;
  }

  /**
   * Convert a single JSON Schema property to Kepler format
   */
  private convertJSONSchemaProperty(property: any): JSONSchemaProperty {
    const converted: JSONSchemaProperty = {
      type: property.type || "string",
      description: property.description,
    };

    if (property.enum) {
      converted.enum = property.enum;
    }

    if (property.items) {
      converted.items = this.convertJSONSchemaProperty(property.items);
    }

    if (property.properties) {
      converted.properties = this.convertJSONSchemaProperties(
        property.properties,
      );
      if (property.required) {
        converted.required = property.required;
      }
    }

    return converted;
  }
}
