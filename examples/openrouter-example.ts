import { OpenRouterProvider } from "../src/providers/openrouter.js";
import type { ToolDefinition } from "../src/core/interfaces.js";

/**
 * Comprehensive example demonstrating OpenRouter provider capabilities
 * OpenRouter provides access to 300+ models from various providers through a unified API
 * Run with: npx tsx examples/openrouter-example.ts
 */

// Initialize the OpenRouter provider
const openrouter = new OpenRouterProvider({
  apiKey: process.env.OPENROUTER_API_KEY || "your-openrouter-api-key-here",
  appName: "Kepler AI SDK Demo",
  appUrl: "https://github.com/your-username/kepler-ai-sdk",
});

/**
 * Example 1: Basic text completion with GPT-4o
 */
async function basicCompletion() {
  console.log("🚀 Basic Completion with GPT-4o via OpenRouter:");
  console.log("=".repeat(50));

  try {
    const response = await openrouter.generateCompletion({
      model: "openai/gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful AI assistant that provides clear and concise answers.",
        },
        {
          role: "user",
          content:
            "Explain the benefits of using OpenRouter for LLM applications.",
        },
      ],
      temperature: 0.7,
      maxTokens: 500,
    });

    console.log("Model:", response.model);
    console.log("Content:", response.content);
    console.log("Usage:", response.usage);
    console.log("Finish Reason:", response.finishReason);
    console.log();
  } catch (error) {
    console.error("Basic completion failed:", error);
    console.log();
  }
}

/**
 * Example 2: Streaming completion with Claude 3.5 Sonnet
 */
async function streamingCompletion() {
  console.log("🌊 Streaming Completion with Claude 3.5 Sonnet via OpenRouter:");
  console.log("=".repeat(50));

  try {
    const stream = openrouter.streamCompletion({
      model: "anthropic/claude-3.5-sonnet",
      messages: [
        {
          role: "user",
          content:
            "Write a short story about a robot discovering emotions. Stream the response.",
        },
      ],
      temperature: 0.8,
      maxTokens: 300,
    });

    let fullContent = "";
    for await (const chunk of stream) {
      if (chunk.delta) {
        process.stdout.write(chunk.delta);
        fullContent += chunk.delta;
      }

      if (chunk.finished) {
        console.log("\n\n✅ Streaming completed");
        console.log("Usage:", chunk.usage);
        break;
      }
    }
    console.log();
  } catch (error) {
    console.error("Streaming completion failed:", error);
    console.log();
  }
}

/**
 * Example 3: Function calling with Mistral Large
 */
async function functionCalling() {
  console.log("🔧 Function Calling with Mistral Large via OpenRouter:");
  console.log("=".repeat(50));

  const tools: ToolDefinition[] = [
    {
      name: "get_weather",
      description: "Get current weather information for a location",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "The city and state/country",
          },
          units: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            description: "Temperature units",
          },
        },
        required: ["location"],
      },
    },
    {
      name: "calculate_distance",
      description: "Calculate distance between two locations",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Starting location" },
          to: { type: "string", description: "Destination location" },
          unit: {
            type: "string",
            enum: ["km", "miles"],
            description: "Distance unit",
          },
        },
        required: ["from", "to"],
      },
    },
  ];

  try {
    const response = await openrouter.generateCompletion({
      model: "mistralai/mistral-large",
      messages: [
        {
          role: "user",
          content:
            "What's the weather like in Paris? Also calculate the distance from Paris to London in kilometers.",
        },
      ],
      tools,
      toolChoice: "auto",
      maxTokens: 1000,
    });

    console.log("Response:", response.content);

    if (response.toolCalls) {
      console.log("\n🔧 Tool Calls:");
      for (const toolCall of response.toolCalls) {
        console.log(
          `- ${toolCall.name}:`,
          JSON.stringify(toolCall.arguments, null, 2)
        );
      }
    }

    console.log("\nUsage:", response.usage);
    console.log();
  } catch (error) {
    console.error("Function calling failed:", error);
    console.log();
  }
}

/**
 * Example 4: Vision capabilities with GPT-4o
 */
async function visionCapabilities() {
  console.log("👁️ Vision Capabilities with GPT-4o via OpenRouter:");
  console.log("=".repeat(50));

  try {
    const response = await openrouter.generateCompletion({
      model: "openai/gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "What do you see in this image? Describe it in detail.",
            },
            {
              type: "image",
              imageUrl:
                "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/320px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg",
            },
          ],
        },
      ],
      maxTokens: 400,
    });

    console.log("Model:", response.model);
    console.log("Description:", response.content);
    console.log("Usage:", response.usage);
    console.log();
  } catch (error) {
    console.error("Vision capabilities failed:", error);
    console.log();
  }
}

/**
 * Example 5: Model comparison across providers
 */
async function modelComparison() {
  console.log("🔍 Model Comparison Across Providers:");
  console.log("=".repeat(50));

  const prompt = "Explain quantum computing in simple terms.";
  const models = [
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-haiku",
    "google/gemini-2.0-flash",
    "meta-llama/llama-3.3-70b-instruct",
  ];

  for (const model of models) {
    try {
      console.log(`\n🤖 Testing ${model}:`);
      console.log("-".repeat(40));

      const response = await openrouter.generateCompletion({
        model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        maxTokens: 200,
      });

      console.log("Response:", response.content.substring(0, 150) + "...");
      console.log("Tokens used:", response.usage.totalTokens);
    } catch (error) {
      console.error(`❌ ${model} failed:`, error);
    }
  }
  console.log();
}

/**
 * Example 6: List available models
 */
async function listModels() {
  console.log("📋 Available Models via OpenRouter:");
  console.log("=".repeat(50));

  try {
    const models = await openrouter.listModels();

    console.log(`Total models available: ${models.length}`);
    console.log("\nSample of popular models:");

    // Show first 10 models as sample
    const sampleModels = models.slice(0, 10);
    for (const model of sampleModels) {
      const capabilities = Object.entries(model.capabilities)
        .filter(([_, value]) => value)
        .map(([key, _]) => key)
        .join(", ");

      console.log(`\n📦 ${model.name}`);
      console.log(`   ID: ${model.id}`);
      console.log(`   Context: ${model.contextWindow.toLocaleString()} tokens`);
      console.log(`   Capabilities: ${capabilities}`);
      if (model.pricing) {
        console.log(
          `   Pricing: $${model.pricing.inputTokens}/M in, $${model.pricing.outputTokens}/M out`
        );
      }
      if (model.metadata?.originalProvider) {
        console.log(`   Original Provider: ${model.metadata.originalProvider}`);
      }
    }

    // Show breakdown by provider
    const providerCounts = models.reduce((acc, model) => {
      const originalProvider =
        (model.metadata as any)?.originalProvider || "unknown";
      acc[originalProvider] = (acc[originalProvider] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log("\n📊 Models by original provider:");
    Object.entries(providerCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([provider, count]) => {
        console.log(`   ${provider}: ${count} models`);
      });

    console.log();
  } catch (error) {
    console.error("Failed to list models:", error);
    console.log();
  }
}

/**
 * Example 7: Embeddings (if available)
 */
async function embeddingsExample() {
  console.log("🔢 Embeddings via OpenRouter:");
  console.log("=".repeat(50));

  try {
    const response = await openrouter.generateEmbedding({
      model: "openai/text-embedding-3-small",
      input: [
        "OpenRouter provides access to multiple LLM providers",
        "The unified API makes it easy to switch between models",
        "This is great for comparing different AI models",
      ],
    });

    console.log("Model:", response.model);
    console.log("Number of embeddings:", response.embeddings.length);
    console.log("Embedding dimensions:", response.embeddings[0]?.length || 0);
    console.log("First few values:", response.embeddings[0]?.slice(0, 5));
    console.log("Usage:", response.usage);
    console.log();
  } catch (error) {
    console.error("Embeddings failed:", error);
    console.log();
  }
}

/**
 * Example 8: Cost-effective model selection
 */
async function costEffectiveExample() {
  console.log("💰 Cost-Effective Model Selection:");
  console.log("=".repeat(50));

  const prompt =
    "What are the key principles of sustainable software development?";

  // Test different models with cost consideration
  const models = [
    { id: "deepseek/deepseek-chat", name: "DeepSeek Chat (Very Cheap)" },
    { id: "google/gemini-2.0-flash-exp", name: "Gemini 2.0 Flash (Cheap)" },
    { id: "openai/gpt-4o-mini", name: "GPT-4o Mini (Moderate)" },
    { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku (Moderate)" },
  ];

  for (const model of models) {
    try {
      console.log(`\n💡 Testing ${model.name}:`);
      console.log("-".repeat(40));

      const response = await openrouter.generateCompletion({
        model: model.id,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        maxTokens: 150,
      });

      console.log(
        "Response quality preview:",
        response.content.substring(0, 100) + "..."
      );
      console.log("Tokens used:", response.usage.totalTokens);

      // Get model info for pricing
      const modelInfo = await openrouter.getModel(model.id);
      if (modelInfo?.pricing) {
        const estimatedCost =
          (response.usage.promptTokens / 1_000_000) *
          modelInfo.pricing.inputTokens +
          (response.usage.completionTokens / 1_000_000) *
          modelInfo.pricing.outputTokens;
        console.log(`Estimated cost: $${estimatedCost.toFixed(6)}`);
      }
    } catch (error) {
      console.error(`❌ ${model.name} failed:`, error);
    }
  }
  console.log();
}

/**
 * Main execution function
 */
async function main() {
  console.log("🌐 OpenRouter Provider Comprehensive Demo");
  console.log("=========================================\n");

  await basicCompletion();
  await streamingCompletion();
  await functionCalling();
  await visionCapabilities();
  await modelComparison();
  await listModels();
  await embeddingsExample();
  await costEffectiveExample();

  console.log("✅ All OpenRouter examples completed!");
  console.log(
    "\nNote: Some examples may fail if the API key is not valid or models are not available."
  );
  console.log(
    "OpenRouter provides access to 300+ models from various providers through a unified API."
  );
}

// Run the examples
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
