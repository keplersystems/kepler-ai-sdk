/**
 * Represents a single message in a conversation
 * Supports both simple text and multimodal content
 */
export interface Message {
    /** Role of the message sender */
    role: 'system' | 'user' | 'assistant' | 'tool';

    /** Message content - can be text or multimodal parts */
    content: string | ContentPart[];

    /** Optional name for the message sender */
    name?: string;

    /** ID of the tool call this message is responding to (for tool messages) */
    toolCallId?: string;

    /** Tool calls made by the assistant (for assistant messages) */
    toolCalls?: ToolCall[];
}

/**
 * Individual content part for multimodal messages
 * Supports text, images, videos, audio, and documents
 */
export interface ContentPart {
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
 * JSON Schema property definition for tool parameters
 */
export interface JSONSchemaProperty {
    type: string;
    description?: string;
    enum?: string[];
    items?: JSONSchemaProperty;
    properties?: Record<string, JSONSchemaProperty>;
    required?: string[];
}

/**
 * Request for generating a completion
 * Contains all parameters needed for LLM generation
 */
export interface CompletionRequest {
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
export interface ResponseFormat {
    /** Response format type */
    type: 'text' | 'json_object' | 'json_schema';

    /** JSON schema for structured outputs */
    jsonSchema?: object;
}

/**
 * Response from a completion request
 * Contains the generated content and metadata
 */
export interface CompletionResponse {
    /** Unique identifier for this completion */
    id: string;

    /** Generated text content */
    content: string;

    /** Model used for generation */
    model: string;

    /** Token usage statistics */
    usage: TokenUsage;

    /** Reason why generation stopped */
    finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'rate_limit' | 'cancelled';

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
export interface TokenUsage {
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
export interface ToolDefinition {
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
export interface ToolCall {
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
export interface ToolResult {
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
export interface ModelCapabilities {
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
export interface ModelInfo {
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

    /** Additional provider-specific metadata */
    metadata?: Record<string, unknown>;
}

/**
 * Pricing information for a model
 * All prices in USD per million tokens
 */
export interface ModelPricing {
    /** Cost per million input tokens */
    inputTokens: number;

    /** Cost per million output tokens */
    outputTokens: number;

    /** Cost per million cached tokens (if supported) */
    cachedTokens?: number;

    /** Cost per million reasoning tokens (if supported) */
    reasoningTokens?: number;
}

/**
 * A chunk of a streaming completion response
 * Contains partial content and metadata
 */
export interface CompletionChunk {
    /** Unique identifier for the completion */
    id: string;

    /** The incremental content delta */
    delta: string;

    /** Whether this is the final chunk */
    finished: boolean;

    /** Partial tool calls (if any) */
    toolCalls?: Partial<ToolCall>[];

    /** Tool call deltas for streaming (OpenAI format) */
    toolCallDeltas?: Array<{
        index: number;
        id?: string;
        name?: string;
        arguments: string;
    }>;

    /** Usage information (usually only in final chunk) */
    usage?: TokenUsage;
}

/**
 * Request for generating embeddings
 */
export interface EmbeddingRequest {
    /** Model to use for embeddings */
    model: string;

    /** Text input to embed */
    input: string | string[];

    /** Encoding format */
    encodingFormat?: 'float' | 'base64';

    /** Number of dimensions (if supported) */
    dimensions?: number;
}

/**
 * Response from an embedding request
 */
export interface EmbeddingResponse {
    /** Generated embeddings */
    embeddings: number[][];

    /** Token usage for the request */
    usage: TokenUsage;

    /** Model used */
    model?: string;
}

/**
 * Request for generating images
 */
export interface ImageRequest {
    /** Text prompt for the image */
    prompt: string;

    /** Model to use (e.g., 'dall-e-3') */
    model?: string;

    /** Image size */
    size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';

    /** Image quality */
    quality?: 'standard' | 'hd';

    /** Number of images to generate */
    n?: number;

    /** Response format */
    responseFormat?: 'url' | 'b64_json';
}

/**
 * Response from an image generation request
 */
export interface ImageResponse {
    /** Generated images */
    images: Array<{
        /** Image URL or base64 data */
        url?: string;
        b64Json?: string;
        /** Revised prompt (if applicable) */
        revisedPrompt?: string;
    }>;
}

/**
 * Request for generating audio
 */
export interface AudioRequest {
    /** Text to convert to speech */
    text: string;

    /** Model to use (e.g., 'tts-1') */
    model?: string;

    /** Voice to use */
    voice?: string;

    /** Output format */
    format?: 'mp3' | 'opus' | 'aac' | 'flac';

    /** Speed of speech */
    speed?: number;
}

/**
 * Response from an audio generation request
 */
export interface AudioResponse {
    /** Generated audio data */
    audio: ArrayBuffer;

    /** Content type */
    contentType?: string;
}

/**
 * Interface that all provider adapters must implement
 * Provides a unified way to interact with different LLM providers
 */
export interface ProviderAdapter {
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
