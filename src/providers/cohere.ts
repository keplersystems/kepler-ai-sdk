import { CohereClientV2 } from 'cohere-ai';
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
    ResponseFormat,
    EmbeddingRequest,
    EmbeddingResponse
} from '../core/interfaces.js';
import { LLMError } from '../errors/LLMError.js';
import { MODEL_DATA } from '../models/model-data.js';

/**
 * Provider adapter for Cohere AI API
 * Supports Command R+ models with enterprise features and document processing
 */
export class CohereProvider implements ProviderAdapter {
    readonly name = 'cohere';

    /** Cohere AI client instance */
    private client: CohereClientV2;

    /**
     * Create a new Cohere provider instance
     * @param config - Configuration options for the Cohere client
     */
    constructor(config: {
        /** Cohere AI API key */
        apiKey: string;

        /** Custom base URL (for proxies) */
        baseURL?: string;
    }) {
        this.client = new CohereClientV2({
            token: config.apiKey,
            environment: config.baseURL
        });
    }

    /**
     * Generate a completion using Cohere's chat API
     */
    async generateCompletion(request: CompletionRequest): Promise<CompletionResponse> {
        try {
            const messages = this.convertMessagesV2(request.messages);

            const requestConfig: any = {
                model: request.model,
                messages,
                temperature: request.temperature,
                maxTokens: request.maxTokens,
                stopSequences: Array.isArray(request.stop) ? request.stop : request.stop ? [request.stop] : undefined
            };

            // Add tools if provided
            if (request.tools && request.tools.length > 0) {
                requestConfig.tools = this.convertTools(request.tools);

                if (request.toolChoice && request.toolChoice !== 'auto') {
                    // Cohere has limited tool choice options
                    requestConfig.forceAutoUse = request.toolChoice === 'required';
                }
            }

            const response = await this.client.chat(requestConfig);

            return this.convertResponse(response, request.model);
        } catch (error) {
            throw this.handleError(error, 'completion generation');
        }
    }

    /**
     * Generate a streaming completion using Cohere's streaming API
     */
    async *streamCompletion(request: CompletionRequest): AsyncIterable<CompletionChunk> {
        try {
            const messages = this.convertMessagesV2(request.messages);

            const requestConfig: any = {
                model: request.model,
                messages,
                temperature: request.temperature,
                maxTokens: request.maxTokens,
                stopSequences: Array.isArray(request.stop) ? request.stop : request.stop ? [request.stop] : undefined
            };

            // Add tools if provided
            if (request.tools && request.tools.length > 0) {
                requestConfig.tools = this.convertTools(request.tools);

                if (request.toolChoice && request.toolChoice !== 'auto') {
                    requestConfig.forceAutoUse = request.toolChoice === 'required';
                }
            }

            const stream = await this.client.chatStream(requestConfig);

            for await (const chunk of stream) {
                yield this.convertChunk(chunk);
            }
        } catch (error) {
            throw this.handleError(error, 'streaming completion');
        }
    }

    /**
     * List all available Cohere models
     */
    async listModels(): Promise<ModelInfo[]> {
        try {
            const response = await this.client.models.list();
            return response.models?.map(model => this.convertModelInfo(model)) || [];
        } catch (error) {
            // Fall back to static model data if API fails
            console.warn('Cohere models API failed, using fallback list:', error);
            return MODEL_DATA.filter(model => model.provider === 'cohere');
        }
    }

    /**
     * Get information about a specific Cohere model
     */
    async getModel(modelId: string): Promise<ModelInfo | null> {
        try {
            const models = await this.listModels();
            return models.find(m => m.id === modelId) || null;
        } catch (error) {
            // Fall back to static data
            const fallbackModels = MODEL_DATA.filter(model => model.provider === 'cohere');
            return fallbackModels.find(m => m.id === modelId) || null;
        }
    }

    /**
     * Generate embeddings using Cohere's embed API
     */
    async generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
        try {
            const response = await this.client.embed({
                model: request.model || 'embed-english-v3.0',
                texts: Array.isArray(request.input) ? request.input : [request.input],
                embeddingTypes: ['float'], // Required in v2 API
                inputType: 'search_document'
            });

            return {
                embeddings: response.embeddings?.float || [],
                usage: {
                    promptTokens: response.meta?.billedUnits?.inputTokens || 0,
                    completionTokens: 0,
                    totalTokens: response.meta?.billedUnits?.inputTokens || 0
                }
            };
        } catch (error) {
            throw this.handleError(error, 'embedding generation');
        }
    }

    /**
     * Convert unified messages to Cohere v2 format
     */
    private convertMessagesV2(messages: Message[]): any[] {
        return messages.map(msg => {
            if (msg.role === 'tool') {
                return {
                    role: 'tool',
                    toolResults: [{
                        call: { name: 'tool_result' },
                        outputs: [{ result: msg.content }]
                    }]
                };
            }

            // Handle simple text messages
            if (typeof msg.content === 'string') {
                return {
                    role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
                    content: msg.content
                };
            }

            // Handle multimodal content (limited support)
            const textContent = msg.content
                .filter(part => part.type === 'text')
                .map(part => part.text)
                .join('\n');

            // Note: Cohere has limited multimodal support
            if (msg.content.some(part => part.type !== 'text')) {
                console.warn('Cohere has limited multimodal support. Only text content will be processed.');
            }

            return {
                role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
                content: textContent
            };
        });
    }

    /**
     * Convert unified messages to Cohere v1 format (deprecated)
     */
    private convertMessages(messages: Message[]): { chatHistory: any[]; message: string } {
        // Cohere expects the last message as separate 'message' parameter
        // and previous messages as 'chatHistory'

        const lastMessage = messages[messages.length - 1];
        const previousMessages = messages.slice(0, -1);

        // Convert chat history
        const chatHistory = previousMessages
            .filter(msg => msg.role !== 'system') // Cohere handles system messages differently
            .map(msg => {
                if (msg.role === 'tool') {
                    return {
                        role: 'TOOL',
                        toolResults: [{
                            call: { name: 'tool_result' }, // We'll need to track tool names
                            outputs: [{ result: msg.content }]
                        }]
                    };
                }

                // Handle simple text messages
                if (typeof msg.content === 'string') {
                    return {
                        role: msg.role === 'assistant' ? 'CHATBOT' : 'USER',
                        message: msg.content
                    };
                }

                // Handle multimodal content (limited support)
                const textContent = msg.content
                    .filter(part => part.type === 'text')
                    .map(part => part.text)
                    .join('\n');

                // Note: Cohere has limited multimodal support
                if (msg.content.some(part => part.type !== 'text')) {
                    console.warn('Cohere has limited multimodal support. Only text content will be processed.');
                }

                return {
                    role: msg.role === 'assistant' ? 'CHATBOT' : 'USER',
                    message: textContent
                };
            });

        // Extract the current message
        let currentMessage: string;
        if (typeof lastMessage.content === 'string') {
            currentMessage = lastMessage.content;
        } else {
            currentMessage = lastMessage.content
                .filter(part => part.type === 'text')
                .map(part => part.text)
                .join('\n');
        }

        return { chatHistory, message: currentMessage };
    }

    /**
     * Convert unified tool definitions to Cohere format
     */
    private convertTools(tools: ToolDefinition[]): any[] {
        return tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameterDefinitions: this.convertParameterDefinitions(tool.parameters)
        }));
    }

    /**
     * Convert JSON Schema parameters to Cohere format
     */
    private convertParameterDefinitions(parameters: any): any {
        const definitions: any = {};

        if (parameters.properties) {
            for (const [name, prop] of Object.entries(parameters.properties as any)) {
                definitions[name] = {
                    description: (prop as any).description || '',
                    type: this.mapJsonSchemaTypeToCohereType((prop as any).type),
                    required: parameters.required?.includes(name) || false
                };
            }
        }

        return definitions;
    }

    /**
     * Map JSON Schema types to Cohere types
     */
    private mapJsonSchemaTypeToCohereType(jsonType: string): string {
        const typeMap: Record<string, string> = {
            'string': 'str',
            'number': 'float',
            'integer': 'int',
            'boolean': 'bool',
            'array': 'list',
            'object': 'dict'
        };
        return typeMap[jsonType] || 'str';
    }

    /**
     * Convert Cohere response to unified format
     */
    private convertResponse(response: any, modelId: string): CompletionResponse {
        // Extract text content
        const content = response.text || '';

        // Extract tool calls if any
        const toolCalls = response.toolCalls?.map((call: any, index: number) => ({
            id: `call_${index}`,
            name: call.name,
            arguments: call.parameters || {}
        }));

        // Calculate token usage
        const usage: TokenUsage = {
            promptTokens: response.meta?.billedUnits?.inputTokens || 0,
            completionTokens: response.meta?.billedUnits?.outputTokens || 0,
            totalTokens: (response.meta?.billedUnits?.inputTokens || 0) + (response.meta?.billedUnits?.outputTokens || 0)
        };

        return {
            id: response.generationId || `cohere_${Date.now()}`,
            content,
            model: modelId,
            usage,
            finishReason: this.convertFinishReason(response.finishReason),
            toolCalls: toolCalls?.length > 0 ? toolCalls : undefined,
            metadata: {
                citations: response.citations,
                documents: response.documents,
                searchQueries: response.searchQueries,
                searchResults: response.searchResults
            }
        };
    }

    /**
     * Convert Cohere streaming chunk to unified format
     */
    private convertChunk(chunk: any): CompletionChunk {
        // Handle different chunk types from Cohere streaming
        if (chunk.eventType === 'text-generation') {
            return {
                id: chunk.generationId || `cohere_stream_${Date.now()}`,
                delta: chunk.text || '',
                finished: false
            };
        }

        if (chunk.eventType === 'stream-end') {
            const usage = chunk.response?.meta?.billedUnits ? {
                promptTokens: chunk.response.meta.billedUnits.inputTokens || 0,
                completionTokens: chunk.response.meta.billedUnits.outputTokens || 0,
                totalTokens: (chunk.response.meta.billedUnits.inputTokens || 0) + (chunk.response.meta.billedUnits.outputTokens || 0)
            } : undefined;

            return {
                id: chunk.generationId || `cohere_stream_${Date.now()}`,
                delta: '',
                finished: true,
                usage
            };
        }

        return {
            id: chunk.generationId || `cohere_stream_${Date.now()}`,
            delta: '',
            finished: false
        };
    }

    /**
     * Convert Cohere finish reason to unified format
     */
    private convertFinishReason(reason: string | undefined): CompletionResponse['finishReason'] {
        switch (reason) {
            case 'COMPLETE':
                return 'stop';
            case 'MAX_TOKENS':
                return 'length';
            case 'ERROR':
                return 'content_filter';
            case 'ERROR_TOXIC':
                return 'content_filter';
            default:
                return 'stop';
        }
    }

    /**
     * Convert Cohere model info to unified format
     */
    private convertModelInfo(model: any): ModelInfo {
        // Get additional info from our static data
        const staticInfo = MODEL_DATA.find(m => m.id === model.name);

        return {
            id: model.name,
            provider: 'cohere',
            name: model.name,
            description: model.description,
            contextWindow: staticInfo?.contextWindow || this.getContextWindow(model.name),
            capabilities: staticInfo?.capabilities || this.getModelCapabilities(model.name),
            pricing: staticInfo?.pricing,
            createdAt: model.createdAt ? new Date(model.createdAt) : undefined,
            type: model.type
        };
    }

    /**
     * Get context window for Cohere models
     */
    private getContextWindow(modelId: string): number {
        if (modelId.includes('command-r')) return 128000;
        if (modelId.includes('command')) return 4096;
        return 4096; // Default fallback
    }

    /**
     * Get capabilities for Cohere models
     */
    private getModelCapabilities(modelId: string) {
        const isCommandR = modelId.includes('command-r');

        return {
            streaming: true,
            functionCalling: isCommandR,
            vision: false, // Cohere doesn't support vision
            audio: false,
            embeddings: false, // Only specific embed models support embeddings
            reasoning: false,
            video: false,
            documents: isCommandR // Command R models have better document processing
        };
    }

    /**
     * Handle Cohere API errors and convert to LLMError
     */
    private handleError(error: unknown, operation: string): never {
        if (error && typeof error === 'object' && 'message' in error) {
            const errorObj = error as any;
            throw new LLMError(
                `Cohere ${operation} failed: ${errorObj.message}`,
                error as Error,
                {
                    provider: 'cohere',
                    statusCode: errorObj.statusCode || errorObj.status,
                    type: errorObj.name || 'COHERE_ERROR'
                }
            );
        }

        if (error instanceof Error) {
            throw new LLMError(`Cohere ${operation} failed: ${error.message}`, error);
        }

        throw new LLMError(`Cohere ${operation} failed with unknown error`);
    }
}