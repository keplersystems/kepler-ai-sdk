import type { ToolDefinition } from "../core/interfaces";

/**
 * Configuration for connecting to an MCP server
 */
export interface MCPServerConfig {
  /** Unique identifier for this server */
  id: string;

  /** Human-readable name for this server */
  name: string;

  /** Command to execute the MCP server */
  command: string;

  /** Optional arguments to pass to the server command */
  args?: string[];

  /** Optional environment variables for the server process */
  env?: Record<string, string>;

  /** Optional working directory for the server process */
  cwd?: string;
}

/**
 * Complete context available from an MCP server
 */
export interface MCPContext {
  /** Available tools from the server */
  tools: ToolDefinition[];

  /** Available resources from the server */
  resources: MCPResource[];

  /** Available prompts from the server */
  prompts: MCPPrompt[];
}

/**
 * A resource exposed by an MCP server
 */
export interface MCPResource {
  /** Unique resource URI */
  uri: string;

  /** Human-readable name */
  name: string;

  /** Optional description */
  description?: string;

  /** MIME type of the resource */
  mimeType?: string;
}

/**
 * A prompt template exposed by an MCP server
 */
export interface MCPPrompt {
  /** Unique prompt name */
  name: string;

  /** Optional description */
  description?: string;

  /** Arguments the prompt accepts */
  arguments?: MCPPromptArgument[];
}

/**
 * Argument definition for MCP prompts
 */
export interface MCPPromptArgument {
  /** Argument name */
  name: string;

  /** Optional description */
  description?: string;

  /** Whether this argument is required */
  required?: boolean;
}

/**
 * Extended tool definition that includes MCP server tracking
 */
export interface MCPTool extends ToolDefinition {
  /** ID of the server that provides this tool */
  serverId: string;

  /** Original MCP tool identifier */
  mcpToolId: string;
}

/**
 * Connection status for an MCP server
 */
export interface MCPServerStatus {
  /** Server configuration */
  config: MCPServerConfig;

  /** Whether the server is connected */
  connected: boolean;

  /** Connection timestamp */
  connectedAt?: Date;

  /** Number of available tools */
  toolCount: number;

  /** Number of available resources */
  resourceCount: number;

  /** Number of available prompts */
  promptCount: number;

  /** Last error (if any) */
  lastError?: string;
}
