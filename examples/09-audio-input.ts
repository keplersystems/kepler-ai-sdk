/**
 * --- 09. AUDIO INPUTS ---
 *
 * This example demonstrates how to use audio inputs with OpenRouter models
 * that support audio processing. It shows how to send audio files for
 * transcription and analysis.
 *
 * It covers:
 * 1. Encoding audio files to base64 for OpenRouter
 * 2. Sending audio content for transcription
 * 3. Using different audio formats (wav, mp3)
 * 4. Error handling for audio processing
 *
 * To run this example, you need to have your OpenRouter API key set as an
 * environment variable:
 *
 * export OPENROUTER_API_KEY="your-openrouter-api-key"
 *
 * Then, you can run this file using bun:
 *
 * bun run examples/09-audio-input.ts
 */

import { ModelManager, OpenAIProvider } from "../src/index";
import { readFileSync } from "fs";
import { join } from "path";

// Helper function to encode audio file to base64
function encodeAudioToBase64(audioPath: string): string {
  const audioBuffer = readFileSync(audioPath);
  return audioBuffer.toString("base64");
}

async function main() {
  console.log("--- 09. AUDIO INPUTS ---");

  if (!process.env.OPENROUTER_API_KEY) {
    console.error("❌ OPENROUTER_API_KEY environment variable is not set.");
    console.error(
      "Please set it with: export OPENROUTER_API_KEY='your-api-key'",
    );
    return;
  }

  const modelManager = new ModelManager();
  const openrouter = new OpenAIProvider({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
  });
  modelManager.addProvider(openrouter);

  try {
    console.log("\n🎵 Processing audio with OpenRouter...");
    console.log("📝 Note: This example requires an actual audio file to work");

    const audioPath = join(process.cwd(), "examples", "tts.wav");
    const base64Audio = encodeAudioToBase64(audioPath);

    const response = await openrouter.generateCompletion({
      model: "google/gemini-2.5-flash", // Model that supports audio
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please transcribe this audio file and provide a summary.",
            },
            {
              type: "audio",
              audioUrl: base64Audio, // Base64-encoded audio data
              mimeType: "audio/wav", // Specify the audio format
            },
          ],
        },
      ],
    });

    console.log("\n📄 Transcription and Summary:");
    console.log(response.content);

    console.log("\n🎯 Supported audio formats:");
    console.log("- WAV (.wav) - audio/wav");
    console.log("- MP3 (.mp3) - audio/mp3");

    console.log("\n🤖 Recommended models for audio:");
    console.log("- google/gemini-2.5-flash");
    console.log("- google/gemini-2.5-pro");
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n❌ An error occurred: ${error.message}`);
      if (error.message.includes("audio")) {
        console.error(
          "💡 Make sure you're using a model that supports audio inputs",
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
