import { CohereProvider } from "../src/providers/cohere";
import type {
  CompletionRequest,
  ToolDefinition,
} from "../src/core/interfaces";

async function main() {
  // Initialize Cohere provider
  const cohere = new CohereProvider({
    apiKey: process.env.COHERE_API_KEY || "your-api-key-here",
  });

  console.log("🤖 Cohere Provider Example\n");

  // 1. List available models
  console.log("📋 Available Cohere models:");
  const models = await cohere.listModels();
  models.forEach((model) => {
    console.log(
      `  - ${model.id}: ${model.name} (Context: ${model.contextWindow})`
    );
  });
  console.log();

  // 2. Basic completion
  console.log("💬 Basic completion:");
  try {
    const basicRequest: CompletionRequest = {
      model: "command-r",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "What are the benefits of renewable energy?" },
      ],
      temperature: 0.7,
      maxTokens: 200,
    };

    const response = await cohere.generateCompletion(basicRequest);
    console.log(`Response: ${response.content}`);
    console.log(`Usage: ${response.usage.totalTokens} tokens`);
    console.log();
  } catch (error) {
    console.error("Error in basic completion:", error);
  }

  // 3. Streaming completion
  console.log("🌊 Streaming completion:");
  try {
    const streamRequest: CompletionRequest = {
      model: "command-r",
      messages: [
        {
          role: "user",
          content: "Tell me a short story about a robot learning to paint.",
        },
      ],
      temperature: 0.8,
      maxTokens: 150,
    };

    console.log("Stream: ");
    for await (const chunk of cohere.streamCompletion(streamRequest)) {
      process.stdout.write(chunk.delta);
      if (chunk.finished) {
        console.log("\n");
        if (chunk.usage) {
          console.log(`Usage: ${chunk.usage.totalTokens} tokens`);
        }
      }
    }
    console.log();
  } catch (error) {
    console.error("Error in streaming:", error);
  }

  // 4. Function calling / Tools
  console.log("🔧 Function calling:");
  try {
    const tools: ToolDefinition[] = [
      {
        name: "get_weather",
        description: "Get the current weather for a location",
        parameters: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "The city and state/country",
            },
            unit: {
              type: "string",
              description: "Temperature unit (celsius or fahrenheit)",
            },
          },
          required: ["location"],
        },
      },
    ];

    const toolRequest: CompletionRequest = {
      model: "command-r-plus",
      messages: [
        { role: "user", content: "What's the weather like in Paris, France?" },
      ],
      tools,
      temperature: 0.3,
    };

    const toolResponse = await cohere.generateCompletion(toolRequest);
    console.log(`Response: ${toolResponse.content}`);

    if (toolResponse.toolCalls) {
      console.log("Tool calls:");
      toolResponse.toolCalls.forEach((call) => {
        console.log(`  - ${call.name}(${JSON.stringify(call.arguments)})`);
      });
    }
    console.log();
  } catch (error) {
    console.error("Error in function calling:", error);
  }

  // 5. Embeddings
  console.log("🎯 Embeddings:");
  try {
    const embeddingResponse = await cohere.generateEmbedding({
      model: "embed-english-v3.0",
      input: ["Hello world", "Natural language processing is fascinating"],
    });

    console.log(`Generated ${embeddingResponse.embeddings.length} embeddings`);
    embeddingResponse.embeddings.forEach((embedding, index) => {
      console.log(`  Embedding ${index + 1}: ${embedding.length} dimensions`);
    });
    console.log(`Usage: ${embeddingResponse.usage.totalTokens} tokens`);
    console.log();
  } catch (error) {
    console.error("Error in embeddings:", error);
  }

  // 6. Multi-turn conversation
  console.log("💭 Multi-turn conversation:");
  try {
    const conversationRequest: CompletionRequest = {
      model: "command-r",
      messages: [
        { role: "user", content: "I want to learn about machine learning." },
        {
          role: "assistant",
          content:
            "Machine learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed. What specific aspect would you like to explore?",
        },
        { role: "user", content: "Can you explain supervised learning?" },
      ],
      temperature: 0.5,
      maxTokens: 200,
    };

    const conversationResponse = await cohere.generateCompletion(
      conversationRequest
    );
    console.log(`Response: ${conversationResponse.content}`);
    console.log(`Usage: ${conversationResponse.usage.totalTokens} tokens`);
    console.log();
  } catch (error) {
    console.error("Error in conversation:", error);
  }

  console.log("✅ Cohere provider example completed!");
}

// Run the example
if (import.meta.main) {
  main().catch(console.error);
}
