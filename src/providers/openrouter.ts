import OpenAI from 'openai';
import type {
    ProviderAdapter,
    CompletionRequest,
    CompletionResponse,
    CompletionChunk,
    ModelInfo,
    TokenUsage,
    Message,
    ToolDefinition,
    ToolCall,
    ResponseFormat
} from '../core/interfaces.js';
import { LLMError } from '../errors/LLMError.js';

/**
 * Provider adapter for OpenRouter API
 * Provides access to 300+ models through OpenAI-compatible interface
 */
export class OpenRouterProvider implements ProviderAdapter {
    readonly name = 'openrouter';

    /** OpenAI SDK client configured for OpenRouter */
    private client: OpenAI;
    
    /** OpenRouter site URL for referrals */
    private siteUrl?: string;
    
    /** OpenRouter app name for attribution */
    private appName?: string;

    /**
     * Create a new OpenRouter provider instance
     * @param config - Configuration options for the OpenRouter client
     */
    constructor(config: {
        /** OpenRouter API key */
        apiKey: string;

        /** Your site URL for referrals */
        siteUrl?: string;

        /** Your app name for attribution */
        appName?: string;
    }) {
        this.siteUrl = config.siteUrl;
        this.appName = config.appName;
        
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': config.siteUrl || '',
                'X-Title': config.appName || 'Kepler AI SDK'
            }
        });
    }

    /**
     * Generate a completion using OpenRouter's chat completions API
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
     * Generate a streaming completion using OpenRouter's streaming API
     */
    async *streamCompletion(request: CompletionRequest): AsyncIterable<CompletionChunk> {
        try {
            const stream = await this.client.chat.completions.create({
                model: request.model,
                messages: this.convertMessages(request.messages),
                temperature: request.temperature,
                max_tokens: request.maxTokens,
                tools: request.tools ? this.convertTools(request.tools) : undefined,
                tool_choice: this.convertToolChoice(request.toolChoice),
                stream: true,
                stop: request.stop
            });

            for await (const chunk of stream) {
                yield this.convertChunk(chunk);
            }
        } catch (error) {
            throw this.handleError(error, 'streaming completion');
        }
    }

    /**
     * List all available models from OpenRouter
     */
    async listModels(): Promise<ModelInfo[]> {
        try {
            const response = await fetch('https://openrouter.ai/api/v1/models', {
                headers: {
                    'Authorization': `Bearer ${this.client.apiKey}`,
                    'HTTP-Referer': this.siteUrl || '',
                    'X-Title': this.appName || 'Kepler AI SDK'
                }
            });

            if (!response.ok) {
                throw new Error(`OpenRouter API returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json() as any;
            return data.data?.map((model: any) => this.convertModelInfo(model)) || [];
        } catch (error) {
            throw this.handleError(error, 'listing models');
        }
    }

    /**
     * Get information about a specific OpenRouter model
     */
    async getModel(modelId: string): Promise<ModelInfo | null> {
        try {
            const models = await this.listModels();
            return models.find(m => m.id === modelId) || null;
        } catch (error) {
            console.debug(`Failed to get model ${modelId} from OpenRouter:`, error);
            return null;
        }
    }

    /**
     * Convert unified messages to OpenAI format (OpenRouter is compatible)
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
                        return { type: 'text' as const, text: part.text! };
                    case 'image':
                        return { 
                            type: 'image_url' as const, 
                            image_url: { url: part.imageUrl! } 
                        };
                    case 'video':
                        // Some models on OpenRouter might support video
                        return {
                            type: 'image_url' as const, // Treat as image for now
                            image_url: { url: part.videoUrl! }
                        };
                    case 'audio':
                        // Audio support varies by model
                        throw new LLMError(`Audio content not supported for model: ${part.type}`);
                    case 'document':
                        // Document support varies by model
                        return {
                            type: 'image_url' as const, // Some models can process document images
                            image_url: { url: part.documentUrl! }
                        };
                    default:
                        throw new LLMError(`OpenRouter model may not support content type: ${part.type}`);
                }
            });

            if (msg.role === 'user') {
                return {
                    role: 'user' as const,
                    content
                };
            } else {
                return {
                    role: 'assistant' as const,
                    content
                };
            }
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
     * Convert OpenRouter response to unified format
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
            })),
            metadata: {
                system_fingerprint: response.system_fingerprint,
                created: response.created
            }
        };
    }

    /**
     * Convert OpenRouter streaming chunk to unified format
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
     * Convert OpenRouter finish reason to unified format
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
     * Convert OpenRouter model info to unified format
     */
    private convertModelInfo(model: any): ModelInfo {
        // Parse capabilities from model description and features
        const capabilities = this.parseModelCapabilities(model);
        
        return {
            id: model.id,
            provider: 'openrouter',
            name: model.name || model.id,
            description: model.description,
            contextWindow: model.context_length || 4096,
            maxOutputTokens: model.max_completion_tokens,
            capabilities,
            pricing: model.pricing ? {
                inputTokens: parseFloat(model.pricing.prompt) * 1000000, // Convert to per million
                outputTokens: parseFloat(model.pricing.completion) * 1000000
            } : undefined,
            createdAt: model.created ? new Date(model.created * 1000) : undefined,
            type: model.type,
            metadata: {
                architecture: model.architecture,
                modality: model.modality,
                per_request_limits: model.per_request_limits,
                top_provider: model.top_provider
            }
        };
    }

    /**
     * Parse model capabilities from OpenRouter model metadata
     */
    private parseModelCapabilities(model: any) {
        const modality = model.modality || {};
        const architecture = model.architecture || {};
        
        return {
            streaming: true, // Most OpenRouter models support streaming
            functionCalling: architecture.function_calling || false,
            vision: modality.image || false,
            audio: modality.audio || false,
            embeddings: false, // OpenRouter doesn't provide embedding models
            reasoning: model.id.includes('o1') || model.id.includes('reasoning'),
            video: modality.video || false,
            documents: modality.image || false // Many vision models can process documents
        };
    }

    /**
     * Handle OpenRouter API errors and convert to LLMError
     */
    private handleError(error: unknown, operation: string): never {
        if (error instanceof OpenAI.APIError) {
            throw new LLMError(
                `OpenRouter ${operation} failed: ${error.message}`,
                error,
                {
                    provider: 'openrouter',
                    statusCode: error.status,
                    type: error.type
                }
            );
        }
        
        if (error instanceof Error) {
            throw new LLMError(`OpenRouter ${operation} failed: ${error.message}`, error);
        }
        
        throw new LLMError(`OpenRouter ${operation} failed with unknown error`);
    }
}