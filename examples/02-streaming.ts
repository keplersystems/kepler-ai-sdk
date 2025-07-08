/**
 * --- 02. STREAMING ---
 *
 * This example demonstrates how to use the streaming feature of the Kepler AI SDK.
 * Streaming allows you to receive the response from the model as a series of
 * chunks, which is useful for creating real-time, interactive experiences.
 *
 * It covers:
 * 1.  Initializing the ModelManager and a provider (OpenAI in this case).
 * 2.  Creating a streaming completion request.
 * 3.  Iterating over the response stream and printing the chunks.
 * 4.  Handling the final response, including token usage.
 *
 * To run this example, you need to have your OpenAI API key set as an
 * environment variable:
 *
 * export OPENAI_API_KEY="your-openai-api-key"
 *
 * Then, you can run this file using ts-node:
 *
 * ts-node examples/02-streaming.ts
 */

import { ModelManager, OpenAIProvider } from "../src/index";

async function main() {
    console.log("--- 02. STREAMING ---");

    // 1. Initialize the ModelManager and add the OpenAI provider
    // We'll use OpenAI for this example as it has robust streaming support.
    if (!process.env.OPENAI_API_KEY) {
        console.error("❌ OPENAI_API_KEY environment variable is not set.");
        return;
    }

    const modelManager = new ModelManager();
    const openai = new OpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY,
    });
    modelManager.addProvider(openai);

    try {
        // 2. Create a streaming completion request
        // The request is similar to a regular completion, but we'll use the
        // `streamCompletion` method on the provider.
        const request = {
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "user" as const,
                    content: "Write a short, futuristic story about a friendly robot.",
                },
            ],
            temperature: 0.8,
            maxTokens: 150,
        };

        console.log("\n🤖 Streaming response from gpt-4o-mini...");
        console.log("---");

        // 3. Iterate over the stream
        // The `streamCompletion` method returns an async iterator that yields
        // chunks of the response as they become available.
        for await (const chunk of openai.streamCompletion(request)) {
            // `chunk.delta` contains the new text in the current chunk.
            if (chunk.delta) {
                process.stdout.write(chunk.delta);
            }

            // `chunk.finished` is true when the stream is complete.
            // The final chunk may also contain the total token usage.
            if (chunk.finished) {
                console.log("\n---\n✅ Stream finished.");
                if (chunk.usage) {
                    console.log(
                        `📊 Token usage: ${chunk.usage.totalTokens} tokens`
                    );
                }
                break; // Exit the loop once the stream is finished
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

// Run the example
if (import.meta.main) {
    main();
}
