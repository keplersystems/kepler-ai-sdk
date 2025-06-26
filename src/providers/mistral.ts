import { Mistral } from '@mistralai/mistralai';
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
import { MODEL_DATA } from '../models/model-data.js';

/**
 * Provider adapter for Mistral AI API
 * Supports Mistral models including Pixtral vision models with OCR capabilities
 */
export class MistralProvider implements ProviderAdapter {
    readonly name = 'mistral';

    /** Mistral AI client instance */
    private client: Mistral;

    /**
     * Create a new Mistral provider instance
     * @param config - Configuration options for the Mistral client
     */
    constructor(config: {
        /** Mistral AI API key */
        apiKey: string;

        /** Custom base URL (for proxies) */
        baseURL?: string;
    }) {
        this.client = new Mistral({
            apiKey: config.apiKey,
            serverURL: config.baseURL
        });
    }

    /**
     * Generate a completion using Mistral's chat completions API
     */
    async generateCompletion(request: CompletionRequest): Promise<CompletionResponse> {
        try {
            const messages = this.convertMessages(request.messages);
            
            const requestConfig: any = {
                model: request.model,
                messages,
                temperature: request.temperature,
                maxTokens: request.maxTokens,
                stop: Array.isArray(request.stop) ? request.stop : request.stop ? [request.stop] : undefined
            };

            // Add tools if provided
            if (request.tools && request.tools.length > 0) {
                requestConfig.tools = this.convertTools(request.tools);
                
                if (request.toolChoice) {
                    requestConfig.toolChoice = this.convertToolChoice(request.toolChoice);
                }
            }

            // Add response format if specified
            if (request.responseFormat?.type === 'json_object') {
                requestConfig.responseFormat = { type: 'json_object' };
            }

            const response = await this.client.chat.complete(requestConfig);
            
            return this.convertResponse(response);
        } catch (error) {
            throw this.handleError(error, 'completion generation');
        }
    }

    /**
     * Generate a streaming completion using Mistral's streaming API
     */
    async *streamCompletion(request: CompletionRequest): AsyncIterable<CompletionChunk> {
        try {
            const messages = this.convertMessages(request.messages);
            
            const requestConfig: any = {
                model: request.model,
                messages,
                temperature: request.temperature,
                maxTokens: request.maxTokens,
                stop: Array.isArray(request.stop) ? request.stop : request.stop ? [request.stop] : undefined,
                stream: true
            };

            // Add tools if provided
            if (request.tools && request.tools.length > 0) {
                requestConfig.tools = this.convertTools(request.tools);
                
                if (request.toolChoice) {
                    requestConfig.toolChoice = this.convertToolChoice(request.toolChoice);
                }
            }

            const stream = await this.client.chat.stream(requestConfig);

            for await (const chunk of stream) {
                yield this.convertChunk(chunk);
            }
        } catch (error) {
            throw this.handleError(error, 'streaming completion');
        }
    }

    /**
     * List all available Mistral models
     */
    async listModels(): Promise<ModelInfo[]> {
        try {
            const response = await this.client.models.list();
            return response.data?.map(model => this.convertModelInfo(model)) || [];
        } catch (error) {
            // Fall back to static model data if API fails
            console.warn('Mistral models API failed, using fallback list:', error);
            return MODEL_DATA.filter(model => model.provider === 'mistral');
        }
    }

    /**
     * Get information about a specific Mistral model
     */
    async getModel(modelId: string): Promise<ModelInfo | null> {
        try {
            const models = await this.listModels();
            return models.find(m => m.id === modelId) || null;
        } catch (error) {
            // Fall back to static data
            const fallbackModels = MODEL_DATA.filter(model => model.provider === 'mistral');
            return fallbackModels.find(m => m.id === modelId) || null;
        }
    }

    /**
     * Convert unified messages to Mistral format
     */
    private convertMessages(messages: Message[]): any[] {
        return messages.map(msg => {
            // Handle tool result messages
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
                    role: msg.role,
                    content: msg.content
                };
            }

            // Handle multimodal content (for Pixtral models)
            const content = msg.content.map(part => {
                switch (part.type) {
                    case 'text':
                        return { type: 'text', text: part.text! };
                    case 'image':
                        return {
                            type: 'image_url',
                            image_url: {
                                url: part.imageUrl!
                            }
                        };
                    case 'document':
                        // Mistral supports document OCR through image processing
                        return {
                            type: 'image_url',
                            image_url: {
                                url: part.documentUrl!
                            }
                        };
                    default:
                        throw new LLMError(`Mistral does not support content type: ${part.type}`);
                }
            });

            return {
                role: msg.role,
                content
            };
        });
    }

    /**
     * Convert unified tool definitions to Mistral format
     */
    private convertTools(tools: ToolDefinition[]): any[] {
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
     * Convert unified tool choice to Mistral format
     */
    private convertToolChoice(choice: CompletionRequest['toolChoice']): any {
        if (!choice || choice === 'auto') return 'auto';
        if (choice === 'none') return 'none';
        if (choice === 'required') return 'any';
        if (typeof choice === 'object') {
            return { type: 'function', function: { name: choice.function.name } };
        }
        return 'auto';
    }

    /**
     * Convert Mistral response to unified format
     */
    private convertResponse(response: any): CompletionResponse {
        const choice = response.choices[0];
        const message = choice.message;

        // Extract tool calls
        const toolCalls = message.tool_calls?.map((call: any) => ({
            id: call.id,
            name: call.function.name,
            arguments: JSON.parse(call.function.arguments || '{}')
        }));

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
            toolCalls,
            metadata: {
                created: response.created,
                object: response.object
            }
        };
    }

    /**
     * Convert Mistral streaming chunk to unified format
     */
    private convertChunk(chunk: any): CompletionChunk {
        const choice = chunk.choices?.[0];
        const delta = choice?.delta;

        if (!choice || !delta) {
            return {
                id: chunk.id || `mistral_stream_${Date.now()}`,
                delta: '',
                finished: false
            };
        }

        // Extract partial tool calls
        const toolCalls = delta.tool_calls?.map((call: any) => ({
            id: call.id,
            name: call.function?.name,
            arguments: call.function?.arguments ? JSON.parse(call.function.arguments) : undefined
        }));

        const usage = chunk.usage ? {
            promptTokens: chunk.usage.prompt_tokens || 0,
            completionTokens: chunk.usage.completion_tokens || 0,
            totalTokens: chunk.usage.total_tokens || 0
        } : undefined;

        return {
            id: chunk.id,
            delta: delta.content || '',
            finished: choice.finish_reason !== null && choice.finish_reason !== undefined,
            toolCalls,
            usage
        };
    }

    /**
     * Convert Mistral finish reason to unified format
     */
    private convertFinishReason(reason: string | null): CompletionResponse['finishReason'] {
        switch (reason) {
            case 'stop':
                return 'stop';
            case 'length':
                return 'length';
            case 'tool_calls':
                return 'tool_calls';
            case 'content_filter':
                return 'content_filter';
            default:
                return 'stop';
        }
    }

    /**
     * Convert Mistral model info to unified format
     */
    private convertModelInfo(model: any): ModelInfo {
        // Get additional info from our static data
        const staticInfo = MODEL_DATA.find(m => m.id === model.id);
        
        return {
            id: model.id,
            provider: 'mistral',
            name: model.name || model.id,
            description: model.description,
            contextWindow: staticInfo?.contextWindow || this.getContextWindow(model.id),
            capabilities: staticInfo?.capabilities || this.getModelCapabilities(model.id),
            pricing: staticInfo?.pricing,
            createdAt: model.created ? new Date(model.created * 1000) : undefined,
            type: model.object
        };
    }

    /**
     * Get context window for Mistral models
     */
    private getContextWindow(modelId: string): number {
        // Pixtral and Large models have larger context
        if (modelId.includes('pixtral') || modelId.includes('large')) return 128000;
        if (modelId.includes('medium')) return 32000;
        if (modelId.includes('small')) return 32000;
        return 8192; // Default fallback
    }

    /**
     * Get capabilities for Mistral models
     */
    private getModelCapabilities(modelId: string) {
        const isPixtral = modelId.includes('pixtral');
        
        return {
            streaming: true,
            functionCalling: true,
            vision: isPixtral,
            audio: false,
            embeddings: false,
            reasoning: false,
            video: false,
            documents: isPixtral // Pixtral can process documents through OCR
        };
    }

    /**
     * Handle Mistral API errors and convert to LLMError
     */
    private handleError(error: unknown, operation: string): never {
        if (error && typeof error === 'object' && 'message' in error) {
            const errorObj = error as any;
            throw new LLMError(
                `Mistral ${operation} failed: ${errorObj.message}`,
                error as Error,
                {
                    provider: 'mistral',
                    statusCode: errorObj.status || errorObj.statusCode,
                    type: errorObj.type || errorObj.code || 'MISTRAL_ERROR'
                }
            );
        }
        
        if (error instanceof Error) {
            throw new LLMError(`Mistral ${operation} failed: ${error.message}`, error);
        }
        
        throw new LLMError(`Mistral ${operation} failed with unknown error`);
    }
}