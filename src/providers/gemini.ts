import { GoogleGenAI } from '@google/genai';
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
 * Provider adapter for Google Gemini API
 * Supports Gemini models with large context windows, video processing, and thinking budgets
 */
export class GeminiProvider implements ProviderAdapter {
    readonly name = 'gemini';

    /** Google GenAI client instance */
    private client: GoogleGenAI;

    /**
     * Create a new Gemini provider instance
     * @param config - Configuration options for the Gemini client
     */
    constructor(config: {
        /** Google AI Studio API key */
        apiKey?: string;

        /** Vertex AI configuration */
        vertexAI?: {
            project: string;
            location: string;
        };

        /** Custom base URL (for proxies) */
        baseURL?: string;
    }) {
        if (config.vertexAI) {
            this.client = new GoogleGenAI({
                vertexai: true,
                project: config.vertexAI.project,
                location: config.vertexAI.location
            });
        } else if (config.apiKey) {
            this.client = new GoogleGenAI({
                apiKey: config.apiKey
            });
        } else {
            throw new LLMError('Either apiKey or vertexAI configuration must be provided');
        }
    }

    /**
     * Generate a completion using Gemini's generateContent API
     */
    async generateCompletion(request: CompletionRequest): Promise<CompletionResponse> {
        try {
            const { contents, systemInstruction } = this.convertMessages(request.messages);
            
            const requestConfig: any = {
                model: request.model,
                contents,
                systemInstruction,
                generationConfig: {
                    temperature: request.temperature,
                    maxOutputTokens: request.maxTokens,
                    stopSequences: Array.isArray(request.stop) ? request.stop : request.stop ? [request.stop] : undefined
                }
            };

            // Add tools if provided
            if (request.tools && request.tools.length > 0) {
                requestConfig.tools = [{
                    functionDeclarations: this.convertTools(request.tools)
                }];

                // Configure tool choice
                if (request.toolChoice) {
                    requestConfig.toolConfig = this.convertToolChoice(request.toolChoice);
                }
            }

            // Add response format if specified
            if (request.responseFormat?.type === 'json_object') {
                requestConfig.generationConfig.responseMimeType = 'application/json';
            } else if (request.responseFormat?.type === 'json_schema') {
                requestConfig.generationConfig.responseMimeType = 'application/json';
                requestConfig.generationConfig.responseSchema = request.responseFormat.jsonSchema;
            }

            const response = await this.client.models.generateContent(requestConfig);
            
            return this.convertResponse(response, request.model);
        } catch (error) {
            throw this.handleError(error, 'completion generation');
        }
    }

    /**
     * Generate a streaming completion using Gemini's streaming API
     */
    async *streamCompletion(request: CompletionRequest): AsyncIterable<CompletionChunk> {
        try {
            const { contents, systemInstruction } = this.convertMessages(request.messages);
            
            const requestConfig: any = {
                model: request.model,
                contents,
                systemInstruction,
                generationConfig: {
                    temperature: request.temperature,
                    maxOutputTokens: request.maxTokens,
                    stopSequences: Array.isArray(request.stop) ? request.stop : request.stop ? [request.stop] : undefined
                }
            };

            // Add tools if provided
            if (request.tools && request.tools.length > 0) {
                requestConfig.tools = [{
                    functionDeclarations: this.convertTools(request.tools)
                }];

                if (request.toolChoice) {
                    requestConfig.toolConfig = this.convertToolChoice(request.toolChoice);
                }
            }

            const stream = await this.client.models.generateContentStream(requestConfig);

            for await (const chunk of stream) {
                yield this.convertChunk(chunk);
            }
        } catch (error) {
            throw this.handleError(error, 'streaming completion');
        }
    }

    /**
     * List all available Gemini models
     */
    async listModels(): Promise<ModelInfo[]> {
        // Return models from our static data since Gemini API doesn't provide detailed model info
        return MODEL_DATA.filter(model => model.provider === 'gemini');
    }

    /**
     * Get information about a specific Gemini model
     */
    async getModel(modelId: string): Promise<ModelInfo | null> {
        const models = await this.listModels();
        return models.find(m => m.id === modelId) || null;
    }

    /**
     * Convert unified messages to Gemini format
     */
    private convertMessages(messages: Message[]): { contents: any[]; systemInstruction?: string } {
        const systemMessages = messages.filter(m => m.role === 'system');
        const nonSystemMessages = messages.filter(m => m.role !== 'system');
        
        // Combine system messages
        const systemInstruction = systemMessages.length > 0 
            ? systemMessages.map(m => m.content as string).join('\n')
            : undefined;

        const contents = nonSystemMessages.map(msg => {
            // Handle tool result messages
            if (msg.role === 'tool') {
                return {
                    role: 'function',
                    parts: [{
                        functionResponse: {
                            name: 'tool_result', // We'll need to track tool names
                            response: { result: msg.content }
                        }
                    }]
                };
            }

            // Handle simple text messages
            if (typeof msg.content === 'string') {
                return {
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content }]
                };
            }

            // Handle multimodal content
            const parts = msg.content.map(part => {
                switch (part.type) {
                    case 'text':
                        return { text: part.text! };
                    case 'image':
                        return {
                            inlineData: {
                                mimeType: part.mimeType || 'image/jpeg',
                                data: part.imageUrl!.replace(/^data:image\/[^;]+;base64,/, '')
                            }
                        };
                    case 'video':
                        return {
                            inlineData: {
                                mimeType: part.mimeType || 'video/mp4',
                                data: part.videoUrl!.replace(/^data:video\/[^;]+;base64,/, '')
                            }
                        };
                    case 'audio':
                        return {
                            inlineData: {
                                mimeType: part.mimeType || 'audio/wav',
                                data: part.audioUrl!.replace(/^data:audio\/[^;]+;base64,/, '')
                            }
                        };
                    case 'document':
                        return {
                            inlineData: {
                                mimeType: part.mimeType || 'application/pdf',
                                data: part.documentUrl!.replace(/^data:application\/[^;]+;base64,/, '')
                            }
                        };
                    default:
                        throw new LLMError(`Gemini does not support content type: ${part.type}`);
                }
            });

            return {
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts
            };
        });

        return { contents, systemInstruction };
    }

    /**
     * Convert unified tool definitions to Gemini format
     */
    private convertTools(tools: ToolDefinition[]): any[] {
        return tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }));
    }

    /**
     * Convert unified tool choice to Gemini format
     */
    private convertToolChoice(choice: CompletionRequest['toolChoice']): any {
        if (!choice || choice === 'auto') {
            return { functionCallingConfig: { mode: 'AUTO' } };
        }
        if (choice === 'none') {
            return { functionCallingConfig: { mode: 'NONE' } };
        }
        if (choice === 'required') {
            return { functionCallingConfig: { mode: 'ANY' } };
        }
        if (typeof choice === 'object') {
            return {
                functionCallingConfig: {
                    mode: 'ANY',
                    allowedFunctionNames: [choice.function.name]
                }
            };
        }
        return { functionCallingConfig: { mode: 'AUTO' } };
    }

    /**
     * Convert Gemini response to unified format
     */
    private convertResponse(response: any, modelId: string): CompletionResponse {
        const candidate = response.candidates[0];
        const content = candidate.content;
        
        // Extract text content
        const textContent = content.parts
            .filter((part: any) => part.text)
            .map((part: any) => part.text)
            .join('');

        // Extract tool calls
        const toolCalls = content.parts
            .filter((part: any) => part.functionCall)
            .map((part: any, index: number) => ({
                id: `call_${index}`,
                name: part.functionCall.name,
                arguments: part.functionCall.args || {}
            }));

        // Get usage information
        const usage: TokenUsage = {
            promptTokens: response.usageMetadata?.promptTokenCount || 0,
            completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: response.usageMetadata?.totalTokenCount || 0,
            cachedTokens: response.usageMetadata?.cachedContentTokenCount || undefined
        };

        // Extract reasoning traces if available (for thinking models)
        const reasoning = candidate.groundingMetadata?.retrievalQueries?.join('\n') || undefined;

        return {
            id: `gemini_${Date.now()}`,
            content: textContent,
            model: modelId,
            usage,
            finishReason: this.convertFinishReason(candidate.finishReason),
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            reasoning,
            metadata: {
                safetyRatings: candidate.safetyRatings,
                citationMetadata: candidate.citationMetadata
            }
        };
    }

    /**
     * Convert Gemini streaming chunk to unified format
     */
    private convertChunk(chunk: any): CompletionChunk {
        if (!chunk.candidates || chunk.candidates.length === 0) {
            return {
                id: `gemini_stream_${Date.now()}`,
                delta: '',
                finished: false
            };
        }

        const candidate = chunk.candidates[0];
        const content = candidate.content;
        
        if (!content || !content.parts) {
            return {
                id: `gemini_stream_${Date.now()}`,
                delta: '',
                finished: candidate.finishReason !== undefined
            };
        }

        // Extract text delta
        const textDelta = content.parts
            .filter((part: any) => part.text)
            .map((part: any) => part.text)
            .join('');

        // Extract partial tool calls
        const toolCalls = content.parts
            .filter((part: any) => part.functionCall)
            .map((part: any, index: number) => ({
                id: `call_${index}`,
                name: part.functionCall.name,
                arguments: part.functionCall.args || {}
            }));

        const usage = chunk.usageMetadata ? {
            promptTokens: chunk.usageMetadata.promptTokenCount || 0,
            completionTokens: chunk.usageMetadata.candidatesTokenCount || 0,
            totalTokens: chunk.usageMetadata.totalTokenCount || 0,
            cachedTokens: chunk.usageMetadata.cachedContentTokenCount || undefined
        } : undefined;

        return {
            id: `gemini_stream_${Date.now()}`,
            delta: textDelta,
            finished: candidate.finishReason !== undefined,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            usage
        };
    }

    /**
     * Convert Gemini finish reason to unified format
     */
    private convertFinishReason(reason: string | undefined): CompletionResponse['finishReason'] {
        switch (reason) {
            case 'STOP':
                return 'stop';
            case 'MAX_TOKENS':
                return 'length';
            case 'SAFETY':
                return 'content_filter';
            case 'RECITATION':
                return 'content_filter';
            default:
                return 'stop';
        }
    }

    /**
     * Handle Gemini API errors and convert to LLMError
     */
    private handleError(error: unknown, operation: string): never {
        if (error && typeof error === 'object' && 'message' in error) {
            const errorObj = error as any;
            throw new LLMError(
                `Gemini ${operation} failed: ${errorObj.message}`,
                error as Error,
                {
                    provider: 'gemini',
                    statusCode: errorObj.status || errorObj.code,
                    type: errorObj.name || 'GEMINI_ERROR'
                }
            );
        }
        
        if (error instanceof Error) {
            throw new LLMError(`Gemini ${operation} failed: ${error.message}`, error);
        }
        
        throw new LLMError(`Gemini ${operation} failed with unknown error`);
    }
}