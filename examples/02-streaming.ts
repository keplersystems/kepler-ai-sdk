/**
 * --- 02. STREAMING ---
 *
 * This example demonstrates how to use the streaming feature of the Kepler AI SDK
 * with the Anthropic provider. Streaming allows you to receive the response from
 * the model as a series of chunks, which is useful for creating real-time,
 * interactive experiences.
 *
 * It covers:
 * 1.  Initializing the ModelManager and the Anthropic provider.
 * 2.  Creating a streaming completion request.
 * 3.  Iterating over the response stream and printing the chunks.
 * 4.  Handling the final response, including token usage.
 *
 * To run this example, you need to have your Anthropic API key set as an
 * environment variable:
 *
 * export ANTHROPIC_API_KEY="your-anthropic-api-key"
 *
 * Then, you can run this file using bun:
 *
 * bun run examples/02-streaming.ts
 */

import { ModelManager, AnthropicProvider } from "../src/index";

async function main() {
    console.log("--- 02. STREAMING ---");

    if (!process.env.ANTHROPIC_API_KEY) {
        console.error("❌ ANTHROPIC_API_KEY environment variable is not set.");
        return;
    }

    const modelManager = new ModelManager();
    const anthropic = new AnthropicProvider({
        apiKey: process.env.ANTHROPIC_API_KEY,
    });
    modelManager.addProvider(anthropic);

    try {
        const request = {
            model: "claude-3-5-sonnet-20240620",
            messages: [
                {
                    role: "user" as const,
                    content: "Write a short, futuristic story about a friendly robot.",
                },
            ],
            temperature: 0.8,
            maxTokens: 150,
        };

        console.log(`\n🤖 Streaming response from ${request.model}...`);
        console.log("---");

        // 3. Iterate over the stream
        // The `streamCompletion` method returns an async iterator that yields
        // chunks of the response as they become available.
        for await (const chunk of anthropic.streamCompletion(request)) {
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
                break;
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
