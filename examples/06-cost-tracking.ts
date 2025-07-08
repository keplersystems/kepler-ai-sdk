/**
 * --- 06. COST TRACKING ---
 *
 * This example demonstrates how to use the built-in cost and usage tracking
 * features of the Kepler AI SDK. This is essential for monitoring your API
 * expenses and understanding your usage patterns.
 *
 * It covers:
 * 1.  Initializing the `PricingCalculator` and `UsageTracker`.
 * 2.  Generating a completion with a specific model.
 * 3.  Calculating the cost of the completion using the `PricingCalculator`.
 * 4.  Tracking the request, token usage, and cost with the `UsageTracker`.
 * 5.  Retrieving and displaying usage statistics for a model.
 *
 * To run this example, you need to have your OpenAI API key set as an
 * environment variable:
 *
 * export OPENAI_API_KEY="your-openai-api-key"
 *
 * Then, you can run this file using ts-node:
 *
 * ts-node examples/06-cost-tracking.ts
 */

import {
    OpenAIProvider,
    PricingCalculator,
    UsageTracker,
} from "../src/index";

async function main() {
    console.log("--- 06. COST TRACKING ---");

    if (!process.env.OPENAI_API_KEY) {
        console.error("❌ OPENAI_API_KEY environment variable is not set.");
        return;
    }

    // 1. Initialize the tracking utilities
    const pricingCalculator = new PricingCalculator();
    const usageTracker = new UsageTracker();
    const openai = new OpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        // 2. Generate a completion
        const model = "gpt-4o-mini";
        console.log(`\n🤖 Generating a completion with ${model}...`);
        const response = await openai.generateCompletion({
            model,
            messages: [
                {
                    role: "user",
                    content: "Explain the importance of cost tracking in LLM applications.",
                },
            ],
            maxTokens: 150,
        });
        console.log("✅ Completion generated successfully.");

        // 3. Calculate the cost
        // The `calculateCost` method takes the token usage and model ID to
        // determine the cost based on the provider's pricing.
        const costBreakdown = await pricingCalculator.calculateCost(
            response.usage,
            response.model
        );

        if (costBreakdown) {
            console.log("\n💵 Cost Calculation:");
            console.log(`  - Input Tokens: ${response.usage.promptTokens}`);
            console.log(`  - Output Tokens: ${response.usage.completionTokens}`);
            console.log(`  - Total Cost: $${costBreakdown.totalCost.toFixed(6)}`);
        }

        // 4. Track the usage
        // The `UsageTracker` stores statistics for each model.
        usageTracker.trackUsage(
            response.model,
            response.usage,
            costBreakdown?.totalCost
        );
        console.log("\n📊 Usage tracked successfully.");

        // 5. Retrieve and display usage statistics
        // You can get a summary of the usage for a specific model.
        const stats = usageTracker.getUsage(model);
        if (stats && !Array.isArray(stats)) {
            console.log(`\n📈 Usage Statistics for ${model}:`);
            console.log(`  - Total Requests: ${stats.totalRequests}`);
            console.log(`  - Total Tokens: ${stats.totalTokens}`);
            console.log(`  - Total Cost: $${stats.totalCost.toFixed(6)}`);
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
