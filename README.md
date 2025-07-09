# Kepler AI SDK

A production-ready TypeScript library that provides unified access to multiple LLM providers using their official SDKs. This library wraps the native SDKs while maintaining a consistent interface across providers.

## Features

- 🔧 **Unified Interface**: Single API for multiple LLM providers
- ⚡ **Official SDKs**: Uses native provider SDKs under the hood
- 🎯 **TypeScript First**: Full type safety and excellent developer experience
- 📊 **Built-in Analytics**: Track usage, costs, and performance
- 🔄 **Streaming Support**: Real-time response streaming
- 🛠️ **Tool Support**: Function calling across providers
- 🖼️ **Multimodal**: Support for text, images, audio, video, and documents
- 💰 **Cost Tracking**: Built-in pricing calculator and usage analytics

## Supported Providers

| Provider           | Models                                 | Streaming | Tools | Vision | Audio | Embeddings |
| ------------------ | -------------------------------------- | --------- | ----- | ------ | ----- | ---------- |
| **OpenAI**         | GPT-4.1, o3, o4-mini, TTS etc          | ✅         | ✅     | ✅      | ✅     | ✅          |
| **Anthropic**      | Claude 4, Claude 3.5 etc               | ✅         | ✅     | ✅      | ❌     | ❌          |
| **Google Gemini**  | Gemini 2.5 Pro, Imagen, Gemini TTS etc | ✅         | ✅     | ✅      | ✅     | ✅          |
| **Mistral**        | Mistral Large, Mistral Embed etc       | ✅         | ✅     | ❌      | ❌     | ✅          |
| **Cohere**         | Command A, Command R+ etc              | ✅         | ✅     | ❌      | ❌     | ✅          |
| **OpenRouter**     | Access to 300+ models                  | ✅         | ✅     | ✅      | ❌     | ❌          |
| **GitHub Copilot** | GPT 4.1, Claude 4 Sonnet etc           | ✅         | ❌     | ❌      | ❌     | ❌          |

## Installation

```bash
# Using bun
bun add kepler-ai-sdk

# Using npm
npm install kepler-ai-sdk

# Using yarn
yarn add kepler-ai-sdk
```

### Peer Dependencies

You'll also need the official provider SDKs for the providers you want to use:

```bash
# For OpenAI
bun add openai

# For Anthropic  
bun add @anthropic-ai/sdk

# For Google Gemini
bun add @google/generative-ai

# For Mistral
bun add @mistralai/mistralai

# For Cohere
bun add cohere-ai
```

## Quick Start

```typescript
import { ModelManager, OpenAIProvider, AnthropicProvider, GeminiProvider } from 'kepler-ai-sdk';

// 1. Initialize the ModelManager
const modelManager = new ModelManager();

// 2. Add providers
if (process.env.OPENAI_API_KEY) {
  modelManager.addProvider(new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY }));
}
if (process.env.ANTHROPIC_API_KEY) {
  modelManager.addProvider(new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY }));
}
if (process.env.GEMINI_API_KEY) {
  modelManager.addProvider(new GeminiProvider({ apiKey: process.env.GEMINI_API_KEY }));
}

// 3. Generate a completion
async function generate() {
  const model = await modelManager.getModel('gpt-4o-mini');
  if (!model) throw new Error('Model not found');

  const provider = modelManager.getProvider(model.provider);
  if (!provider) throw new Error('Provider not found');

  const response = await provider.generateCompletion({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'user', content: 'Hello, world!' }
    ]
  });

  console.log(response.content);
}

generate();
```

## Core Concepts

### Providers

Provider adapters wrap the official SDKs and normalize their interfaces:

```typescript
import { OpenAIProvider, AnthropicProvider } from 'kepler-ai-sdk';

const openai = new OpenAIProvider({
  apiKey: 'your-api-key',
  organization: 'your-org-id', // optional
  baseURL: 'https://custom-proxy.com' // optional
});

const anthropic = new AnthropicProvider({
  apiKey: 'your-api-key',
  baseURL: 'https://custom-proxy.com' // optional
});
```

### Messages

All providers use the same message format:

```typescript
const messages = [
  { 
    role: 'system', 
    content: 'You are a helpful assistant.' 
  },
  { 
    role: 'user', 
    content: 'What is the capital of France?' 
  },
  { 
    role: 'assistant', 
    content: 'The capital of France is Paris.' 
  }
];
```

### Multimodal Messages

For images and other media:

```typescript
const messages = [
  {
    role: 'user',
    content: [
      { type: 'text', text: 'What do you see in this image?' },
      { 
        type: 'image', 
        imageUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
        mimeType: 'image/jpeg'
      }
    ]
  }
];
```

## Advanced Usage

### Streaming Completions

```typescript
for await (const chunk of openai.streamCompletion({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Tell me a story' }]
})) {
  if (chunk.delta) {
    process.stdout.write(chunk.delta);
  }
  
  if (chunk.finished) {
    console.log('\nDone!');
    console.log('Tokens used:', chunk.usage?.totalTokens);
  }
}
```

### Function Calling / Tools

```typescript
const response = await openai.generateCompletion({
  model: 'gpt-4o',
  messages: [
    { role: 'user', content: 'What\'s the weather in New York?' }
  ],
  tools: [
    {
      name: 'get_weather',
      description: 'Get current weather for a city',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'City name' },
          unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
        },
        required: ['city']
      }
    }
  ],
  toolChoice: 'auto'
});

if (response.toolCalls) {
  for (const call of response.toolCalls) {
    console.log(`Tool: ${call.name}`);
    console.log(`Args:`, call.arguments);
  }
}
```

### Model Management

```typescript
import { ModelManager } from 'kepler-ai-sdk';

const modelManager = new ModelManager();
modelManager.addProvider(openai);
modelManager.addProvider(anthropic);

// List all models
const models = await modelManager.listModels();

// Find models with specific capabilities
const visionModels = await modelManager.findModelsByCapability('vision');
const functionModels = await modelManager.findModelsByCapability('functionCalling');

// Get the cheapest model
const cheapest = await modelManager.getCheapestModel(['streaming']);

// Get the most capable model
const best = await modelManager.getMostCapableModel(['vision', 'functionCalling']);
```

### Cost Tracking

```typescript
import { PricingCalculator, UsageTracker } from 'kepler-ai-sdk';

const pricing = new PricingCalculator();
const usage = new UsageTracker();

// Generate completion
const response = await openai.generateCompletion({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }]
});

// Calculate cost
const cost = await pricing.calculateCost(response.usage, response.model);
console.log(`Cost: $${cost?.totalCost.toFixed(6)}`);

// Track usage
usage.trackUsage(response.model, response.usage, cost?.totalCost);

// Get statistics
const stats = usage.getUsage('gpt-4o');
if (stats && !Array.isArray(stats)) {
  console.log(`Total requests: ${stats.totalRequests}`);
  console.log(`Total cost: $${stats.totalCost.toFixed(4)}`);
}
```

### Error Handling

```typescript
import { LLMError } from 'kepler-ai-sdk';

try {
  const response = await openai.generateCompletion({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Hello!' }]
  });
} catch (error) {
  if (error instanceof LLMError) {
    console.log('Provider:', error.provider);
    console.log('Status:', error.statusCode);
    console.log('Retryable:', error.isRetryable());
    console.log('User message:', error.getUserMessage());
  }
}
```

### Image Generation

```typescript
// OpenAI DALL-E
const images = await openai.generateImage({
  prompt: 'A futuristic city at sunset',
  model: 'dall-e-3',
  size: '1024x1024',
  quality: 'hd',
  n: 1
});

console.log('Generated image URL:', images.images[0].url);
```

### Text-to-Speech

```typescript
// OpenAI TTS
const audio = await openai.generateAudio({
  text: 'Hello, this is a test of text-to-speech.',
  model: 'tts-1',
  voice: 'alloy',
  format: 'mp3'
});

// audio.audio is an ArrayBuffer containing the MP3 data
```

### Embeddings

```typescript
// OpenAI embeddings
const embeddings = await openai.generateEmbedding({
  model: 'text-embedding-3-small',
  input: ['Hello world', 'How are you?'],
  encodingFormat: 'float'
});

console.log('Embeddings:', embeddings.embeddings);
console.log('Dimensions:', embeddings.embeddings[0].length);
```

## Configuration

### Environment Variables

```bash
# Provider API Keys
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Optional: Organization IDs
OPENAI_ORG_ID=your_org_id
```

### Custom Base URLs

For proxies or custom endpoints:

```typescript
const openai = new OpenAIProvider({
  apiKey: 'your-key',
  baseURL: 'https://your-proxy.com/v1'
});

const anthropic = new AnthropicProvider({
  apiKey: 'your-key',
  baseURL: 'https://your-proxy.com'
});
```

## API Reference

### Core Interfaces

#### `CompletionRequest`
```typescript
interface CompletionRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  responseFormat?: ResponseFormat;
  stream?: boolean;
  stop?: string | string[];
}
```

#### `CompletionResponse`
```typescript
interface CompletionResponse {
  id: string;
  content: string;
  model: string;
  usage: TokenUsage;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  toolCalls?: ToolCall[];
  reasoning?: string;
  metadata?: Record<string, unknown>;
}
```

#### `ModelInfo`
```typescript
interface ModelInfo {
  id: string;
  provider: string;
  name: string;
  description?: string;
  contextWindow: number;
  maxOutputTokens?: number;
  capabilities: ModelCapabilities;
  pricing?: ModelPricing;
  createdAt?: Date;
  type?: string;
}
```

### Provider Methods

All providers implement the `ProviderAdapter` interface:

- `generateCompletion(request: CompletionRequest): Promise<CompletionResponse>`
- `streamCompletion(request: CompletionRequest): AsyncIterable<CompletionChunk>`
- `listModels(): Promise<ModelInfo[]>`
- `getModel(modelId: string): Promise<ModelInfo | null>`

Optional methods (if supported):
- `generateEmbedding?(request: EmbeddingRequest): Promise<EmbeddingResponse>`
- `generateImage?(request: ImageRequest): Promise<ImageResponse>`
- `generateAudio?(request: AudioRequest): Promise<AudioResponse>`

## Examples

Check out the `examples/` directory for complete working examples. The examples are numbered to provide a clear learning path:

- `01-basic-usage.ts`: Demonstrates fundamental features like initializing the `ModelManager`, listing models, and generating simple completions.
- `02-streaming.ts`: Shows how to handle streaming responses for real-time applications.
- `03-tool-usage.ts`: Covers how to define and use tools with supported models.
- `04-multimodality.ts`: Provides an example of sending images to vision-capable models.
- `05-embeddings.ts`: Explains how to generate text embeddings.
- `06-cost-tracking.ts`: Demonstrates how to use the `PricingCalculator` and `UsageTracker` to monitor API costs.
- `07-oauth-and-custom-providers.ts`: Covers advanced topics like setting up OAuth and creating custom provider adapters.

## Development

```bash
# Install dependencies
bun install

# Build the library
bun run build

# Run examples
bun run examples/01-basic-usage.ts
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- 📖 [Documentation](https://docs.kepler-ai.dev)
- 💬 [Discord Community](https://discord.gg/kepler-ai)
- 🐛 [Issue Tracker](https://github.com/kepler-ai/sdk/issues)
- 📧 [Email Support](mailto:support@kepler-ai.dev)
