# 🌊 Streaming

This guide explains how to use the streaming feature of the Kepler AI SDK. Streaming allows you to receive the response from the model as a series of chunks, which is useful for creating real-time, interactive experiences.

## ⚙️ How it works

The `streamCompletion` method on a provider returns an async iterator that yields chunks of the response as they become available. Each chunk contains a `delta` with the new text and a `finished` flag to indicate if the stream is complete.

The following example demonstrates how to stream a response from the OpenAI provider.

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

  for await (const chunk of openai.streamCompletion(request)) {
    if (chunk.delta) {
      process.stdout.write(chunk.delta);
    }

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
}

main();
```

> [!TIP]
> To run this example, you need to have your OpenAI API key set as an environment variable. Then, you can execute the file using `bun run`:
>
> ```bash
> bun run examples/02-streaming.ts
> ```

## ⏭️ What's next

The next page teaches you how to use tools with models.

Continue: [🛠️ Tool Usage](03-tool-usage.md)
