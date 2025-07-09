# 🖼️ Multimodality

This guide explains how to use multimodal models that can process both text and images. You will learn how to send an image to a model and ask a question about it.

## ⚙️ How it works

To send an image to a model, you need to construct a message with a `content` array that includes both a `text` part and an `image` part. The image should be provided as a base64-encoded string.

The following example demonstrates how to send an image to the `gpt-4o-mini` model for analysis.

```typescript
import { ModelManager, OpenAIProvider, ContentPart } from "kepler-ai-sdk";
import { sampleImageBase64 } from "./assets/sample-media";

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

  // 2. Construct the multimodal message
  const messages = [
    {
      role: "user" as const,
      content: [
        {
          type: "text" as const,
          text: "What do you see in this image? Describe it in a few sentences.",
        },
        {
          type: "image" as const,
          imageUrl: `${sampleImageBase64}`,
        },
      ] as ContentPart[],
    },
  ];

  // 3. Send the request to a vision model
  const response = await openai.generateCompletion({
    model: "gpt-4o-mini",
    messages,
    maxTokens: 200,
  });

  // 4. Print the response
  console.log(response.content);
}

main();
```

> [!TIP]
> To run this example, you need to have your OpenAI API key set as an environment variable and the sample image file at `examples/assets/sample-image.png`. Then, you can execute the file using `bun run`:
>
> ```bash
> bun run examples/04-multimodality.ts
> ```

## ⏭️ What's next

The next page teaches you how to generate text embeddings.

Continue: [🧠 Embeddings](05-embeddings.md)
