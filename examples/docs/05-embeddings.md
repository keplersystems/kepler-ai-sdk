# 🧠 Embeddings

This guide explains how to generate embeddings for text using the Kepler AI SDK. Embeddings are numerical representations of text that can be used for various machine learning tasks like semantic search, clustering, and classification.

## ⚙️ How it works

The `generateEmbedding` method on a provider takes an input string (or an array of strings) and returns a list of embedding vectors. The response also includes token usage information.

The following example demonstrates how to generate an embedding for a piece of text using the OpenAI provider.

```typescript
import { ModelManager, OpenAIProvider } from "kepler-ai-sdk";

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY environment variable is not set.");
    return;
  }

  const modelManager = new ModelManager();
  const openai = new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY,
  });
  modelManager.addProvider(openai);

  const inputText = "Kepler is a unified SDK for interacting with LLMs.";

  const response = await openai.generateEmbedding({
    model: "text-embedding-3-small",
    input: inputText,
  });

  const embedding = response.embeddings[0];
  console.log("\n✅ Embedding generated successfully!");
  console.log(`  - Dimensions: ${embedding.length}`);
  console.log(
    `  - Sample of embedding: [${embedding.slice(0, 5).join(", ")}...]`
  );
  console.log(`  - Token usage: ${response.usage.totalTokens} tokens`);
}

main();
```

> [!TIP]
> To run this example, you need to have your OpenAI API key set as an environment variable. Then, you can execute the file using `bun run`:
>
> ```bash
> bun run examples/05-embeddings.ts
> ```

## ⏭️ What's next

The next page teaches you how to track API usage and costs.

Continue: [💰 Cost Tracking](06-cost-tracking.md)
