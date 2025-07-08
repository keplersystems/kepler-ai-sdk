# 🚀 Basic Usage

This guide covers the fundamental features of the Kepler AI SDK. You will learn how to:

-   Initialize the `ModelManager` with multiple providers.
-   List all available models.
-   Find models based on specific capabilities.
-   Generate a simple text completion.

## ⚙️ How it works

The `ModelManager` is the central hub for managing different LLM providers. You can add multiple providers to the manager, and it will handle the routing of requests to the appropriate provider based on the model ID.

The following example demonstrates how to set up the `ModelManager` with OpenAI, Anthropic, and Gemini providers, and then use it to generate a completion.

```typescript
import {
  ModelManager,
  OpenAIProvider,
  AnthropicProvider,
  GeminiProvider,
} from "kepler-ai-sdk";

// 1. Initialize the ModelManager
const modelManager = new ModelManager();

// 2. Create and add providers
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
  // 3. List all available models
  const allModels = await modelManager.listModels();
  console.log(`Found ${allModels.length} models.`);

  // 4. Find models with vision capabilities
  const visionModels = await modelManager.findModelsByCapability("vision");
  console.log(`Found ${visionModels.length} models with vision support.`);

  // 5. Generate a simple text completion
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
  });

  console.log(response.content);
}

main();
```

> [!TIP]
> To run this example, you need to have your API keys for OpenAI, Anthropic, and Gemini set as environment variables. Then, you can execute the file using `bun run`:
>
> ```bash
> bun run examples/01-basic-usage.ts
> ```

## ⏭️ What's next

The next page teaches you how to handle streaming responses from models.

Continue: [🌊 Streaming](02-streaming.md)
