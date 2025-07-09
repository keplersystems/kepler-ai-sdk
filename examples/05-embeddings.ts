/**
 * --- 05. EMBEDDINGS ---
 *
 * This example demonstrates how to generate embeddings for text using the
 * Cohere provider. Embeddings are numerical representations of text that can
 * be used for various machine learning tasks like semantic search,
 * clustering, and classification.
 *
 * It covers:
 * 1.  Initializing the ModelManager and the Cohere provider.
 * 2.  Creating a request to generate embeddings for a piece of text.
 * 3.  Handling the response, which includes the embedding vectors.
 *
 * To run this example, you need to have your Cohere API key set as an
 * environment variable:
 *
 * export COHERE_API_KEY="your-cohere-api-key"
 *
 * Then, you can run this file using bun:
 *
 * bun run examples/05-embeddings.ts
 */

import { ModelManager, CohereProvider } from "../src/index";

async function main() {
    console.log("--- 05. EMBEDDINGS ---");

    if (!process.env.COHERE_API_KEY) {
        console.error("❌ COHERE_API_KEY environment variable is not set.");
        return;
    }

    const modelManager = new ModelManager();
    const cohere = new CohereProvider({
        apiKey: process.env.COHERE_API_KEY,
    });
    modelManager.addProvider(cohere);

    try {
        const inputText = "Kepler is a unified SDK for interacting with LLMs.";
        const model = "embed-english-v3.0";

        console.log(`\n🤖 Generating embedding for the text: "${inputText}"`);
        const response = await cohere.generateEmbedding({
            model,
            input: inputText,
        });

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
