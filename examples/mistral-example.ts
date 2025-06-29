import { MistralProvider } from "../src/providers/mistral.js";
import type { ToolDefinition } from "../src/core/interfaces.js";

/**
 * Comprehensive example demonstrating Mistral provider capabilities
 * Run with: npx tsx examples/mistral-example.ts
 */

// Initialize the Mistral provider
const mistral = new MistralProvider({
  apiKey: process.env.MISTRAL_API_KEY || "your-mistral-api-key-here",
});

/**
 * Example 1: Basic text completion
 */
async function basicCompletion() {
  console.log("🚀 Basic Completion with Mistral Large:");
  console.log("=".repeat(50));

  try {
    const response = await mistral.generateCompletion({
      model: "mistral-large-latest",
      messages: [
        {
          role: "user",
          content:
            "Explain the key differences between Mistral AI and other LLM providers in 3 bullet points.",
        },
      ],
      temperature: 0.7,
      maxTokens: 200,
    });

    console.log("Response:", response.content);
    console.log("Usage:", response.usage);
    console.log("Model:", response.model);
    console.log();
  } catch (error) {
    console.error("Error:", error);
  }
}

/**
 * Example 2: Streaming completion
 */
async function streamingCompletion() {
  console.log("🌊 Streaming Completion:");
  console.log("=".repeat(50));

  try {
    const stream = mistral.streamCompletion({
      model: "mistral-small-latest",
      messages: [
        {
          role: "user",
          content:
            "Write a creative short story about an AI that discovers it can dream. Keep it concise.",
        },
      ],
      temperature: 0.9,
      maxTokens: 300,
    });

    process.stdout.write("Streaming: ");
    for await (const chunk of stream) {
      process.stdout.write(chunk.delta);

      if (chunk.finished) {
        console.log("\n\nStream finished!");
        if (chunk.usage) {
          console.log("Final usage:", chunk.usage);
        }
      }
    }
    console.log();
  } catch (error) {
    console.error("Error:", error);
  }
}

/**
 * Example 3: Function calling / Tool use
 */
async function functionCalling() {
  console.log("🛠️  Function Calling:");
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
            description: "The city and country, e.g. Paris, France",
          },
          unit: {
            type: "string",
            description: "Temperature unit",
            enum: ["celsius", "fahrenheit"],
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
          from: {
            type: "string",
            description: "Starting location",
          },
          to: {
            type: "string",
            description: "Destination location",
          },
          unit: {
            type: "string",
            description: "Distance unit",
            enum: ["km", "miles"],
          },
        },
        required: ["from", "to"],
      },
    },
  ];

  try {
    const response = await mistral.generateCompletion({
      model: "mistral-large-latest",
      messages: [
        {
          role: "user",
          content:
            "What's the weather like in Tokyo, Japan? Also, how far is it from Tokyo to Osaka?",
        },
      ],
      tools,
      toolChoice: "auto",
      temperature: 0.1,
    });

    console.log("Response:", response.content);

    if (response.toolCalls) {
      console.log("\nTool calls made:");
      response.toolCalls.forEach((call, index) => {
        console.log(`${index + 1}. ${call.name}:`, call.arguments);
      });
    }

    console.log("Usage:", response.usage);
    console.log();
  } catch (error) {
    console.error("Error:", error);
  }
}

/**
 * Example 4: Embeddings
 */
async function embeddings() {
  console.log("🔢 Embeddings Generation:");
  console.log("=".repeat(50));

  try {
    const texts = [
      "Mistral AI provides powerful language models",
      "Vector embeddings capture semantic meaning",
      "Machine learning enables intelligent applications",
    ];

    const response = await mistral.generateEmbedding({
      model: "mistral-embed",
      input: texts,
    });

    console.log(`Generated embeddings for ${texts.length} texts`);
    console.log(
      `Embedding dimensions: ${response.embeddings[0]?.length || "unknown"}`
    );
    console.log("Usage:", response.usage);

    // Show similarity between first two embeddings
    if (response.embeddings.length >= 2) {
      const similarity = cosineSimilarity(
        response.embeddings[0],
        response.embeddings[1]
      );
      console.log(
        `Similarity between first two texts: ${similarity.toFixed(4)}`
      );
    }
    console.log();
  } catch (error) {
    console.error("Error:", error);
  }
}

/**
 * Example 5: Vision capabilities with Pixtral
 */
async function visionCapabilities() {
  console.log("👁️  Vision Capabilities (Pixtral):");
  console.log("=".repeat(50));

  try {
    const response = await mistral.generateCompletion({
      model: "pixtral-large-2411",
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
                "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg",
            },
          ],
        },
      ],
      temperature: 0.3,
      maxTokens: 300,
    });

    console.log("Vision analysis:", response.content);
    console.log("Usage:", response.usage);
    console.log();
  } catch (error) {
    console.error("Error:", error);
  }
}

/**
 * Example 6: Multi-turn conversation
 */
async function multiTurnConversation() {
  console.log("💬 Multi-turn Conversation:");
  console.log("=".repeat(50));

  try {
    const response = await mistral.generateCompletion({
      model: "mistral-large-latest",
      messages: [
        {
          role: "user",
          content: "Can you help me understand quantum computing?",
        },
        {
          role: "assistant",
          content:
            'Certainly! Quantum computing is a revolutionary approach to computation that harnesses quantum mechanical phenomena like superposition and entanglement. Unlike classical computers that use bits (0 or 1), quantum computers use quantum bits or "qubits" that can exist in multiple states simultaneously.',
        },
        {
          role: "user",
          content:
            "That's interesting! Can you give me a simple analogy to understand superposition?",
        },
      ],
      temperature: 0.7,
      maxTokens: 250,
    });

    console.log("Assistant response:", response.content);
    console.log("Usage:", response.usage);
    console.log();
  } catch (error) {
    console.error("Error:", error);
  }
}

/**
 * Example 7: Code generation with Codestral
 */
async function codeGeneration() {
  console.log("💻 Code Generation (Codestral):");
  console.log("=".repeat(50));

  try {
    const response = await mistral.generateCompletion({
      model: "codestral-2501",
      messages: [
        {
          role: "user",
          content:
            "Write a Python function that implements a binary search algorithm. Include proper documentation and type hints.",
        },
      ],
      temperature: 0.1,
      maxTokens: 400,
    });

    console.log("Generated code:", response.content);
    console.log("Usage:", response.usage);
    console.log();
  } catch (error) {
    console.error("Error:", error);
  }
}

/**
 * Example 8: JSON mode
 */
async function jsonMode() {
  console.log("📋 JSON Mode:");
  console.log("=".repeat(50));

  try {
    const response = await mistral.generateCompletion({
      model: "mistral-large-latest",
      messages: [
        {
          role: "user",
          content:
            'Create a JSON object representing a book with title, author, year, and genres (array). Use "The Lord of the Rings" as an example.',
        },
      ],
      responseFormat: { type: "json_object" },
      temperature: 0.1,
    });

    console.log("JSON response:", response.content);

    try {
      const parsed = JSON.parse(response.content);
      console.log("Parsed object:", parsed);
    } catch (e) {
      console.log("Note: Response may not be valid JSON");
    }

    console.log("Usage:", response.usage);
    console.log();
  } catch (error) {
    console.error("Error:", error);
  }
}

/**
 * Example 9: Model listing
 */
async function listModels() {
  console.log("📋 Available Mistral Models:");
  console.log("=".repeat(50));

  try {
    const models = await mistral.listModels();

    models.forEach((model) => {
      console.log(`${model.name} (${model.id})`);
      console.log(`  Context: ${model.contextWindow.toLocaleString()} tokens`);
      console.log(
        `  Capabilities: ${Object.entries(model.capabilities)
          .filter(([_, enabled]) => enabled)
          .map(([cap]) => cap)
          .join(", ")}`
      );
      if (model.pricing) {
        console.log(
          `  Pricing: $${model.pricing.inputTokens}/M input, $${model.pricing.outputTokens}/M output`
        );
      }
      console.log();
    });
  } catch (error) {
    console.error("Error:", error);
  }
}

/**
 * Utility function to calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Main function to run all examples
 */
async function main() {
  console.log("🤖 Mistral Provider Examples");
  console.log("=============================\n");

  if (!process.env.MISTRAL_API_KEY) {
    console.log("⚠️  Please set your MISTRAL_API_KEY environment variable");
    console.log('Example: export MISTRAL_API_KEY="your-api-key-here"\n');
  }

  await basicCompletion();
  await streamingCompletion();
  await functionCalling();
  await embeddings();
  await visionCapabilities();
  await multiTurnConversation();
  await codeGeneration();
  await jsonMode();
  await listModels();

  console.log("✅ All examples completed!");
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  basicCompletion,
  streamingCompletion,
  functionCalling,
  embeddings,
  visionCapabilities,
  multiTurnConversation,
  codeGeneration,
  jsonMode,
  listModels,
};
