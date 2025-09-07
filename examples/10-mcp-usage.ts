/**
 * --- 10. MCP (MODEL CONTEXT PROTOCOL) USAGE ---
 *
 * This example demonstrates how to use the Kepler AI SDK with MCP (Model Context Protocol)
 * integration. MCP allows you to connect to external servers that provide tools, resources,
 * and prompts that can be used by LLMs.
 *
 * This example covers:
 * 1. Setting up the Kepler class with MCP servers
 * 2. Automatic tool discovery from MCP servers
 * 3. Using MCP tools alongside user-defined tools
 * 4. Handling streaming responses with tool calls
 * 5. Managing multiple MCP servers
 * 6. Monitoring server status
 *
 * To run this example, you need:
 * 1. Your API key set as an environment variable:
 *    export ANTHROPIC_API_KEY="your-anthropic-api-key"
 *
 * 2. MCP servers installed and available. For this example, we'll use:
 *    - File system server: npm install -g @modelcontextprotocol/server-filesystem
 *    - Git server: npm install -g @modelcontextprotocol/server-git
 *
 * 3. You can control the response mode:
 *    export USE_STREAMING="true"  # Use streaming mode (default: false)
 *
 * Then run: bun run examples/10-mcp-usage.ts
 */

import {
  Kepler,
  KeplerConfig,
  MCPServerConfig,
  AnthropicProvider,
  ToolDefinition,
} from "../src/index";

// Example MCP server configurations
const mcpServers: MCPServerConfig[] = [
  {
    id: "filesystem",
    name: "File System Server",
    command: "npx",
    args: ["@modelcontextprotocol/server-filesystem", process.cwd()],
    env: {
      // You can add environment variables here
    },
  },
  {
    id: "exa-search",
    name: "Exa AI Search",
    command: "npx",
    args: [
      "-y",
      "mcp-remote",
      `https://mcp.exa.ai/mcp?exaApiKey=${process.env.EXA_API_KEY}`,
    ],
    env: {
      // You can add environment variables here
    },
  },
];

// Example user-defined tool
const getCurrentTime: ToolDefinition = {
  name: "get_current_time",
  description: "Get the current date and time",
  parameters: {
    type: "object",
    properties: {
      timezone: {
        type: "string",
        description: "Optional timezone (e.g., 'UTC', 'America/New_York')",
      },
    },
    required: [],
  },
};

async function getCurrentTimeHandler(
  args: Record<string, unknown>,
): Promise<string> {
  const timezone = (args.timezone as string) || "UTC";
  const now = new Date();

  try {
    return now.toLocaleString("en-US", {
      timeZone: timezone,
      dateStyle: "full",
      timeStyle: "long",
    });
  } catch (error) {
    return now.toISOString() + " (UTC)";
  }
}

async function demonstrateBasicMCPUsage() {
  console.log("🚀 Initializing Kepler with MCP servers...");

  const config: KeplerConfig = {
    providers: [
      {
        provider: new AnthropicProvider({
          apiKey: process.env.ANTHROPIC_API_KEY!,
        }),
      },
    ],
    mcpServers,
    autoDiscoverTools: true, // Automatically discover tools from MCP servers
  };

  const kepler = new Kepler(config);

  try {
    // Add a user-defined tool
    await kepler.addUserTool(getCurrentTime, getCurrentTimeHandler);

    // Check server status
    console.log("\n📊 MCP Server Status:");
    const serverStatus = kepler.getMCPServerStatus();
    for (const status of serverStatus) {
      console.log(
        `  - ${status.config.name}: ${status.connected ? "✅ Connected" : "❌ Disconnected"}`,
      );
      console.log(
        `    Tools: ${status.toolCount}, Resources: ${status.resourceCount}, Prompts: ${status.promptCount}`,
      );
    }

    // List all available tools
    console.log("\n🔧 Available Tools:");
    const allTools = await kepler.getAllTools();
    for (const tool of allTools) {
      console.log(`  - ${tool.name}: ${tool.description}`);
    }

    console.log(`\n📝 Total tools available: ${allTools.length}`);

    return kepler;
  } catch (error) {
    console.error("❌ Failed to initialize MCP servers:", error);
    console.log("💡 Make sure you have MCP servers installed:");
    console.log("   npm install -g @modelcontextprotocol/server-filesystem");
    console.log("   npm install -g @modelcontextprotocol/server-git");

    // Return a Kepler instance without MCP servers for basic functionality
    const basicConfig: KeplerConfig = {
      providers: [
        {
          provider: new AnthropicProvider({
            apiKey: process.env.ANTHROPIC_API_KEY!,
          }),
        },
      ],
    };

    const basicKepler = new Kepler(basicConfig);
    await basicKepler.addUserTool(getCurrentTime, getCurrentTimeHandler);
    return basicKepler;
  }
}

async function demonstrateToolUsage(kepler: Kepler) {
  console.log("\n🤖 Demonstrating tool usage...");

  const useStreaming = process.env.USE_STREAMING === "true";

  const request = {
    model: "claude-sonnet-4-20250514",
    messages: [
      {
        role: "user" as const,
        content:
          "Please tell me the current time and list the files in the current directory. Then search separately about latest AI, Politics and Entertainment news and provide a summary.",
      },
    ],
    temperature: 0.7,
    maxTokens: 1000,
  };

  if (useStreaming) {
    console.log("📡 Using streaming mode...");
    let fullResponse = "";

    for await (const chunk of kepler.streamCompletion(request)) {
      if (chunk.delta) {
        process.stdout.write(chunk.delta);
        fullResponse += chunk.delta;
      }

      if (chunk.toolCalls && chunk.toolCalls.length > 0) {
        console.log("\n🔧 Tool calls detected:");
        for (const toolCall of chunk.toolCalls) {
          console.log(
            `  - ${toolCall.name}: ${JSON.stringify(toolCall.arguments)}`,
          );
        }
      }

      if (chunk.finished) {
        console.log("\n✅ Streaming completed");
        if (chunk.usage) {
          console.log(`📊 Token usage: ${chunk.usage.totalTokens} tokens`);
        }
        break;
      }
    }
  } else {
    console.log("⚡ Using non-streaming mode...");
    const response = await kepler.generateCompletion(request);

    console.log("🤖 Assistant response:");
    console.log(response.content);

    if (response.toolCalls && response.toolCalls.length > 0) {
      console.log("\n🔧 Tool calls executed:");
      for (const toolCall of response.toolCalls) {
        console.log(
          `  - ${toolCall.name}: ${JSON.stringify(toolCall.arguments)}`,
        );
      }
    }

    console.log("\n✅ Generation completed");
    if (response.usage) {
      console.log(`📊 Token usage: ${response.usage.totalTokens} tokens`);
    }
  }
}

async function demonstrateServerManagement(kepler: Kepler) {
  console.log("\n🔧 Demonstrating server management...");

  // Try to add another server (this will fail gracefully if server doesn't exist)
  try {
    const newServerConfig: MCPServerConfig = {
      id: "memory",
      name: "Memory Server",
      command: "npx",
      args: ["@modelcontextprotocol/server-memory"],
    };

    await kepler.addMCPServer(newServerConfig);
    console.log("✅ Added memory server");

    // Refresh tools
    await kepler.refreshAllTools();
    console.log("🔄 Refreshed all tools");

    // Show updated status
    const updatedStatus = kepler.getMCPServerStatus();
    console.log("\n📊 Updated server status:");
    for (const status of updatedStatus) {
      console.log(
        `  - ${status.config.name}: ${status.connected ? "✅ Connected" : "❌ Disconnected"}`,
      );
    }

    // List all available tools
    console.log("\n🔧 Available Tools:");
    const allTools = await kepler.getAllTools();
    for (const tool of allTools) {
      console.log(`  - ${tool.name}: ${tool.description}`);
    }
  } catch (error) {
    console.log(
      "⚠️  Could not add memory server (this is expected if not installed)",
    );
  }
}

async function main() {
  console.log("--- 10. MCP (MODEL CONTEXT PROTOCOL) USAGE ---");

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY environment variable is not set.");
    return;
  }

  try {
    // 1. Initialize Kepler with MCP servers
    const kepler = await demonstrateBasicMCPUsage();

    // 2. Demonstrate tool usage
    await demonstrateToolUsage(kepler);

    // 3. Demonstrate server management
    await demonstrateServerManagement(kepler);

    // 4. Cleanup
    console.log("\n🧹 Cleaning up...");
    await kepler.cleanup();
    console.log("✅ Cleanup completed");
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n❌ An error occurred: ${error.message}`);
    } else {
      console.error("\n❌ An unknown error occurred:", error);
    }
  }
}

if (import.meta.main) {
  main();
}
