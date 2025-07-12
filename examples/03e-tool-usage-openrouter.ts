/**
 * --- 03E. TOOL USAGE - OPENROUTER ---
 *
 * This example demonstrates how to use tools with OpenRouter models.
 * OpenRouter provides access to multiple AI models through a single API.
 * Tools allow you to extend the capabilities of the model by letting it
 * call external functions.
 *
 * It covers:
 * 1.  Defining a tool with a name, description, and parameters.
 * 2.  Sending a completion request with the defined tool to OpenRouter model.
 * 3.  Handling the model's response, which may include a tool call.
 * 4.  Completing the tool call workflow by executing the tool and sending results back
 *
 * To run this example, you need to have your API keys set as environment variables:
 *
 * export OPENROUTER_API_KEY="your-openrouter-api-key"
 * export EXA_API_KEY="your-exa-api-key"
 *
 * Get your OpenRouter API key from: https://openrouter.ai/keys
 * Get your Exa API key from: https://exa.ai/
 *
 * You can also control the response mode:
 * export USE_STREAMING="false"  # Use non-streaming mode (default: streaming)
 *
 * Then, you can run this file using bun:
 *
 * bun run examples/03e-tool-usage-openrouter.ts
 */

import { ModelManager, OpenRouterProvider, ToolDefinition, ToolCall, Message } from "../src/index";
import Exa from "exa-js";

// Real implementation of the exa_search tool
async function executeExaSearch(query: string): Promise<string> {
    if (!process.env.EXA_API_KEY) {
        throw new Error("EXA_API_KEY environment variable is not set");
    }
    
    const exa = new Exa(process.env.EXA_API_KEY);
    
    try {
        const result = await exa.search(query, {
            numResults: 3,
            includeDomains: ["timeanddate.com", "worldclock.com", "timezone.com"],
            type: "neural"
        });
        
        if (result.results.length === 0) {
            return `No search results found for "${query}".`;
        }
        
        // Format the search results
        let formattedResults = `Search results for "${query}":\n\n`;
        for (const searchResult of result.results) {
            formattedResults += `Title: ${searchResult.title}\n`;
            formattedResults += `URL: ${searchResult.url}\n`;
            if (searchResult.text) {
                formattedResults += `Content: ${searchResult.text.substring(0, 300)}...\n`;
            }
            formattedResults += `\n`;
        }
        
        return formattedResults;
    } catch (error) {
        return `Error searching with Exa: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

async function main() {
    console.log("--- 03E. TOOL USAGE - OPENROUTER ---");

    if (!process.env.OPENROUTER_API_KEY) {
        console.error("❌ OPENROUTER_API_KEY environment variable is not set.");
        console.error("Get your API key from: https://openrouter.ai/keys");
        return;
    }

    if (!process.env.EXA_API_KEY) {
        console.error("❌ EXA_API_KEY environment variable is not set.");
        console.error("Get your free API key from: https://exa.ai/");
        return;
    }

    const modelManager = new ModelManager();
    const openrouter = new OpenRouterProvider({
        apiKey: process.env.OPENROUTER_API_KEY,
        appName: "Kepler AI SDK Tool Usage Example",
        appUrl: "https://github.com/keplerlab/kepler-ai-sdk",
    });
    modelManager.addProvider(openrouter);

    // 1. Define the tool
    // The tool definition tells the model what function is available,
    // what it does, and what parameters it accepts.
    const exaSearchTool: ToolDefinition = {
        name: "exa_search",
        description: "Get the search results for a given query.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "The search query, e.g., 'current date in India'",
                },
            },
            required: ["query"],
        },
    };

    try {
        // 2. Send the initial request
        // We include the tool definition in the `tools` array.
        // Using Claude 3.5 Sonnet via OpenRouter since we know it supports tools well
        console.log("\n🤖 Asking the model to use the search tool...");
        const initialRequest = {
            model: "anthropic/claude-3.5-sonnet",
            messages: [
                {
                    role: "user" as const,
                    content: "Use the exa_search tool to find the current date in India",
                },
            ],
            tools: [exaSearchTool],
            toolChoice: "auto" as const,
        };

        // 3. Get the initial completion (non-streaming to handle tool calls properly)
        const initialResponse = await openrouter.generateCompletion(initialRequest);
        
        // Display the assistant's response
        process.stdout.write(initialResponse.content);
        
        if (initialResponse.toolCalls && initialResponse.toolCalls.length > 0) {
            console.log("\n🔧 Tool calls detected:");
            for (const toolCall of initialResponse.toolCalls) {
                console.log(`  - ${toolCall.name}: ${JSON.stringify(toolCall.arguments)}`);
            }
            console.log("---");
            if (initialResponse.usage) {
                console.log(`📊 Token usage: ${initialResponse.usage.totalTokens} tokens`);
            }
        } else {
            console.log("\n---\n✅ No tool calls detected - conversation finished.");
            if (initialResponse.usage) {
                console.log(`📊 Token usage: ${initialResponse.usage.totalTokens} tokens`);
            }
            return;
        }

        // 4. Execute the tool calls and send results back
        console.log("\n🔧 Executing tool calls...");
        
        // Build messages array with tool results
        const messagesWithToolResults: Message[] = [
            {
                role: "user",
                content: "Use the exa_search tool to find the current date in India",
            },
            {
                role: "assistant",
                content: initialResponse.content,
                toolCalls: initialResponse.toolCalls,
            },
        ];

        // Add tool result messages
        for (const toolCall of initialResponse.toolCalls!) {
            if (toolCall.name === "exa_search") {
                const query = toolCall.arguments.query as string;
                console.log(`🔍 Executing Exa search for: "${query}"`);
                
                const result = await executeExaSearch(query);
                console.log(`📊 Tool result received (${result.length} characters)`);
                console.log(result);
                
                messagesWithToolResults.push({
                    role: "tool",
                    content: result,
                    toolCallId: toolCall.id,
                });
            }
        }

        // 5. Send follow-up request with tool results
        console.log("\n🤖 Getting final response from model...");
        const followUpRequest = {
            model: "anthropic/claude-3.5-sonnet",
            messages: messagesWithToolResults,
            tools: [exaSearchTool],
        };

        // Support both streaming and non-streaming modes
        const useStreaming = process.env.USE_STREAMING !== "false";
        
        if (useStreaming) {
            console.log("📡 Using streaming mode...");
            for await (const chunk of openrouter.streamCompletion(followUpRequest)) {
                if (chunk.delta) {
                    process.stdout.write(chunk.delta);
                }

                if (chunk.finished) {
                    console.log("\n---\n✅ Complete workflow finished!");
                    if (chunk.usage) {
                        console.log(`📊 Final token usage: ${chunk.usage.totalTokens} tokens`);
                    }
                    break;
                }
            }
        } else {
            console.log("⚡ Using non-streaming mode...");
            const finalResponse = await openrouter.generateCompletion(followUpRequest);
            console.log(finalResponse.content);
            console.log("\n---\n✅ Complete workflow finished!");
            if (finalResponse.usage) {
                console.log(`📊 Final token usage: ${finalResponse.usage.totalTokens} tokens`);
            }
        }

    } catch (error) {
        if (error instanceof Error) {
            console.error(`\n❌ An error occurred: ${error.message}`);
        } else {
            console.error("\n❌ An unknown error occurred.", error);
        }
    }
}

if (import.meta.main) {
    main();
}