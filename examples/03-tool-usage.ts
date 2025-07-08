/**
 * --- 03. TOOL USAGE ---
 *
 * This example demonstrates how to use tools with models that support them.
 * Tools allow you to extend the capabilities of the model by letting it
 * call external functions.
 *
 * It covers:
 * 1.  Defining a tool with a name, description, and parameters.
 * 2.  Sending a completion request with the defined tool.
 * 3.  Handling the model's response, which may include a tool call.
 * 4.  Simulating the execution of the tool and sending the result back.
 *
 * To run this example, you need to have your OpenAI API key set as an
 * environment variable:
 *
 * export OPENAI_API_KEY="your-openai-api-key"
 *
 * Then, you can run this file using ts-node:
 *
 * ts-node examples/03-tool-usage.ts
 */

import { ModelManager, OpenAIProvider, ToolDefinition } from "../src/index";

// A simple, hardcoded function to simulate getting the weather.
function getCurrentWeather(city: string, unit: "celsius" | "fahrenheit") {
    const temperature = Math.floor(Math.random() * 20 + 10); // Random temp between 10-30
    return {
        city,
        temperature,
        unit,
        forecast: "Sunny with a chance of clouds",
    };
}

async function main() {
    console.log("--- 03. TOOL USAGE ---");

    if (!process.env.OPENAI_API_KEY) {
        console.error("❌ OPENAI_API_KEY environment variable is not set.");
        return;
    }

    const modelManager = new ModelManager();
    const openai = new OpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY,
    });
    modelManager.addProvider(openai);

    // 1. Define the tool
    // The tool definition tells the model what function is available,
    // what it does, and what parameters it accepts.
    const getWeatherTool: ToolDefinition = {
        name: "get_current_weather",
        description: "Get the current weather for a specific city.",
        parameters: {
            type: "object",
            properties: {
                city: {
                    type: "string",
                    description: "The city name, e.g., San Francisco",
                },
                unit: {
                    type: "string",
                    enum: ["celsius", "fahrenheit"],
                    description: "The unit of temperature.",
                },
            },
            required: ["city"],
        },
    };

    try {
        // 2. Send the initial request
        // We include the tool definition in the `tools` array.
        console.log("\n🤖 Asking the model to use the weather tool...");
        const initialRequest = {
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "user" as const,
                    content: "What's the weather like in Boston today in Fahrenheit?",
                },
            ],
            tools: [getWeatherTool],
            toolChoice: "auto" as const, // Let the model decide when to use the tool
        };

        const response = await openai.generateCompletion(initialRequest);

        // 3. Handle the tool call
        // If the model decides to use the tool, the response will contain
        // a `toolCalls` array.
        if (response.toolCalls && response.toolCalls.length > 0) {
            const toolCall = response.toolCalls[0];
            console.log(
                `\n🔧 Model wants to call the '${toolCall.name}' tool with arguments:`
            );
            console.log(toolCall.arguments);

            // 4. Execute the tool and send the result back
            // In a real application, you would call your function here.
            const { city, unit } = toolCall.arguments as {
                city: string;
                unit: "celsius" | "fahrenheit";
            };
            const weather = getCurrentWeather(city, unit);

            console.log("\n✅ Executed the tool. Sending the result back to the model...");

            const toolResultRequest = {
                model: "gpt-4o-mini",
                messages: [
                    ...initialRequest.messages,
                    {
                        role: "assistant" as const,
                        content: "", // Important: content must be a string, even if empty
                        toolCalls: response.toolCalls,
                    },
                    {
                        role: "tool" as const,
                        toolCallId: toolCall.id,
                        content: JSON.stringify(weather),
                    },
                ],
            };

            const finalResponse = await openai.generateCompletion(toolResultRequest);

            console.log("\n💬 Final response from the model:");
            console.log(finalResponse.content);
        } else {
            console.log("\n💬 Model responded directly:");
            console.log(response.content);
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
