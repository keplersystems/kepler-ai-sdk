# Unified LLM Provider Library for TypeScript (Kepler AI SDK)

A production-ready TypeScript library that provides unified access to multiple LLM providers using their official SDKs. This library wraps the native SDKs while maintaining a consistent interface across providers.

## Architecture Overview

The library uses official provider SDKs under the hood and provides a unified interface that abstracts provider differences while maintaining access to provider-specific capabilities. Each provider adapter wraps the official SDK and normalizes the interface.

## Provider SDKs Used

- **OpenAI**: `openai` (v5.7.0+)
- **Anthropic**: `@anthropic-ai/sdk` (latest)
- **Google Gemini**: `@google/genai` (latest unified SDK)
- **Mistral**: `@mistralai/mistralai` (v1.7.2+)
- **Cohere**: `cohere-ai` (v7.17.1+)
- **OpenRouter**: Compatible with OpenAI SDK + custom headers

## 1. Complete Provider Feature Matrix

### Core Text Generation Capabilities

| Provider       | Models                 | Context Window | Streaming | Tools | Images      | Video      | Audio       | Documents  | Embeddings |
| -------------- | ---------------------- | -------------- | --------- | ----- | ----------- | ---------- | ----------- | ---------- | ---------- |
| **OpenAI**     | GPT-4o, GPT-4, GPT-3.5 | 128K-200K      | ✓         | ✓     | ✓           | ✗          | ✓ (TTS/STT) | ✓ (Vision) | ✓          |
| **Anthropic**  | Claude 4, Claude 3.5   | 200K           | ✓         | ✓     | ✓           | ✗          | ✗           | ✓ (PDFs)   | ✗          |
| **Gemini**     | Gemini 2.5, 2.0, 1.5   | 1M-2M          | ✓         | ✓     | ✓           | ✓          | ✓           | ✓ (PDFs)   | ✓          |
| **Mistral**    | Large 2.1, Medium 3    | 32K-128K       | ✓         | ✓     | ✓ (Pixtral) | ✗          | ✗           | ✓ (OCR)    | ✓          |
| **Cohere**     | Command R+, Command R  | 128K           | ✓         | ✓     | ✗           | ✗          | ✗           | ✓          | ✓          |
| **OpenRouter** | 300+ models            | Varies         | ✓         | ✓     | ✓ (varies)  | ✓ (varies) | ✓ (varies)  | ✓ (varies) | ✓ (varies) |

### Output Format Support

| Provider       | Text | JSON/Structured | Images     | Audio      | Reasoning Traces      |
| -------------- | ---- | --------------- | ---------- | ---------- | --------------------- |
| **OpenAI**     | ✓    | ✓               | ✓ (DALL-E) | ✓ (TTS)    | ✗                     |
| **Anthropic**  | ✓    | ✓               | ✗          | ✗          | ✓ (Extended thinking) |
| **Gemini**     | ✓    | ✓               | ✓ (Imagen) | ✓ (TTS)    | ✓ (Thinking budgets)  |
| **Mistral**    | ✓    | ✓               | ✗          | ✗          | ✗                     |
| **Cohere**     | ✓    | ✓               | ✗          | ✗          | ✗                     |
| **OpenRouter** | ✓    | ✓ (varies)      | ✓ (varies) | ✓ (varies) | ✓ (varies)            |

## 2. Core Architecture

### TypeScript Interfaces

```typescript
/**
 * Represents a single message in a conversation
 * Supports both simple text and multimodal content
 */
interface Message {
  /** Role of the message sender */
  role: 'system' | 'user' | 'assistant' | 'tool';
  
  /** Message content - can be text or multimodal parts */
  content: string | ContentPart[];
  
  /** Optional name for the message sender */
  name?: string;
  
  /** ID of the tool call this message is responding to (for tool messages) */
  toolCallId?: string;
}

/**
 * Individual content part for multimodal messages
 * Supports text, images, videos, audio, and documents
 */
interface ContentPart {
  /** Type of content */
  type: 'text' | 'image' | 'video' | 'audio' | 'document';
  
  /** Text content (for text type) */
  text?: string;
  
  /** Image URL or base64 data (for image type) */
  imageUrl?: string;
  
  /** Video URL or base64 data (for video type) */
  videoUrl?: string;
  
  /** Audio URL or base64 data (for audio type) */
  audioUrl?: string;
  
  /** Document URL or base64 data (for document type) */
  documentUrl?: string;
  
  /** MIME type of the content */
  mimeType?: string;
}

/**
 * Request for generating a completion
 * Contains all parameters needed for LLM generation
 */
interface CompletionRequest {
  /** Model ID to use for generation */
  model: string;
  
  /** Array of messages forming the conversation */
  messages: Message[];
  
  /** Controls randomness (0.0 = deterministic, 1.0 = maximum randomness) */
  temperature?: number;
  
  /** Maximum number of tokens to generate */
  maxTokens?: number;
  
  /** Available tools the model can call */
  tools?: ToolDefinition[];
  
  /** How the model should decide when to use tools */
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  
  /** Format for the response (text, JSON, etc.) */
  responseFormat?: ResponseFormat;
  
  /** Whether to stream the response */
  stream?: boolean;
  
  /** Sequences where generation should stop */
  stop?: string | string[];
}

/**
 * Specifies the format of the model's response
 * Used for structured outputs and JSON mode
 */
interface ResponseFormat {
  /** Response format type */
  type: 'text' | 'json_object' | 'json_schema';
  
  /** JSON schema for structured outputs */
  jsonSchema?: object;
}

/**
 * Response from a completion request
 * Contains the generated content and metadata
 */
interface CompletionResponse {
  /** Unique identifier for this completion */
  id: string;
  
  /** Generated text content */
  content: string;
  
  /** Model used for generation */
  model: string;
  
  /** Token usage statistics */
  usage: TokenUsage;
  
  /** Reason why generation stopped */
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  
  /** Tool calls made by the model (if any) */
  toolCalls?: ToolCall[];
  
  /** Reasoning traces (if supported by model) */
  reasoning?: string;
  
  /** Additional provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Token usage statistics for a completion
 * Used for tracking costs and performance
 */
interface TokenUsage {
  /** Tokens used in the input prompt */
  promptTokens: number;
  
  /** Tokens generated in the completion */
  completionTokens: number;
  
  /** Total tokens used (prompt + completion) */
  totalTokens: number;
  
  /** Cached tokens (if supported by provider) */
  cachedTokens?: number;
  
  /** Reasoning tokens (for models with reasoning traces) */
  reasoningTokens?: number;
}

/**
 * Definition of a tool that models can call
 * Uses JSON Schema for parameter validation
 */
interface ToolDefinition {
  /** Unique name of the tool */
  name: string;
  
  /** Human-readable description of what the tool does */
  description: string;
  
  /** JSON Schema defining the tool's parameters */
  parameters: {
    type: 'object';
    properties: Record<string, JSONSchemaProperty>;
    required?: string[];
  };
}

/**
 * A tool call made by the model
 * Contains the tool name and parsed arguments
 */
interface ToolCall {
  /** Unique identifier for this tool call */
  id: string;
  
  /** Name of the tool to call */
  name: string;
  
  /** Parsed arguments for the tool call */
  arguments: Record<string, unknown>;
}

/**
 * Result of executing a tool
 * Contains the output or error information
 */
interface ToolResult {
  /** ID matching the original tool call */
  id: string;
  
  /** String content returned by the tool */
  content: string;
  
  /** Error message if tool execution failed */
  error?: string;
}

/**
 * Capabilities of a specific model
 * Note: This is model-specific, not provider-specific
 */
interface ModelCapabilities {
  /** Whether the model supports streaming responses */
  streaming: boolean;
  
  /** Whether the model supports function/tool calling */
  functionCalling: boolean;
  
  /** Whether the model can process images */
  vision: boolean;
  
  /** Whether the model can process audio */
  audio: boolean;
  
  /** Whether the model can generate embeddings */
  embeddings: boolean;
  
  /** Whether the model supports reasoning traces */
  reasoning: boolean;
  
  /** Whether the model can process video */
  video?: boolean;
  
  /** Whether the model can process documents (PDFs, etc.) */
  documents?: boolean;
}

/**
 * Information about a specific model
 * Contains metadata and capabilities
 */
interface ModelInfo {
  /** Unique model identifier */
  id: string;
  
  /** Provider that hosts this model */
  provider: string;
  
  /** Human-readable model name */
  name: string;
  
  /** Optional description of the model */
  description?: string;
  
  /** Maximum context window size in tokens */
  contextWindow: number;
  
  /** Maximum tokens that can be generated */
  maxOutputTokens?: number;
  
  /** What this model can do */
  capabilities: ModelCapabilities;
  
  /** Pricing information (if available) */
  pricing?: ModelPricing;
  
  /** When the model was created/released */
  createdAt?: Date;
  
  /** Model type (e.g., "model", "fine-tuned") */
  type?: string;
}

/**
 * Pricing information for a model
 * All prices in USD per million tokens
 */
interface ModelPricing {
  /** Cost per million input tokens */
  inputTokens: number;
  
  /** Cost per million output tokens */
  outputTokens: number;
  
  /** Cost per million cached tokens (if supported) */
  cachedTokens?: number;
  
  /** Cost per million reasoning tokens (if supported) */
  reasoningTokens?: number;
}
```

### Provider Adapter Interface

```typescript
/**
 * Interface that all provider adapters must implement
 * Provides a unified way to interact with different LLM providers
 */
interface ProviderAdapter {
  /** Unique name identifying this provider */
  readonly name: string;
  
  /**
   * Generate a completion using this provider
   * @param request - The completion request parameters
   * @returns Promise resolving to the completion response
   * @throws LLMError if generation fails
   */
  generateCompletion(request: CompletionRequest): Promise<CompletionResponse>;
  
  /**
   * Generate a streaming completion using this provider
   * @param request - The completion request parameters
   * @returns AsyncIterable of completion chunks
   * @throws LLMError if streaming fails
   */
  streamCompletion(request: CompletionRequest): AsyncIterable<CompletionChunk>;
  
  /**
   * List all available models from this provider
   * @returns Promise resolving to array of model information
   * @throws LLMError if fetching models fails
   */
  listModels(): Promise<ModelInfo[]>;
  
  /**
   * Get information about a specific model
   * @param modelId - The model identifier
   * @returns Promise resolving to model info or null if not found
   */
  getModel(modelId: string): Promise<ModelInfo | null>;
  
  /**
   * Generate embeddings (if supported by provider)
   * @param request - The embedding request parameters
   * @returns Promise resolving to embeddings response
   * @throws LLMError if embeddings not supported or generation fails
   */
  generateEmbedding?(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  
  /**
   * Generate images (if supported by provider)
   * @param request - The image generation request parameters
   * @returns Promise resolving to generated images
   * @throws LLMError if image generation not supported or fails
   */
  generateImage?(request: ImageRequest): Promise<ImageResponse>;
  
  /**
   * Generate audio (if supported by provider)
   * @param request - The audio generation request parameters
   * @returns Promise resolving to generated audio
   * @throws LLMError if audio generation not supported or fails
   */
  generateAudio?(request: AudioRequest): Promise<AudioResponse>;
}

/**
 * A chunk of a streaming completion response
 * Contains partial content and metadata
 */
interface CompletionChunk {
  /** Unique identifier for the completion */
  id: string;
  
  /** The incremental content delta */
  delta: string;
  
  /** Whether this is the final chunk */
  finished: boolean;
  
  /** Partial tool calls (if any) */
  toolCalls?: Partial<ToolCall>[];
  
  /** Usage information (usually only in final chunk) */
  usage?: TokenUsage;
}
```

## 3. Provider Implementations

### OpenAI Provider

```typescript
import OpenAI from 'openai';

/**
 * Provider adapter for OpenAI's API
 * Supports GPT models, DALL-E, Whisper, and embeddings
 */
class OpenAIProvider implements ProviderAdapter {
  readonly name = 'openai';
  
  /** OpenAI SDK client instance */
  private client: OpenAI;

  /**
   * Create a new OpenAI provider instance
   * @param config - Configuration options for the OpenAI client
   */
  constructor(config: {
    /** OpenAI API key */
    apiKey: string;
    
    /** Custom base URL (for proxies or local instances) */
    baseURL?: string;
    
    /** OpenAI organization ID */
    organization?: string;
  }) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      organization: config.organization
    });
  }

  /**
   * Generate a completion using OpenAI's chat completions API
   */
  async generateCompletion(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: request.model,
        messages: this.convertMessages(request.messages),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        tools: request.tools ? this.convertTools(request.tools) : undefined,
        tool_choice: this.convertToolChoice(request.toolChoice),
        response_format: this.convertResponseFormat(request.responseFormat),
        stream: false,
        stop: request.stop
      });

      return this.convertResponse(response);
    } catch (error) {
      throw this.handleError(error, 'completion generation');
    }
  }

  /**
   * Generate a streaming completion using OpenAI's streaming API
   */
  async *streamCompletion(request: CompletionRequest): AsyncIterable<CompletionChunk> {
    try {
      const stream = await this.client.chat.completions.create({
        ...this.prepareRequest(request),
        stream: true
      });

      for await (const chunk of stream) {
        yield this.convertChunk(chunk);
      }
    } catch (error) {
      throw this.handleError(error, 'streaming completion');
    }
  }

  /**
   * List all available OpenAI models
   * Filters to only include chat-capable models
   */
  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.client.models.list();
      return response.data
        .filter(model => model.id.startsWith('gpt-') || model.id.startsWith('o1-'))
        .map(model => this.convertModelInfo(model));
    } catch (error) {
      throw this.handleError(error, 'listing models');
    }
  }

  /**
   * Get information about a specific OpenAI model
   */
  async getModel(modelId: string): Promise<ModelInfo | null> {
    try {
      const model = await this.client.models.retrieve(modelId);
      return this.convertModelInfo(model);
    } catch (error) {
      // Return null if model not found, throw for other errors
      if (error instanceof OpenAI.NotFoundError) {
        return null;
      }
      throw this.handleError(error, 'retrieving model');
    }
  }

  /**
   * Generate images using DALL-E
   */
  async generateImage(request: ImageRequest): Promise<ImageResponse> {
    try {
      const response = await this.client.images.generate({
        model: request.model || 'dall-e-3',
        prompt: request.prompt,
        size: request.size,
        quality: request.quality,
        n: request.n
      });

      return {
        images: response.data.map(img => ({
          url: img.url!,
          revisedPrompt: img.revised_prompt
        }))
      };
    } catch (error) {
      throw this.handleError(error, 'image generation');
    }
  }

  /**
   * Generate audio using TTS models
   */
  async generateAudio(request: AudioRequest): Promise<AudioResponse> {
    try {
      const response = await this.client.audio.speech.create({
        model: request.model || 'tts-1',
        voice: request.voice || 'alloy',
        input: request.text,
        response_format: request.format || 'mp3'
      });

      return {
        audio: await response.arrayBuffer()
      };
    } catch (error) {
      throw this.handleError(error, 'audio generation');
    }
  }

  /**
   * Generate embeddings using OpenAI's embedding models
   */
  async generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    try {
      const response = await this.client.embeddings.create({
        model: request.model || 'text-embedding-3-small',
        input: request.input,
        encoding_format: 'float'
      });

      return {
        embeddings: response.data.map(item => item.embedding),
        usage: {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: 0,
          totalTokens: response.usage.total_tokens
        }
      };
    } catch (error) {
      throw this.handleError(error, 'embedding generation');
    }
  }

  /**
   * Convert unified messages to OpenAI format
   * Handles multimodal content and tool messages
   */
  private convertMessages(messages: Message[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map(msg => {
      // Handle tool response messages
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          content: msg.content as string,
          tool_call_id: msg.toolCallId!
        };
      }

      // Handle simple text messages
      if (typeof msg.content === 'string') {
        return {
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content
        };
      }

      // Handle multimodal content
      const content = msg.content.map(part => {
        switch (part.type) {
          case 'text':
            return { type: 'text', text: part.text! };
          case 'image':
            return { 
              type: 'image_url', 
              image_url: { url: part.imageUrl! } 
            };
          default:
            throw new LLMError(`OpenAI does not support content type: ${part.type}`);
        }
      });

      return {
        role: msg.role as 'user' | 'assistant',
        content
      };
    });
  }

  /**
   * Convert unified tool definitions to OpenAI format
   */
  private convertTools(tools: ToolDefinition[]): OpenAI.Chat.ChatCompletionTool[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }

  /**
   * Convert unified tool choice to OpenAI format
   */
  private convertToolChoice(choice?: CompletionRequest['toolChoice']): any {
    if (!choice || choice === 'auto') return 'auto';
    if (choice === 'none') return 'none';
    if (choice === 'required') return 'required';
    if (typeof choice === 'object') {
      return { type: 'function', function: { name: choice.function.name } };
    }
    return 'auto';
  }

  /**
   * Convert unified response format to OpenAI format
   */
  private convertResponseFormat(format?: ResponseFormat): any {
    if (!format) return undefined;
    
    switch (format.type) {
      case 'json_object':
        return { type: 'json_object' };
      case 'json_schema':
        return { 
          type: 'json_schema', 
          json_schema: format.jsonSchema 
        };
      default:
        return undefined;
    }
  }

  /**
   * Convert OpenAI response to unified format
   */
  private convertResponse(response: OpenAI.Chat.ChatCompletion): CompletionResponse {
    const choice = response.choices[0];
    const message = choice.message;

    return {
      id: response.id,
      content: message.content || '',
      model: response.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      },
      finishReason: this.convertFinishReason(choice.finish_reason),
      toolCalls: message.tool_calls?.map(call => ({
        id: call.id,
        name: call.function.name,
        arguments: JSON.parse(call.function.arguments)
      }))
    };
  }

  /**
   * Convert OpenAI streaming chunk to unified format
   */
  private convertChunk(chunk: OpenAI.Chat.Completions.ChatCompletionChunk): CompletionChunk {
    const choice = chunk.choices[0];
    const delta = choice?.delta;

    return {
      id: chunk.id,
      delta: delta?.content || '',
      finished: choice?.finish_reason !== null,
      usage: chunk.usage ? {
        promptTokens: chunk.usage.prompt_tokens || 0,
        completionTokens: chunk.usage.completion_tokens || 0,
        totalTokens: chunk.usage.total_tokens || 0
      } : undefined
    };
  }

  /**
   * Convert OpenAI finish reason to unified format
   */
  private convertFinishReason(reason: string | null): CompletionResponse['finishReason'] {
    switch (reason) {
      case 'stop': return 'stop';
      case 'length': return 'length';
      case 'tool_calls': return 'tool_calls';
      case 'content_filter': return 'content_filter';
      default: return 'stop';
    }
  }

  /**
   * Convert OpenAI model to unified format
   */
  private convertModelInfo(model: OpenAI.Model): ModelInfo {
    return {
      id: model.id,
      provider: 'openai',
      name: model.id,
      contextWindow: this.getContextWindow(model.id),
      capabilities: this.getModelCapabilities(model.id),
      pricing: this.getModelPricing(model.id),
      createdAt: new Date(model.created * 1000)
    };
  }

  /**
   * Get context window size for OpenAI models
   * Based on known model specifications
   */
  private getContextWindow(modelId: string): number {
    // GPT-4o models
    if (modelId.includes('gpt-4o')) return 128000;
    
    // GPT-4 Turbo models
    if (modelId.includes('gpt-4-turbo')) return 128000;
    
    // Regular GPT-4 models
    if (modelId.includes('gpt-4')) return 8192;
    
    // GPT-3.5 Turbo models
    if (modelId.includes('gpt-3.5-turbo')) return 16385;
    
    // o1 models
    if (modelId.includes('o1-')) return 200000;
    
    // Default fallback
    return 4096;
  }

  /**
   * Get capabilities for OpenAI models
   * Based on known model specifications
   */
  private getModelCapabilities(modelId: string): ModelCapabilities {
    const hasVision = modelId.includes('gpt-4o') || 
                     modelId.includes('gpt-4-turbo') ||
                     modelId.includes('gpt-4-vision');
    
    const hasFunctionCalling = !modelId.includes('instruct') && 
                              !modelId.includes('o1-'); // o1 models don't support function calling
    
    const hasReasoning = modelId.includes('o1-'); // o1 models have reasoning

    return {
      streaming: true,
      functionCalling: hasFunctionCalling,
      vision: hasVision,
      audio: false, // Only specific audio models support audio
      embeddings: false, // Only embedding models support embeddings
      reasoning: hasReasoning,
      video: false, // OpenAI doesn't support video input yet
      documents: hasVision // Vision models can process document images
    };
  }

  /**
   * Get pricing for OpenAI models
   * Pricing data should be updated regularly
   */
  private getModelPricing(modelId: string): ModelPricing | undefined {
    const pricing: Record<string, ModelPricing> = {
      'gpt-4o': { inputTokens: 2.50, outputTokens: 10.00 },
      'gpt-4o-mini': { inputTokens: 0.15, outputTokens: 0.60 },
      'gpt-4-turbo': { inputTokens: 10.00, outputTokens: 30.00 },
      'gpt-4': { inputTokens: 30.00, outputTokens: 60.00 },
      'gpt-3.5-turbo': { inputTokens: 0.50, outputTokens: 1.50 },
      'o1-preview': { inputTokens: 15.00, outputTokens: 60.00 },
      'o1-mini': { inputTokens: 3.00, outputTokens: 12.00 }
    };

    return pricing[modelId];
  }

  /**
   * Handle OpenAI API errors and convert to LLMError
   */
  private handleError(error: unknown, operation: string): never {
    if (error instanceof OpenAI.APIError) {
      throw new LLMError(
        `OpenAI ${operation} failed: ${error.message}`,
        error,
        {
          provider: 'openai',
          statusCode: error.status,
          type: error.type
        }
      );
    }
    
    if (error instanceof Error) {
      throw new LLMError(`OpenAI ${operation} failed: ${error.message}`, error);
    }
    
    throw new LLMError(`OpenAI ${operation} failed with unknown error`);
  }

  /**
   * Prepare request for streaming (helper method)
   */
  private prepareRequest(request: CompletionRequest) {
    return {
      model: request.model,
      messages: this.convertMessages(request.messages),
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      tools: request.tools ? this.convertTools(request.tools) : undefined,
      tool_choice: this.convertToolChoice(request.toolChoice),
      stop: request.stop
    };
  }
}
```

### Anthropic Provider

```typescript
import Anthropic from '@anthropic-ai/sdk';

/**
 * Provider adapter for Anthropic's Claude API
 * Supports Claude models with advanced reasoning capabilities
 */
class AnthropicProvider implements ProviderAdapter {
  readonly name = 'anthropic';
  
  /** Anthropic SDK client instance */
  private client: Anthropic;

  /**
   * Create a new Anthropic provider instance
   * @param config - Configuration options for the Anthropic client
   */
  constructor(config: {
    /** Anthropic API key */
    apiKey: string;
    
    /** Custom base URL (for proxies) */
    baseURL?: string;
  }) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL
    });
  }

  /**
   * Generate a completion using Anthropic's messages API
   */
  async generateCompletion(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const { system, messages } = this.extractSystemMessage(request.messages);
      
      const response = await this.client.messages.create({
        model: request.model,
        system,
        messages: this.convertMessages(messages),
        temperature: request.temperature,
        max_tokens: request.maxTokens || 1024, // Anthropic requires max_tokens
        tools: request.tools ? this.convertTools(request.tools) : undefined,
        tool_choice: this.convertToolChoice(request.toolChoice),
        stream: false,
        stop_sequences: Array.isArray(request.stop) ? request.stop : request.stop ? [request.stop] : undefined
      });

      return this.convertResponse(response);
    } catch (error) {
      throw this.handleError(error, 'completion generation');
    }
  }

  /**
   * Generate a streaming completion using Anthropic's streaming API
   */
  async *streamCompletion(request: CompletionRequest): AsyncIterable<CompletionChunk> {
    try {
      const { system, messages } = this.extractSystemMessage(request.messages);
      
      const stream = await this.client.messages.create({
        model: request.model,
        system,
        messages: this.convertMessages(messages),
        temperature: request.temperature,
        max_tokens: request.maxTokens || 1024,
        tools: request.tools ? this.convertTools(request.tools) : undefined,
        tool_choice: this.convertToolChoice(request.toolChoice),
        stream: true
      });

      for await (const chunk of stream) {
        yield this.convertChunk(chunk);
      }
    } catch (error) {
      throw this.handleError(error, 'streaming completion');
    }
  }

  /**
   * List all available Anthropic models using the models API
   */
  async listModels(): Promise<ModelInfo[]> {
    try {
      // Use the models API endpoint
      const response = await this.client.models.list();
      return response.data.map(model => this.convertAnthropicModelInfo(model));
    } catch (error) {
      // If models API fails, fall back to known models
      console.warn('Anthropic models API failed, using fallback list:', error);
      return this.getFallbackModels();
    }
  }

  /**
   * Get information about a specific Anthropic model
   */
  async getModel(modelId: string): Promise<ModelInfo | null> {
    try {
      // Try to get from models API first
      const models = await this.listModels();
      return models.find(m => m.id === modelId) || null;
    } catch (error) {
      // Fall back to checking against known models
      const fallbackModels = this.getFallbackModels();
      return fallbackModels.find(m => m.id === modelId) || null;
    }
  }

  /**
   * Extract system message from messages array
   * Anthropic requires system messages to be separate from the conversation
   */
  private extractSystemMessage(messages: Message[]): { system?: string; messages: Message[] } {
    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');
    
    const system = systemMessages.length > 0 
      ? systemMessages.map(m => m.content as string).join('\n')
      : undefined;

    return { system, messages: nonSystemMessages };
  }

  /**
   * Convert unified messages to Anthropic format
   */
  private convertMessages(messages: Message[]): Anthropic.MessageParam[] {
    return messages.map(msg => {
      // Handle tool result messages
      if (msg.role === 'tool') {
        return {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: msg.toolCallId!,
            content: msg.content as string
          }]
        };
      }

      // Handle simple text messages
      if (typeof msg.content === 'string') {
        return {
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        };
      }

      // Handle multimodal content
      const content = msg.content.map(part => {
        switch (part.type) {
          case 'text':
            return { type: 'text', text: part.text! };
          case 'image':
            return {
              type: 'image',
              source: {
                type: 'base64',
                media_type: part.mimeType as any || 'image/jpeg',
                data: part.imageUrl!.replace(/^data:image\/[^;]+;base64,/, '')
              }
            };
          case 'document':
            return {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: part.documentUrl!.replace(/^data:application\/pdf;base64,/, '')
              }
            };
          default:
            throw new LLMError(`Anthropic does not support content type: ${part.type}`);
        }
      });

      return {
        role: msg.role as 'user' | 'assistant',
        content
      };
    });
  }

  /**
   * Convert unified tool definitions to Anthropic format
   */
  private convertTools(tools: ToolDefinition[]): Anthropic.Tool[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters
    }));
  }

  /**
   * Convert unified tool choice to Anthropic format
   */
  private convertToolChoice(choice?: CompletionRequest['toolChoice']): any {
    if (!choice || choice === 'auto') return undefined;
    if (choice === 'none') return { type: 'none' };
    if (choice === 'required') return { type: 'any' };
    if (typeof choice === 'object') {
      return { type: 'tool', name: choice.function.name };
    }
    return undefined;
  }

  /**
   * Convert Anthropic response to unified format
   */
  private convertResponse(response: Anthropic.Message): CompletionResponse {
    const textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');

    const toolCalls = response.content
      .filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')
      .map(block => ({
        id: block.id,
        name: block.name,
        arguments: block.input
      }));

    return {
      id: response.id,
      content: textContent,
      model: response.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      },
      finishReason: this.convertFinishReason(response.stop_reason),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    };
  }

  /**
   * Convert Anthropic streaming chunk to unified format
   */
  private convertChunk(chunk: any): CompletionChunk {
    // Handle different chunk types from Anthropic streaming
    if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
      return {
        id: 'streaming',
        delta: chunk.delta.text,
        finished: false
      };
    }
    
    if (chunk.type === 'message_stop') {
      return {
        id: 'streaming',
        delta: '',
        finished: true,
        usage: chunk.usage ? {
          promptTokens: chunk.usage.input_tokens,
          completionTokens: chunk.usage.output_tokens,
          totalTokens: chunk.usage.input_tokens + chunk.usage.output_tokens
        } : undefined
      };
    }

    return {
      id: 'streaming',
      delta: '',
      finished: false
    };
  }

  /**
   * Convert Anthropic finish reason to unified format
   */
  private convertFinishReason(reason: string | null): CompletionResponse['finishReason'] {
    switch (reason) {
      case 'end_turn': return 'stop';
      case 'max_tokens': return 'length';
      case 'tool_use': return 'tool_calls';
      case 'stop_sequence': return 'stop';
      default: return 'stop';
    }
  }

  /**
   * Convert Anthropic model info to unified format
   */
  private convertAnthropicModelInfo(model: any): ModelInfo {
    return {
      id: model.id,
      provider: 'anthropic',
      name: model.display_name || model.id,
      description: model.description,
      contextWindow: this.getAnthropicContextWindow(model.id),
      capabilities: this.getAnthropicModelCapabilities(model.id),
      pricing: this.getAnthropicModelPricing(model.id),
      createdAt: model.created_at ? new Date(model.created_at) : undefined,
      type: model.type
    };
  }

  /**
   * Get fallback models if API fails
   */
  private getFallbackModels(): ModelInfo[] {
    return [
      {
        id: 'claude-sonnet-4-20250514',
        provider: 'anthropic',
        name: 'Claude Sonnet 4',
        contextWindow: 200000,
        capabilities: {
          streaming: true,
          functionCalling: true,
          vision: true,
          audio: false,
          embeddings: false,
          reasoning: false,
          documents: true
        },
        pricing: { inputTokens: 3.00, outputTokens: 15.00 }
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        provider: 'anthropic',
        name: 'Claude 3.5 Sonnet',
        contextWindow: 200000,
        capabilities: {
          streaming: true,
          functionCalling: true,
          vision: true,
          audio: false,
          embeddings: false,
          reasoning: false,
          documents: true
        },
        pricing: { inputTokens: 3.00, outputTokens: 15.00 }
      },
      {
        id: 'claude-3-opus-20240229',
        provider: 'anthropic',
        name: 'Claude 3 Opus',
        contextWindow: 200000,
        capabilities: {
          streaming: true,
          functionCalling: true,
          vision: true,
          audio: false,
          embeddings: false,
          reasoning: false,
          documents: true
        },
        pricing: { inputTokens: 15.00, outputTokens: 75.00 }
      }
    ];
  }

  /**
   * Get context window for Anthropic models
   */
  private getAnthropicContextWindow(modelId: string): number {
    // Most Claude models have 200K context
    if (modelId.includes('claude-')) return 200000;
    return 200000; // Default for Anthropic models
  }

  /**
   * Get capabilities for Anthropic models
   */
  private getAnthropicModelCapabilities(modelId: string): ModelCapabilities {
    const hasVision = modelId.includes('sonnet') || modelId.includes('opus');
    const hasDocuments = true; // Most Claude models support PDF processing
    const hasReasoning = modelId.includes('thinking'); // Future reasoning models

    return {
      streaming: true,
      functionCalling: true,
      vision: hasVision,
      audio: false, // Anthropic doesn't support audio yet
      embeddings: false, // Anthropic doesn't provide embeddings
      reasoning: hasReasoning,
      video: false, // No video support yet
      documents: hasDocuments
    };
  }

  /**
   * Get pricing for Anthropic models
   */
  private getAnthropicModelPricing(modelId: string): ModelPricing | undefined {
    const pricing: Record<string, ModelPricing> = {
      'claude-sonnet-4-20250514': { inputTokens: 3.00, outputTokens: 15.00 },
      'claude-3-5-sonnet-20241022': { inputTokens: 3.00, outputTokens: 15.00 },
      'claude-3-opus-20240229': { inputTokens: 15.00, outputTokens: 75.00 },
      'claude-3-sonnet-20240229': { inputTokens: 3.00, outputTokens: 15.00 },
      'claude-3-haiku-20240307': { inputTokens: 0.25, outputTokens: 1.25 }
    };

    return pricing[modelId];
  }

  /**
   * Handle Anthropic API errors and convert to LLMError
   */
  private handleError(error: unknown, operation: string): never {
    if (error instanceof Anthropic.APIError) {
      throw new LLMError(
        `Anthropic ${operation} failed: ${error.message}`,
        error,
        {
          provider: 'anthropic',
          statusCode: error.status,
          type: error.type
        }
      );
    }
    
    if (error instanceof Error) {
      throw new LLMError(`Anthropic ${operation} failed: ${error.message}`, error);
    }
    
    throw new LLMError(`Anthropic ${operation} failed with unknown error`);
  }
}
```

## 4. Model Management

### Dynamic Model Fetching with Caching

```typescript
/**
 * Manages models across all providers with intelligent caching
 * Handles model discovery, capability detection, and metadata management
 */
class ModelManager {
  /** Map of provider name to provider adapter */
  private providers = new Map<string, ProviderAdapter>();
  
  /** Cache of models by provider */
  private modelCache = new Map<string, ModelInfo[]>();
  
  /** Cache expiry times by provider */
  private cacheExpiry = new Map<string, number>();
  
  /** Cache TTL - how long to keep models cached */
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Add a provider to the model manager
   * @param provider - The provider adapter to add
   */
  addProvider(provider: ProviderAdapter): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * List all available models, optionally filtered by provider
   * @param provider - Optional provider name to filter by
   * @param forceRefresh - Whether to bypass cache and fetch fresh data
   * @returns Promise resolving to array of model information
   */
  async listModels(provider?: string, forceRefresh = false): Promise<ModelInfo[]> {
    if (provider) {
      return this.getProviderModels(provider, forceRefresh);
    }

    // Get models from all providers
    const allModels: ModelInfo[] = [];
    for (const providerName of this.providers.keys()) {
      try {
        const models = await this.getProviderModels(providerName, forceRefresh);
        allModels.push(...models);
      } catch (error) {
        console.warn(`Failed to fetch models from ${providerName}:`, error);
        // Continue with other providers
      }
    }

    return allModels;
  }

  /**
   * Get information about a specific model
   * @param modelId - The model identifier
   * @returns Promise resolving to model info or null if not found
   */
  async getModel(modelId: string): Promise<ModelInfo | null> {
    // Try each provider until we find the model
    for (const provider of this.providers.values()) {
      try {
        const model = await provider.getModel(modelId);
        if (model) return model;
      } catch (error) {
        // Continue to next provider
        console.debug(`Provider ${provider.name} failed to get model ${modelId}:`, error);
      }
    }

    return null;
  }

  /**
   * Find models that support a specific capability
   * @param capability - The capability to filter by
   * @returns Promise resolving to models with the specified capability
   */
  async findModelsByCapability(capability: keyof ModelCapabilities): Promise<ModelInfo[]> {
    const allModels = await this.listModels();
    return allModels.filter(model => model.capabilities[capability]);
  }

  /**
   * Find models that support multiple capabilities
   * @param capabilities - Array of capabilities that must all be supported
   * @returns Promise resolving to models with all specified capabilities
   */
  async findModelsByCapabilities(capabilities: (keyof ModelCapabilities)[]): Promise<ModelInfo[]> {
    const allModels = await this.listModels();
    return allModels.filter(model => 
      capabilities.every(capability => model.capabilities[capability])
    );
  }

  /**
   * Get models from a specific provider
   * @param providerName - Name of the provider
   * @returns Promise resolving to models from that provider
   */
  async getModelsByProvider(providerName: string): Promise<ModelInfo[]> {
    return this.getProviderModels(providerName);
  }

  /**
   * Get cheapest model that supports specific capabilities
   * @param capabilities - Required capabilities
   * @returns Promise resolving to the cheapest compatible model or null
   */
  async getCheapestModel(capabilities: (keyof ModelCapabilities)[] = []): Promise<ModelInfo | null> {
    const compatibleModels = await this.findModelsByCapabilities(capabilities);
    
    // Filter models with pricing information
    const modelsWithPricing = compatibleModels.filter(model => model.pricing);
    
    if (modelsWithPricing.length === 0) return null;

    // Sort by input token cost (cheapest first)
    return modelsWithPricing.sort((a, b) => 
      a.pricing!.inputTokens - b.pricing!.inputTokens
    )[0];
  }

  /**
   * Get most capable model for a specific use case
   * @param preferredCapabilities - Capabilities to prioritize
   * @returns Promise resolving to the most capable model
   */
  async getMostCapableModel(preferredCapabilities: (keyof ModelCapabilities)[] = []): Promise<ModelInfo | null> {
    const allModels = await this.listModels();
    
    if (allModels.length === 0) return null;

    // Score models based on capabilities
    const scoredModels = allModels.map(model => {
      let score = 0;
      
      // Add points for each supported capability
      for (const capability of preferredCapabilities) {
        if (model.capabilities[capability]) score += 2;
      }
      
      // Add points for context window (larger is better)
      score += Math.log(model.contextWindow) / 10;
      
      return { model, score };
    });

    // Return model with highest score
    return scoredModels.sort((a, b) => b.score - a.score)[0].model;
  }

  /**
   * Clear the model cache for specific provider or all providers
   * @param provider - Optional provider name to clear cache for
   */
  clearCache(provider?: string): void {
    if (provider) {
      this.modelCache.delete(provider);
      this.cacheExpiry.delete(provider);
    } else {
      this.modelCache.clear();
      this.cacheExpiry.clear();
    }
  }

  /**
   * Get cache statistics
   * @returns Object containing cache statistics
   */
  getCacheStats(): {
    cachedProviders: string[];
    totalModels: number;
    cacheHitRatio: number;
  } {
    const cachedProviders = Array.from(this.modelCache.keys());
    const totalModels = Array.from(this.modelCache.values())
      .reduce((total, models) => total + models.length, 0);
    
    return {
      cachedProviders,
      totalModels,
      cacheHitRatio: 0 // Would need hit/miss tracking for accurate ratio
    };
  }

  /**
   * Get models from a specific provider with caching
   * @param providerName - Name of the provider
   * @param forceRefresh - Whether to bypass cache
   * @returns Promise resolving to models from that provider
   */
  private async getProviderModels(providerName: string, forceRefresh = false): Promise<ModelInfo[]> {
    const now = Date.now();
    const cached = this.modelCache.get(providerName);
    const expiry = this.cacheExpiry.get(providerName) || 0;

    // Return cached models if valid and not forcing refresh
    if (!forceRefresh && cached && now < expiry) {
      return cached;
    }

    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new LLMError(`Provider ${providerName} not found`);
    }

    try {
      console.debug(`Fetching models from ${providerName}...`);
      const models = await provider.listModels();
      
      // Cache the results
      this.modelCache.set(providerName, models);
      this.cacheExpiry.set(providerName, now + this.CACHE_TTL);
      
      console.debug(`Cached ${models.length} models from ${providerName}`);
      return models;
    } catch (error) {
      console.error(`Failed to fetch models from ${providerName}:`, error);
      
      // Return cached models if available, even if expired
      if (cached) {
        console.warn(`Using stale cache for ${providerName} due to fetch failure`);
        return cached;
      }
      
      // Re-throw if no cache available
      throw error;
    }
  }
}
```

## 5. Pricing & Usage

### Simple Pricing Calculator with Manual Data

```typescript
/**
 * Calculates costs for LLM usage across different providers
 * Maintains pricing data that should be updated regularly
 */
class PricingCalculator {
  /** Map of model ID to pricing information */
  private pricingData: Map<string, ModelPricing> = new Map();

  constructor() {
    this.loadPricingData();
  }

  /**
   * Calculate cost for a completed request
   * @param usage - Token usage from the request
   * @param modelId - Model that was used
   * @returns Promise resolving to cost breakdown or null if pricing unavailable
   */
  async calculateCost(usage: TokenUsage, modelId: string): Promise<CostBreakdown | null> {
    const pricing = this.pricingData.get(modelId);
    if (!pricing) {
      console.warn(`No pricing data available for model: ${modelId}`);
      return null;
    }

    // Calculate costs per token type
    const inputCost = (usage.promptTokens / 1_000_000) * pricing.inputTokens;
    const outputCost = (usage.completionTokens / 1_000_000) * pricing.outputTokens;
    
    let cachedCost = 0;
    if (usage.cachedTokens && pricing.cachedTokens) {
      cachedCost = (usage.cachedTokens / 1_000_000) * pricing.cachedTokens;
    }
    
    let reasoningCost = 0;
    if (usage.reasoningTokens && pricing.reasoningTokens) {
      reasoningCost = (usage.reasoningTokens / 1_000_000) * pricing.reasoningTokens;
    }

    return {
      inputCost,
      outputCost,
      cachedCost,
      reasoningCost,
      totalCost: inputCost + outputCost + cachedCost + reasoningCost,
      currency: 'USD',
      modelId,
      usage
    };
  }

  /**
   * Estimate cost for a request before sending it
   * @param request - The completion request
   * @param estimatedOutputTokens - Estimated output length
   * @returns Promise resolving to estimated cost or null
   */
  async estimateCost(
    request: CompletionRequest, 
    estimatedOutputTokens: number = 1000
  ): Promise<number | null> {
    const pricing = this.pricingData.get(request.model);
    if (!pricing) return null;

    // Rough token estimation (4 characters per token)
    const inputTokens = this.estimateInputTokens(request);
    const outputTokens = request.maxTokens || estimatedOutputTokens;

    const inputCost = (inputTokens / 1_000_000) * pricing.inputTokens;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputTokens;

    return inputCost + outputCost;
  }

  /**
   * Update pricing for a specific model
   * @param modelId - Model to update pricing for
   * @param pricing - New pricing information
   */
  updatePricing(modelId: string, pricing: ModelPricing): void {
    this.pricingData.set(modelId, pricing);
    console.debug(`Updated pricing for ${modelId}:`, pricing);
  }

  /**
   * Get pricing for a specific model
   * @param modelId - Model to get pricing for
   * @returns Pricing information or undefined if not available
   */
  getPricing(modelId: string): ModelPricing | undefined {
    return this.pricingData.get(modelId);
  }

  /**
   * Get all available pricing data
   * @returns Array of model IDs with pricing
   */
  getAvailablePricing(): { modelId: string; pricing: ModelPricing }[] {
    return Array.from(this.pricingData.entries()).map(([modelId, pricing]) => ({
      modelId,
      pricing
    }));
  }

  /**
   * Load pricing data for all supported models
   * This should be updated regularly with current pricing
   */
  private loadPricingData(): void {
    // IMPORTANT: Update these prices regularly!
    // Prices are in USD per million tokens as of January 2025
    const pricing: Record<string, ModelPricing> = {
      // OpenAI Models
      'gpt-4o': { 
        inputTokens: 2.50, 
        outputTokens: 10.00 
      },
      'gpt-4o-mini': { 
        inputTokens: 0.15, 
        outputTokens: 0.60 
      },
      'gpt-4-turbo': { 
        inputTokens: 10.00, 
        outputTokens: 30.00 
      },
      'gpt-4': { 
        inputTokens: 30.00, 
        outputTokens: 60.00 
      },
      'gpt-3.5-turbo': { 
        inputTokens: 0.50, 
        outputTokens: 1.50 
      },
      'o1-preview': { 
        inputTokens: 15.00, 
        outputTokens: 60.00 
      },
      'o1-mini': { 
        inputTokens: 3.00, 
        outputTokens: 12.00 
      },
      
      // Anthropic Models
      'claude-sonnet-4-20250514': { 
        inputTokens: 3.00, 
        outputTokens: 15.00 
      },
      'claude-3-5-sonnet-20241022': { 
        inputTokens: 3.00, 
        outputTokens: 15.00 
      },
      'claude-3-opus-20240229': { 
        inputTokens: 15.00, 
        outputTokens: 75.00 
      },
      'claude-3-sonnet-20240229': { 
        inputTokens: 3.00, 
        outputTokens: 15.00 
      },
      'claude-3-haiku-20240307': { 
        inputTokens: 0.25, 
        outputTokens: 1.25 
      },
      
      // Google Models
      'gemini-1.5-pro': { 
        inputTokens: 1.25, 
        outputTokens: 5.00 
      },
      'gemini-1.5-flash': { 
        inputTokens: 0.075, 
        outputTokens: 0.30 
      },
      'gemini-2.0-flash-exp': { 
        inputTokens: 0.075, 
        outputTokens: 0.30 
      },
      
      // Mistral Models
      'mistral-large-latest': { 
        inputTokens: 2.00, 
        outputTokens: 6.00 
      },
      'mistral-medium-latest': { 
        inputTokens: 0.70, 
        outputTokens: 2.10 
      },
      'mistral-small-latest': { 
        inputTokens: 0.20, 
        outputTokens: 0.60 
      },
      
      // Cohere Models
      'command-r-plus': { 
        inputTokens: 3.00, 
        outputTokens: 15.00 
      },
      'command-r': { 
        inputTokens: 0.50, 
        outputTokens: 1.50 
      },
      'command-light': { 
        inputTokens: 0.30, 
        outputTokens: 0.60 
      }
    };

    // Load pricing data into the map
    for (const [modelId, modelPricing] of Object.entries(pricing)) {
      this.pricingData.set(modelId, modelPricing);
    }

    console.debug(`Loaded pricing data for ${this.pricingData.size} models`);
  }

  /**
   * Estimate input tokens for a request
   * Uses rough approximation of 4 characters per token
   */
  private estimateInputTokens(request: CompletionRequest): number {
    let totalChars = 0;

    for (const message of request.messages) {
      if (typeof message.content === 'string') {
        totalChars += message.content.length;
      } else {
        // Count text content in multimodal messages
        for (const part of message.content) {
          if (part.type === 'text' && part.text) {
            totalChars += part.text.length;
          }
        }
      }
    }

    // Add overhead for message formatting and metadata
    const overhead = request.messages.length * 10; // ~10 tokens per message overhead
    
    return Math.ceil(totalChars / 4) + overhead;
  }
}

/**
 * Detailed cost breakdown for a completion
 */
interface CostBreakdown {
  /** Cost of input tokens */
  inputCost: number;
  
  /** Cost of output tokens */
  outputCost: number;
  
  /** Cost of cached tokens (if any) */
  cachedCost: number;
  
  /** Cost of reasoning tokens (if any) */
  reasoningCost: number;
  
  /** Total cost */
  totalCost: number;
  
  /** Currency (always USD) */
  currency: string;
  
  /** Model that was used */
  modelId: string;
  
  /** Original usage data */
  usage: TokenUsage;
}
```

### Usage Tracking

```typescript
/**
 * Tracks usage statistics across models and time periods
 * Provides insights into costs and token consumption
 */
class UsageTracker {
  /** Map of model ID to usage statistics */
  private usage: Map<string, UsageStats> = new Map();
  
  /** Array of individual request records for detailed analysis */
  private requestHistory: RequestRecord[] = [];
  
  /** Maximum number of requests to keep in history */
  private readonly MAX_HISTORY = 10000;

  /**
   * Track usage for a completed request
   * @param modelId - Model that was used
   * @param usage - Token usage from the request
   * @param cost - Optional cost information
   */
  trackUsage(modelId: string, usage: TokenUsage, cost?: number): void {
    // Update aggregate stats
    const existing = this.usage.get(modelId) || this.createEmptyStats(modelId);
    
    const updated: UsageStats = {
      ...existing,
      totalRequests: existing.totalRequests + 1,
      totalPromptTokens: existing.totalPromptTokens + usage.promptTokens,
      totalCompletionTokens: existing.totalCompletionTokens + usage.completionTokens,
      totalTokens: existing.totalTokens + usage.totalTokens,
      totalCachedTokens: existing.totalCachedTokens + (usage.cachedTokens || 0),
      totalReasoningTokens: existing.totalReasoningTokens + (usage.reasoningTokens || 0),
      totalCost: existing.totalCost + (cost || 0),
      lastRequest: new Date()
    };

    this.usage.set(modelId, updated);

    // Add to request history
    this.requestHistory.push({
      timestamp: new Date(),
      modelId,
      usage,
      cost: cost || 0
    });

    // Trim history if too large
    if (this.requestHistory.length > this.MAX_HISTORY) {
      this.requestHistory = this.requestHistory.slice(-this.MAX_HISTORY);
    }
  }

  /**
   * Get usage statistics for a specific model or all models
   * @param modelId - Optional model ID to filter by
   * @returns Usage statistics
   */
  getUsage(modelId?: string): UsageStats | UsageStats[] {
    if (modelId) {
      return this.usage.get(modelId) || this.createEmptyStats(modelId);
    }

    return Array.from(this.usage.values());
  }

  /**
   * Get aggregated usage across all models
   * @returns Combined usage statistics
   */
  getAggregatedUsage(): UsageStats {
    const allUsage = Array.from(this.usage.values());
    
    if (allUsage.length === 0) {
      return this.createEmptyStats('all');
    }

    return allUsage.reduce((agg, usage) => ({
      model: 'all',
      totalRequests: agg.totalRequests + usage.totalRequests,
      totalPromptTokens: agg.totalPromptTokens + usage.totalPromptTokens,
      totalCompletionTokens: agg.totalCompletionTokens + usage.totalCompletionTokens,
      totalTokens: agg.totalTokens + usage.totalTokens,
      totalCachedTokens: agg.totalCachedTokens + usage.totalCachedTokens,
      totalReasoningTokens: agg.totalReasoningTokens + usage.totalReasoningTokens,
      totalCost: agg.totalCost + usage.totalCost,
      firstRequest: agg.firstRequest < usage.firstRequest ? agg.firstRequest : usage.firstRequest,
      lastRequest: agg.lastRequest > usage.lastRequest ? agg.lastRequest : usage.lastRequest,
      averageTokensPerRequest: 0, // Will be calculated below
      averageCostPerRequest: 0
    }), this.createEmptyStats('all'));
  }

  /**
   * Get usage for a specific time period
   * @param since - Start date for the period
   * @param until - End date for the period (default: now)
   * @returns Usage statistics for the time period
   */
  getUsageInPeriod(since: Date, until: Date = new Date()): UsageStats {
    const filteredRequests = this.requestHistory.filter(
      record => record.timestamp >= since && record.timestamp <= until
    );

    if (filteredRequests.length === 0) {
      return this.createEmptyStats('period');
    }

    const stats = filteredRequests.reduce((agg, record) => ({
      model: 'period',
      totalRequests: agg.totalRequests + 1,
      totalPromptTokens: agg.totalPromptTokens + record.usage.promptTokens,
      totalCompletionTokens: agg.totalCompletionTokens + record.usage.completionTokens,
      totalTokens: agg.totalTokens + record.usage.totalTokens,
      totalCachedTokens: agg.totalCachedTokens + (record.usage.cachedTokens || 0),
      totalReasoningTokens: agg.totalReasoningTokens + (record.usage.reasoningTokens || 0),
      totalCost: agg.totalCost + record.cost,
      firstRequest: since,
      lastRequest: until,
      averageTokensPerRequest: 0,
      averageCostPerRequest: 0
    }), this.createEmptyStats('period'));

    // Calculate averages
    stats.averageTokensPerRequest = stats.totalTokens / stats.totalRequests;
    stats.averageCostPerRequest = stats.totalCost / stats.totalRequests;

    return stats;
  }

  /**
   * Get the most expensive requests
   * @param limit - Maximum number of requests to return
   * @returns Array of most expensive requests
   */
  getMostExpensiveRequests(limit: number = 10): RequestRecord[] {
    return this.requestHistory
      .sort((a, b) => b.cost - a.cost)
      .slice(0, limit);
  }

  /**
   * Get usage trends over time
   * @param intervalHours - Hours per interval
   * @param periodDays - Days to look back
   * @returns Array of usage data points over time
   */
  getUsageTrends(intervalHours: number = 1, periodDays: number = 7): UsageTrend[] {
    const now = new Date();
    const startTime = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const intervalMs = intervalHours * 60 * 60 * 1000;

    const trends: UsageTrend[] = [];
    let currentTime = startTime;

    while (currentTime < now) {
      const intervalEnd = new Date(currentTime.getTime() + intervalMs);
      const intervalRequests = this.requestHistory.filter(
        record => record.timestamp >= currentTime && record.timestamp < intervalEnd
      );

      const totalTokens = intervalRequests.reduce(
        (sum, record) => sum + record.usage.totalTokens, 0
      );
      const totalCost = intervalRequests.reduce(
        (sum, record) => sum + record.cost, 0
      );

      trends.push({
        timestamp: new Date(currentTime),
        requests: intervalRequests.length,
        tokens: totalTokens,
        cost: totalCost
      });

      currentTime = intervalEnd;
    }

    return trends;
  }

  /**
   * Reset all usage statistics
   */
  reset(): void {
    this.usage.clear();
    this.requestHistory = [];
  }

  /**
   * Export usage data for analysis
   * @returns Object containing all usage data
   */
  exportData(): {
    aggregateStats: UsageStats[];
    requestHistory: RequestRecord[];
    summary: UsageStats;
  } {
    return {
      aggregateStats: Array.from(this.usage.values()),
      requestHistory: [...this.requestHistory],
      summary: this.getAggregatedUsage()
    };
  }

  /**
   * Create empty usage statistics for a model
   */
  private createEmptyStats(model: string): UsageStats {
    const now = new Date();
    return {
      model,
      totalRequests: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      totalCachedTokens: 0,
      totalReasoningTokens: 0,
      totalCost: 0,
      firstRequest: now,
      lastRequest: now,
      averageTokensPerRequest: 0,
      averageCostPerRequest: 0
    };
  }
}

/**
 * Usage statistics for a model or time period
 */
interface UsageStats {
  /** Model identifier or period name */
  model: string;
  
  /** Total number of requests */
  totalRequests: number;
  
  /** Total prompt tokens consumed */
  totalPromptTokens: number;
  
  /** Total completion tokens generated */
  totalCompletionTokens: number;
  
  /** Total tokens (prompt + completion) */
  totalTokens: number;
  
  /** Total cached tokens used */
  totalCachedTokens: number;
  
  /** Total reasoning tokens used */
  totalReasoningTokens: number;
  
  /** Total cost in USD */
  totalCost: number;
  
  /** First request timestamp */
  firstRequest: Date;
  
  /** Last request timestamp */
  lastRequest: Date;
  
  /** Average tokens per request */
  averageTokensPerRequest: number;
  
  /** Average cost per request */
  averageCostPerRequest: number;
}

/**
 * Record of an individual request
 */
interface RequestRecord {
  /** When the request was made */
  timestamp: Date;
  
  /** Model that was used */
  modelId: string;
  
  /** Token usage for this request */
  usage: TokenUsage;
  
  /** Cost for this request */
  cost: number;
}

/**
 * Usage trend data point
 */
interface UsageTrend {
  /** Timestamp for this data point */
  timestamp: Date;
  
  /** Number of requests in this interval */
  requests: number;
  
  /** Total tokens in this interval */
  tokens: number;
  
  /** Total cost in this interval */
  cost: number;
}
```

## 6. Error Handling

### Comprehensive Error System

```typescript
/**
 * Base error class for all LLM-related errors
 * Provides structured error information and context
 */
class LLMError extends Error {
  /** Error code for programmatic handling */
  public readonly code: string;
  
  /** Provider that caused the error */
  public readonly provider?: string;
  
  /** HTTP status code (if applicable) */
  public readonly statusCode?: number;
  
  /** Original error that caused this error */
  public readonly cause?: Error;
  
  /** Additional context about the error */
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string, 
    cause?: Error, 
    context?: {
      provider?: string;
      statusCode?: number;
      type?: string;
      code?: string;
    }
  ) {
    super(message);
    this.name = 'LLMError';
    this.cause = cause;
    this.provider = context?.provider;
    this.statusCode = context?.statusCode;
    this.code = context?.code || context?.type || 'UNKNOWN_ERROR';
    this.context = context;
  }

  /**
   * Check if this error is retryable
   * @returns true if the error might succeed on retry
   */
  isRetryable(): boolean {
    // Rate limit errors are retryable
    if (this.statusCode === 429) return true;
    
    // Server errors are retryable
    if (this.statusCode && this.statusCode >= 500) return true;
    
    // Network errors are retryable
    if (this.code === 'NETWORK_ERROR') return true;
    
    // Timeout errors are retryable
    if (this.code === 'TIMEOUT_ERROR') return true;
    
    return false;
  }

  /**
   * Get a user-friendly error message
   * @returns Simplified error message for end users
   */
  getUserMessage(): string {
    switch (this.statusCode) {
      case 401:
        return 'Authentication failed. Please check your API key.';
      case 403:
        return 'Access denied. Please check your permissions.';
      case 429:
        return 'Rate limit exceeded. Please try again later.';
      case 500:
        return 'Server error. Please try again later.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Convert error to JSON for logging
   * @returns JSON representation of the error
   */
  toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      provider: this.provider,
      statusCode: this.statusCode,
      stack: this.stack,
      cause: this.cause?.message,
      context: this.context
    };
  }
}
```