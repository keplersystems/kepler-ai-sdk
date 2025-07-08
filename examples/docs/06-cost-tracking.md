# 💰 Cost Tracking

This guide explains how to use the built-in cost and usage tracking features of the Kepler AI SDK. This is essential for monitoring your API expenses and understanding your usage patterns.

## ⚙️ How it works

The SDK provides two main utilities for cost tracking:

-   **`PricingCalculator`**: Calculates the cost of a completion based on the token usage and model ID.
-   **`UsageTracker`**: Stores and retrieves usage statistics for each model.

The following example demonstrates how to use these utilities to track the cost of a completion.

```typescript
import {
  OpenAIProvider,
  PricingCalculator,
  UsageTracker,
} from "kepler-ai-sdk";

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY environment variable is not set.");
    return;
  }

  const pricingCalculator = new PricingCalculator();
  const usageTracker = new UsageTracker();
  const openai = new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const model = "gpt-4o-mini";
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

  const costBreakdown = await pricingCalculator.calculateCost(
    response.usage,
    response.model
  );

  if (costBreakdown) {
    console.log("\n💵 Cost Calculation:");
    console.log(`  - Total Cost: $${costBreakdown.totalCost.toFixed(6)}`);
  }

  usageTracker.trackUsage(
    response.model,
    response.usage,
    costBreakdown?.totalCost
  );

  const stats = usageTracker.getUsage(model);
  if (stats && !Array.isArray(stats)) {
    console.log(`\n📈 Usage Statistics for ${model}:`);
    console.log(`  - Total Requests: ${stats.totalRequests}`);
    console.log(`  - Total Tokens: ${stats.totalTokens}`);
    console.log(`  - Total Cost: $${stats.totalCost.toFixed(6)}`);
  }
}

main();
```

> [!TIP]
> To run this example, you need to have your OpenAI API key set as an environment variable. Then, you can execute the file using `bun run`:
>
> ```bash
> bun run examples/06-cost-tracking.ts
> ```

## ⏭️ What's next

The next page teaches you how to use OAuth and create custom providers.

Continue: [🔌 OAuth & Custom Providers](07-oauth-and-custom-providers.md)
