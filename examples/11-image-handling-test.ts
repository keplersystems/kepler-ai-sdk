/**
 * --- 11. IMAGE HANDLING TEST ---
 *
 * This example tests image handling capabilities across all providers that support vision.
 * It validates that the recent image_url standardization changes work correctly across
 * different provider implementations.
 *
 * It covers:
 * 1. Testing image processing with Anthropic Claude vision models
 * 2. Testing image processing with OpenAI GPT-4V models
 * 3. Testing image processing with Google Gemini vision models
 * 4. Testing image processing with OpenRouter vision models
 * 5. Testing image processing with GitHub Copilot vision models
 * 6. Testing image processing with Mistral vision models
 * 7. Comparing responses and ensuring consistent behavior
 *
 * To run this example, you need to have the respective API keys set as environment variables:
 *
 * export ANTHROPIC_API_KEY="your-anthropic-api-key"
 * export OPENAI_API_KEY="your-openai-api-key"
 * export GOOGLE_GENERATIVE_AI_API_KEY="your-gemini-api-key"
 * export OPENROUTER_API_KEY="your-openrouter-api-key"
 * export GITHUB_TOKEN="your-github-token"
 * export MISTRAL_API_KEY="your-mistral-api-key"
 *
 * Then, you can run this file using bun:
 *
 * bun run examples/11-image-handling-test.ts
 */

import {
  AnthropicProvider,
  OpenAIProvider,
  GeminiProvider,
  OpenRouterProvider,
  GitHubCopilotProvider,
  MistralProvider,
  ContentPart,
} from "../src/index";
import { sampleImageBase64 } from "./assets/sample-media";

interface TestConfig {
  name: string;
  provider: any;
  model: string;
  apiKey?: string;
  enabled: boolean;
}

async function main() {
  // overwrite sample-media.ts sampleImageBase64 with a live image URL for testing
  // let sampleImageBase64 = "https://img.auna.li/images/2025/04/28/image.png";

  console.log("--- 11. IMAGE HANDLING TEST ---");
  console.log(
    "Testing image_url handling across all vision-capable providers\n",
  );

  // Configure test cases for each provider
  const testConfigs: TestConfig[] = [
    {
      name: "Anthropic Claude",
      provider: AnthropicProvider,
      model: "claude-3-5-sonnet-20241022",
      apiKey: process.env.ANTHROPIC_API_KEY,
      enabled: !!process.env.ANTHROPIC_API_KEY,
    },
    {
      name: "OpenAI GPT-4V",
      provider: OpenAIProvider,
      model: "gpt-5-mini",
      apiKey: process.env.OPENAI_API_KEY,
      enabled: !!process.env.OPENAI_API_KEY,
    },
    {
      name: "Google Gemini",
      provider: GeminiProvider,
      model: "gemini-2.5-flash",
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      enabled: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    },
    {
      name: "OpenRouter",
      provider: OpenRouterProvider,
      model: "openai/gpt-5-mini",
      apiKey: process.env.OPENROUTER_API_KEY,
      enabled: !!process.env.OPENROUTER_API_KEY,
    },
    {
      name: "GitHub Copilot",
      provider: GitHubCopilotProvider,
      model: "gpt-4o",
      apiKey: process.env.GITHUB_TOKEN,
      enabled: !!process.env.GITHUB_TOKEN,
    },
    {
      name: "Mistral",
      provider: MistralProvider,
      model: "mistral-small-latest",
      apiKey: process.env.MISTRAL_API_KEY,
      enabled: !!process.env.MISTRAL_API_KEY,
    },
  ];

  // Filter enabled configurations
  const enabledConfigs = testConfigs.filter((config) => config.enabled);

  if (enabledConfigs.length === 0) {
    console.error(
      "❌ No API keys found. Please set at least one of the following environment variables:",
    );
    testConfigs.forEach((config) => {
      const envVar =
        config.name === "Anthropic Claude"
          ? "ANTHROPIC_API_KEY"
          : config.name === "OpenAI GPT-4V"
            ? "OPENAI_API_KEY"
            : config.name === "Google Gemini"
              ? "GOOGLE_GENERATIVE_AI_API_KEY"
              : config.name === "OpenRouter"
                ? "OPENROUTER_API_KEY"
                : config.name === "GitHub Copilot"
                  ? "GITHUB_TOKEN"
                  : "MISTRAL_API_KEY";
      console.error(`   ${envVar}`);
    });
    return;
  }

  console.log(`✅ Found ${enabledConfigs.length} enabled provider(s):`);
  enabledConfigs.forEach((config) => console.log(`   - ${config.name}`));
  console.log();

  // Create provider instances
  const providers: Array<{ config: TestConfig; provider: any }> = [];

  for (const config of enabledConfigs) {
    try {
      const provider = new config.provider({
        apiKey: config.apiKey,
      });
      providers.push({ config, provider });
      console.log(`✅ Created ${config.name} provider instance`);
    } catch (error) {
      console.error(`❌ Failed to create ${config.name} provider:`, error);
    }
  }

  console.log();

  // Prepare the multimodal message using the standardized image_url format
  const messages = [
    {
      role: "user" as const,
      content: [
        {
          type: "text" as const,
          text: "What do you see in this image? Describe it briefly in 1-2 sentences.",
        },
        {
          type: "image_url" as const,
          imageUrl: sampleImageBase64,
        },
      ] as ContentPart[],
    },
  ];

  console.log("🔍 Testing image processing across providers...\n");

  // Test each provider individually
  const results: Array<{
    config: TestConfig;
    success: boolean;
    response?: string;
    error?: string;
  }> = [];

  for (const { config, provider } of providers) {
    console.log(`🤖 Testing ${config.name} with model ${config.model}...`);

    try {
      const startTime = Date.now();
      const response = await provider.generateCompletion({
        model: config.model,
        messages,
        maxTokens: 8192,
      });
      const duration = Date.now() - startTime;

      console.log(`✅ ${config.name} responded in ${duration}ms`);
      console.log(
        `   Response: ${response.content.substring(0, 100)}${response.content.length > 100 ? "..." : ""}`,
      );

      results.push({
        config,
        success: true,
        response: response.content,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`❌ ${config.name} failed: ${errorMessage}`);

      results.push({
        config,
        success: false,
        error: errorMessage,
      });
    }

    console.log(); // Empty line for readability
  }

  // Summary
  console.log("📊 SUMMARY");
  console.log("=".repeat(50));

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);

  if (successful.length > 0) {
    console.log("\n✅ Working providers:");
    successful.forEach((result) => {
      console.log(`   - ${result.config.name} (${result.config.model})`);
    });
  }

  if (failed.length > 0) {
    console.log("\n❌ Failed providers:");
    failed.forEach((result) => {
      console.log(`   - ${result.config.name}: ${result.error}`);
    });
  }

  console.log("\n🎉 Image handling test completed!");

  if (successful.length === enabledConfigs.length) {
    console.log("✅ All providers successfully processed the image!");
    console.log(
      "✅ The image_url standardization changes are working correctly!",
    );
  } else if (successful.length > 0) {
    console.log(
      "⚠️  Some providers failed, but the working ones confirm the image_url format is correct.",
    );
  } else {
    console.log(
      "❌ All providers failed. There may be an issue with the image_url format or other configuration.",
    );
  }
}

if (import.meta.main) {
  main();
}
