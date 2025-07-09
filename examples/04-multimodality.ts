/**
 * --- 04. MULTIMODALITY ---
 *
 * This example demonstrates how to use Google's Gemini vision models to process
 * both text and images. It shows how to send an image to a model and ask
 * a question about it.
 *
 * It covers:
 * 1.  Initializing the ModelManager and the Gemini provider.
 * 2.  Constructing a multimodal message with both text and an image.
 * 3.  Sending the request to a Gemini vision model.
 * 4.  Printing the model's response.
 *
 * To run this example, you need to have your Gemini API key set as an
 * environment variable:
 *
 * export GOOGLE_GENERATIVE_AI_API_KEY="your-gemini-api-key"
 *
 *
 * Then, you can run this file using bun:
 *
 * bun run examples/04-multimodality.ts
 */

import { ModelManager, GeminiProvider, ContentPart } from "../src/index";
import { sampleImageBase64 } from "./assets/sample-media";


async function main() {
    console.log("--- 04. MULTIMODALITY ---");

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        console.error("❌ GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set.");
        return;
    }

    const modelManager = new ModelManager();
    const gemini = new GeminiProvider({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });
    modelManager.addProvider(gemini);

    try {
        // 1. Prepare the image
        // We'll load the sample base64 image.
        

        // 2. Construct the multimodal message
        // The message content is an array of 'ContentPart' objects.
        // One part is the text prompt, and the other is the image.
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

        console.log("\n🤖 Sending image to gemini-2.5-pro for analysis...");
        const response = await gemini.generateCompletion({
            model: "gemini-2.5-pro",
            messages,
            maxTokens: 200,
        });

        console.log("\n💬 Model Response:");
        console.log(response.content);
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
