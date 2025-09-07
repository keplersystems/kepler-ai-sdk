# MCP Migration Guide: Upgrade to Kepler Class with Model Context Protocol Support

This guide explains how to migrate from the existing `ModelManager` to the new `Kepler` class that includes full MCP (Model Context Protocol) integration.

## What's New

### 🎯 **Key Benefits of MCP Integration**
- **External Tool Integration**: Connect to MCP servers for filesystem, databases, APIs, and more
- **Multi-Server Support**: Connect to multiple MCP servers simultaneously
- **Automatic Tool Discovery**: Tools from MCP servers are automatically available to LLMs
- **Seamless Tool Execution**: Recursive tool calling with proper conversation flow
- **Production Ready**: Proper error handling, token tracking, and performance optimization

### 📦 **What Was Added**
- **New Dependency**: `@modelcontextprotocol/sdk` (already included in package.json)
- **New Main Class**: `Kepler` - Enhanced replacement for `ModelManager`
- **MCP Module**: Complete MCP integration in `src/mcp/`
- **Comprehensive Example**: `examples/10-mcp-usage.ts` with working demonstration

## Migration Paths

### 🔄 **Option 1: Gradual Migration (Recommended)**

Keep using `ModelManager` for existing code, start using `Kepler` for new projects:

```typescript
// ✅ Existing code continues to work unchanged
import { ModelManager, AnthropicProvider } from 'kepler-ai-sdk';

const modelManager = new ModelManager();
modelManager.addProvider(new AnthropicProvider({ apiKey: 'your-key' }));
// ... rest of your existing code works as-is
```

```typescript
// ✅ New projects can use Kepler with MCP
import { Kepler, AnthropicProvider } from 'kepler-ai-sdk';

const kepler = new Kepler({
  providers: [
    { provider: new AnthropicProvider({ apiKey: 'your-key' }) }
  ],
  mcpServers: [
    {
      id: "filesystem",
      name: "File System",
      command: "npx",
      args: ["@modelcontextprotocol/server-filesystem", "/path/to/workspace"]
    }
  ]
});

const response = await kepler.generateCompletion({
  model: "claude-3-5-sonnet-20240620",
  messages: [{ role: "user", content: "List files and tell me the time" }]
});
// LLM automatically has access to filesystem tools + time tool
```

### 🚀 **Option 2: Full Migration**

Replace `ModelManager` with `Kepler` (without MCP servers):

```typescript
// Before: ModelManager
import { ModelManager, AnthropicProvider } from 'kepler-ai-sdk';

const modelManager = new ModelManager();
modelManager.addProvider(new AnthropicProvider({ apiKey: 'your-key' }));

const response = await modelManager.generateCompletion({
  model: "claude-3-5-sonnet-20240620",
  messages: [{ role: "user", content: "Hello" }]
});
```

```typescript
// After: Kepler (drop-in replacement)
import { Kepler, AnthropicProvider } from 'kepler-ai-sdk';

const kepler = new Kepler({
  providers: [
    { provider: new AnthropicProvider({ apiKey: 'your-key' }) }
  ]
  // No mcpServers = works exactly like ModelManager
});

const response = await kepler.generateCompletion({
  model: "claude-3-5-sonnet-20240620",
  messages: [{ role: "user", content: "Hello" }]
});
```

## MCP Implementation Guide

### 1. **Basic MCP Setup**

```typescript
import { Kepler, AnthropicProvider } from 'kepler-ai-sdk';
import type { MCPServerConfig } from 'kepler-ai-sdk';

const mcpServers: MCPServerConfig[] = [
  {
    id: "filesystem",
    name: "File System Server",
    command: "npx",
    args: ["@modelcontextprotocol/server-filesystem", process.cwd()]
  },
  {
    id: "git",
    name: "Git Server",
    command: "npx",
    args: ["@modelcontextprotocol/server-git", "--repository", process.cwd()]
  }
];

const kepler = new Kepler({
  providers: [
    { provider: new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY }) }
  ],
  mcpServers,
  autoDiscoverTools: true // Default: true
});
```

### 2. **Adding User-Defined Tools**

```typescript
import type { ToolDefinition, ToolHandler } from 'kepler-ai-sdk';

// Define your tool
const getCurrentTime: ToolDefinition = {
  name: "get_current_time",
  description: "Get the current date and time",
  parameters: {
    type: "object",
    properties: {
      timezone: {
        type: "string",
        description: "Timezone (e.g., 'UTC', 'America/New_York')"
      }
    },
    required: []
  }
};

// Define the handler function
const timeHandler: ToolHandler = async (args) => {
  const timezone = args.timezone as string || 'UTC';
  return new Date().toLocaleString('en-US', {
    timeZone: timezone,
    dateStyle: 'full',
    timeStyle: 'long'
  });
};

// Add to Kepler instance
await kepler.addUserTool(getCurrentTime, timeHandler);
```

### 3. **Tool Discovery and Management**

```typescript
// Get all available tools (MCP + user-defined)
const tools = await kepler.getAllTools();
console.log(`Total tools: ${tools.length}`);

// Check MCP server status
const serverStatus = kepler.getMCPServerStatus();
for (const status of serverStatus) {
  console.log(`${status.config.name}: ${status.connected ? 'Connected' : 'Disconnected'}`);
  console.log(`  Tools: ${status.toolCount}`);
}

// Add/remove MCP servers dynamically
await kepler.addMCPServer({
  id: "database",
  name: "Database Server",
  command: "./db-mcp-server"
});

await kepler.removeMCPServer("database");
```

### 4. **Streaming with Tools**

```typescript
for await (const chunk of kepler.streamCompletion(request)) {
  if (chunk.delta) {
    process.stdout.write(chunk.delta);
  }

  if (chunk.toolCalls?.length > 0) {
    console.log('Tools being executed:', chunk.toolCalls.map(tc => tc.name));
  }

  if (chunk.finished) {
    console.log('\nCompleted with token usage:', chunk.usage.totalTokens);
    break;
  }
}
```

## Popular MCP Servers

Install these MCP servers to get started:

```bash
# File system access
npm install -g @modelcontextprotocol/server-filesystem

# Git repository access
npm install -g @modelcontextprotocol/server-git

# Web browsing capabilities
npm install -g @modelcontextprotocol/server-brave-search

# Database access
npm install -g @modelcontextprotocol/server-sqlite

# Memory/knowledge management
npm install -g @modelcontextprotocol/server-memory
```

Then configure them:

```typescript
const mcpServers: MCPServerConfig[] = [
  {
    id: "filesystem",
    name: "File System",
    command: "npx",
    args: ["@modelcontextprotocol/server-filesystem", "/path/to/workspace"]
  },
  {
    id: "git",
    name: "Git",
    command: "npx",
    args: ["@modelcontextprotocol/server-git", "--repository", "/path/to/repo"]
  },
  {
    id: "web",
    name: "Web Search",
    command: "npx",
    args: ["@modelcontextprotocol/server-brave-search"],
    env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY }
  }
];
```

## Advanced Configuration

### Error Handling

```typescript
const kepler = new Kepler({
  providers: [{ provider: new AnthropicProvider({ apiKey: 'key' }) }],
  mcpServers: [
    {
      id: "filesystem",
      name: "File System",
      command: "npx",
      args: ["@modelcontextprotocol/server-filesystem", process.cwd()],
      env: { DEBUG: "false" }, // Custom environment variables
      cwd: "/custom/working/directory" // Custom working directory
    }
  ]
});

// Handle initialization
try {
  const response = await kepler.generateCompletion(request);
} catch (error) {
  console.error('MCP Integration Error:', error.message);
  // Kepler gracefully degrades - will work without failed servers
}
```

### Advanced Features

```typescript
// Access underlying managers for advanced use cases
const modelManager = kepler.getModelManager();
const mcpManager = kepler.getMCPManager();

// Manual tool refresh
await kepler.refreshAllTools();

// Clean shutdown
await kepler.cleanup();
```

## Breaking Changes

### ⚠️ **None!**
All existing `ModelManager` code continues to work unchanged. The new `Kepler` class is purely additive.

### 🔄 **Provider Interface Changes**
Minor provider fixes for image handling (internal changes, no API changes):
- Fixed `image` type to use consistent `image_url` format
- Better error messages for MCP-related failures

## Example Applications

### 1. **AI Code Assistant**
```typescript
const kepler = new Kepler({
  providers: [{ provider: new AnthropicProvider({ apiKey: 'key' }) }],
  mcpServers: [
    { id: "git", name: "Git", command: "npx", args: ["@modelcontextprotocol/server-git", "--repository", "."] },
    { id: "fs", name: "Files", command: "npx", args: ["@modelcontextprotocol/server-filesystem", "."]}
  ]
});

// LLM can now read/write files, check git status, make commits, etc.
```

### 2. **Data Analysis Assistant**
```typescript
const kepler = new Kepler({
  providers: [{ provider: new AnthropicProvider({ apiKey: 'key' }) }],
  mcpServers: [
    { id: "db", name: "Database", command: "npx", args: ["@modelcontextprotocol/server-sqlite", "data.db"] },
    { id: "fs", name: "Files", command: "npx", args: ["@modelcontextprotocol/server-filesystem", "."]}
  ]
});

// LLM can query databases, read CSV files, generate reports, etc.
```

### 3. **Research Assistant**
```typescript
const kepler = new Kepler({
  providers: [{ provider: new AnthropicProvider({ apiKey: 'key' }) }],
  mcpServers: [
    { id: "web", name: "Search", command: "npx", args: ["@modelcontextprotocol/server-brave-search"], env: { BRAVE_API_KEY: 'key' }},
    { id: "memory", name: "Memory", command: "npx", args: ["@modelcontextprotocol/server-memory"]}
  ]
});

// LLM can search web, remember information across conversations, etc.
```

## Migration Timeline

1. **Phase 1**: Install and test - Add `Kepler` to new projects
2. **Phase 2**: Gradual adoption - Replace `ModelManager` in new features
3. **Phase 3**: Full migration - Move existing code when convenient
4. **Phase 4**: MCP servers - Add external tool capabilities as needed

## Support

- **Backward Compatibility**: `ModelManager` continues to work indefinitely
- **Documentation**: Full examples in `examples/10-mcp-usage.ts`
- **MCP Ecosystem**: Browse servers at [modelcontextprotocol.io](https://modelcontextprotocol.io/)

The migration is designed to be **zero-risk** and **incremental**. Start with the new `Kepler` class for new projects while keeping existing code unchanged.
