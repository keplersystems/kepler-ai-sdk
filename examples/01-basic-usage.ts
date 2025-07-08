/**
 * --- 01. BASIC USAGE ---
 *
 * This example demonstrates the fundamental features of the Kepler AI SDK.
 * It covers:
 * 1.  Initializing the ModelManager with multiple providers.
 * 2.  Listing all available models from the registered providers.
 * 3.  Finding models based on specific capabilities (e.g., vision).
 * 4.  Generating a simple text completion using a specific model.
 *
 * To run this example, you need to have your API keys for OpenAI, Anthropic,
 * and Gemini set as environment variables:
 *
 * export OPENAI_API_KEY="your-openai-api-key"
 * export ANTHROPIC_API_KEY="your-anthropic-api-key"
 * export GEMINI_API_KEY="your-gemini-api-key"
 *
 * Then, you can run this file using ts-node:
 *
 * ts-node examples/01-basic-usage.ts
 */

import {
    ModelManager,
    OpenAIProvider,
    AnthropicProvider,
    GeminiProvider,
} from "../src/index";

// 1. Initialize the ModelManager
// The ModelManager is the central hub for managing different LLM providers.
const modelManager = new ModelManager();

// 2. Create and add providers
// Instantiate providers for each service you want to use.
// The SDK will automatically use the API keys from environment variables.
if (process.env.OPENAI_API_KEY) {
    const openai = new OpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY,
    });
    modelManager.addProvider(openai);
}

if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = new AnthropicProvider({
        apiKey: process.env.ANTHROPIC_API_KEY,
    });
    modelManager.addProvider(anthropic);
}

if (process.env.GEMINI_API_KEY) {
    const gemini = new GeminiProvider({
        apiKey: process.env.GEMINI_API_KEY,
    });
    modelManager.addProvider(gemini);
}

async function main() {
    console.log("--- 01. BASIC USAGE ---");

    try {
        // 3. List all available models
        // This is useful for discovering which models are available across all providers.
        console.log("\n📋 Listing all available models...");
        const allModels = await modelManager.listModels();
        console.log(`Found ${allModels.length} models.`);

        // Log the first 5 models as a sample
        allModels.slice(0, 5).forEach((model) => {
            console.log(
                `  - ${model.id.padEnd(30)} (Provider: ${model.provider})`
            );
        });

        // 4. Find models with specific capabilities
        // You can filter models by their capabilities, such as 'vision'.
        console.log("\n🔍 Finding models with vision capabilities...");
        const visionModels = await modelManager.findModelsByCapability("vision");
        console.log(`Found ${visionModels.length} models with vision support.`);

        visionModels.slice(0, 3).forEach((model) => {
            console.log(`  - ${model.id}`);
        });

        // 5. Generate a simple text completion
        // The ModelManager can automatically select the appropriate provider based on the model ID.
        console.log("\n🤖 Generating a completion with gpt-4o-mini...");

        const modelId = "gpt-4o-mini";
        const model = await modelManager.getModel(modelId);

        if (!model) {
            throw new Error(`Model ${modelId} not found.`);
        }

        const provider = modelManager.getProvider(model.provider);

        if (!provider) {
            throw new Error(`Provider for model ${modelId} not found.`);
        }

        const response = await provider.generateCompletion({
            model: modelId,
            messages: [
                {
                    role: "user",
                    content: "Explain what a unified LLM SDK is in one sentence.",
                },
            ],
            temperature: 0.7,
            maxTokens: 100,
        });

        console.log("\n💬 Model Response:");
        console.log(response.content);
    } catch (error) {
        if (error instanceof Error) {
            console.error(`❌ An error occurred: ${error.message}`);
        } else {
            console.error("❌ An unknown error occurred.", error);
        }
    }
}

// Run the example
if (import.meta.main) {
    main();
}
