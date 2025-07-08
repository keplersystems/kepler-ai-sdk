/**
 * --- 04. MULTIMODALITY ---
 *
 * This example demonstrates how to use multimodal models that can process
 * both text and images. It shows how to send an image to a model and ask
 * a question about it.
 *
 * It covers:
 * 1.  Initializing the ModelManager and a vision-capable provider (OpenAI).
 * 2.  Constructing a multimodal message with both text and an image.
 * 3.  Sending the request to a vision model (e.g., gpt-4o-mini).
 * 4.  Printing the model's response.
 *
 * To run this example, you need to have your OpenAI API key set as an
 * environment variable:
 *
 * export OPENAI_API_KEY="your-openai-api-key"
 *
 * You also need to have the sample image file at `examples/assets/sample-image.png`.
 *
 * Then, you can run this file using ts-node:
 *
 * ts-node examples/04-multimodality.ts
 */

import { ModelManager, OpenAIProvider, ContentPart } from "../src/index";
import * as fs from "fs";
import * as path from "path";

// Helper function to convert an image to a base64 string
function imageToBase64(filePath: string): string {
    const image = fs.readFileSync(filePath);
    return Buffer.from(image).toString("base64");
}

async function main() {
    console.log("--- 04. MULTIMODALITY ---");

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
        // 1. Prepare the image
        // We'll load the sample image and convert it to a base64 string.
        const imagePath = path.join(__dirname, "assets", "sample-image.png");
        const base64Image = imageToBase64(imagePath);

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
                        imageUrl: `data:image/png;base64,${base64Image}`,
                    },
                ] as ContentPart[],
            },
        ];

        // 3. Send the request to a vision model
        console.log("\n🤖 Sending image to gpt-4o-mini for analysis...");
        const response = await openai.generateCompletion({
            model: "gpt-4o-mini",
            messages,
            maxTokens: 200,
        });

        // 4. Print the response
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
