/**
 * --- 05. EMBEDDINGS ---
 *
 * This example demonstrates how to generate embeddings for text using the
 * Kepler AI SDK. Embeddings are numerical representations of text that can
 * be used for various machine learning tasks like semantic search,
 * clustering, and classification.
 *
 * It covers:
 * 1.  Initializing the ModelManager and a provider that supports embeddings.
 * 2.  Creating a request to generate embeddings for a piece of text.
 * 3.  Handling the response, which includes the embedding vectors.
 *
 * To run this example, you need to have your OpenAI API key set as an
 * environment variable:
 *
 * export OPENAI_API_KEY="your-openai-api-key"
 *
 * Then, you can run this file using ts-node:
 *
 * ts-node examples/05-embeddings.ts
 */

import { ModelManager, OpenAIProvider } from "../src/index";

async function main() {
    console.log("--- 05. EMBEDDINGS ---");

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
        // 1. Define the input text
        const inputText = "Kepler is a unified SDK for interacting with LLMs.";

        // 2. Create the embedding request
        console.log(`\n🤖 Generating embedding for the text: "${inputText}"`);
        const response = await openai.generateEmbedding({
            model: "text-embedding-3-small",
            input: inputText,
        });

        // 3. Print the results
        // The response contains the embedding vector and token usage.
        const embedding = response.embeddings[0];
        console.log("\n✅ Embedding generated successfully!");
        console.log(`  - Dimensions: ${embedding.length}`);
        console.log(
            `  - Sample of embedding: [${embedding.slice(0, 5).join(", ")}...]`
        );
        console.log(`  - Token usage: ${response.usage.totalTokens} tokens`);
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
