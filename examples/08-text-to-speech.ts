/**
 * --- 08. TEXT-TO-SPEECH ---
 *
 * This example demonstrates how to use Google's Gemini TTS (Text-to-Speech)
 * capabilities to convert text into audio. It shows how to generate speech
 * from text using different voice options.
 *
 * It covers:
 * 1. Initializing the ModelManager and the Gemini provider.
 * 2. Generating audio from text using Gemini's TTS models.
 * 3. Saving the audio output to a file.
 * 4. Using different voice options.
 *
 * To run this example, you need to have your Gemini API key set as an
 * environment variable:
 *
 * export GOOGLE_GENERATIVE_AI_API_KEY="your-gemini-api-key"
 *
 * Then, you can run this file using bun:
 *
 * bun run examples/08-text-to-speech.ts
 */

import { ModelManager, GeminiProvider } from "../src/index";
import { writeFileSync } from "fs";
import { join } from "path";

async function main() {
  console.log("--- 08. TEXT-TO-SPEECH ---");

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error(
      "❌ GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set.",
    );
    console.error(
      "Please set it with: export GOOGLE_GENERATIVE_AI_API_KEY='your-api-key'",
    );
    return;
  }

  const modelManager = new ModelManager();
  const gemini = new GeminiProvider({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });
  modelManager.addProvider(gemini);

  try {
    console.log("\n📖 Generating speech for long content...");
    const text = `The art of crafting traditional sculptures has been passed down through generations. When I visited the workshops last month, I found 2-3 artisans in each workshop busy preparing sculptures for the upcoming festival. The master craftsman explained that skilled sculptors arrive around January and complete their work by April. They use clay imported from distant regions to create intricate designs. It typically takes about 25 days to complete a large sculpture. The process involves creating a clay model first, then applying a rubber coating that hardens over 10 days to form a mold.`;

    const response = await gemini.generateAudio({
      text: text.trim(),
      model: "gemini-2.5-flash-preview-tts",
      voice: "leda",
    });

    const audioPath = join(process.cwd(), "examples", "tts.wav");

    const audioBuffer = Buffer.from(response.audio);
    writeFileSync(audioPath, audioBuffer);
    console.log(`✅ TTS audio saved to: ${audioPath}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n❌ An error occurred: ${error.message}`);
      if (error.message.includes("TTS")) {
        console.error(
          "💡 Make sure you're using a TTS-capable Gemini model like 'gemini-2.5-flash-preview-tts'",
        );
      }
    } else {
      console.error("\n❌ An unknown error occurred.", error);
    }
  }
}

if (import.meta.main) {
  main();
}
