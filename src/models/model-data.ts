import type { ModelInfo } from '../core/interfaces.js';

export const MODEL_DATA: ModelInfo[] = [
    // OpenAI Models
    {
        id: 'gpt-4o',
        provider: 'openai',
        name: 'GPT-4o',
        contextWindow: 128000,
        capabilities: {
            streaming: true,
            functionCalling: true,
            vision: true,
            audio: false,
            embeddings: false,
            reasoning: false,
            video: false,
            documents: true
        },
        pricing: { inputTokens: 2.50, outputTokens: 10.00 }
    },
    {
        id: 'gpt-4o-mini',
        provider: 'openai',
        name: 'GPT-4o Mini',
        contextWindow: 128000,
        capabilities: {
            streaming: true,
            functionCalling: true,
            vision: true,
            audio: false,
            embeddings: false,
            reasoning: false,
            video: false,
            documents: true
        },
        pricing: { inputTokens: 0.15, outputTokens: 0.60 }
    },
    {
        id: 'gpt-4-turbo',
        provider: 'openai',
        name: 'GPT-4 Turbo',
        contextWindow: 128000,
        capabilities: {
            streaming: true,
            functionCalling: true,
            vision: true,
            audio: false,
            embeddings: false,
            reasoning: false,
            video: false,
            documents: true
        },
        pricing: { inputTokens: 10.00, outputTokens: 30.00 }
    },
    {
        id: 'gpt-4',
        provider: 'openai',
        name: 'GPT-4',
        contextWindow: 8192,
        capabilities: {
            streaming: true,
            functionCalling: true,
            vision: false,
            audio: false,
            embeddings: false,
            reasoning: false,
            video: false,
            documents: false
        },
        pricing: { inputTokens: 30.00, outputTokens: 60.00 }
    },
    {
        id: 'gpt-3.5-turbo',
        provider: 'openai',
        name: 'GPT-3.5 Turbo',
        contextWindow: 16385,
        capabilities: {
            streaming: true,
            functionCalling: true,
            vision: false,
            audio: false,
            embeddings: false,
            reasoning: false,
            video: false,
            documents: false
        },
        pricing: { inputTokens: 0.50, outputTokens: 1.50 }
    },
    {
        id: 'o1-preview',
        provider: 'openai',
        name: 'o1-preview',
        contextWindow: 200000,
        capabilities: {
            streaming: true,
            functionCalling: false,
            vision: false,
            audio: false,
            embeddings: false,
            reasoning: true,
            video: false,
            documents: false
        },
        pricing: { inputTokens: 15.00, outputTokens: 60.00 }
    },
    {
        id: 'o1-mini',
        provider: 'openai',
        name: 'o1-mini',
        contextWindow: 200000,
        capabilities: {
            streaming: true,
            functionCalling: false,
            vision: false,
            audio: false,
            embeddings: false,
            reasoning: true,
            video: false,
            documents: false
        },
        pricing: { inputTokens: 3.00, outputTokens: 12.00 }
    },

    // Anthropic Models
    {
        id: 'claude-3-5-sonnet-20240620',
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
    },
    {
        id: 'claude-3-sonnet-20240229',
        provider: 'anthropic',
        name: 'Claude 3 Sonnet',
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
        id: 'claude-3-haiku-20240307',
        provider: 'anthropic',
        name: 'Claude 3 Haiku',
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
        pricing: { inputTokens: 0.25, outputTokens: 1.25 }
    },

    // Google Gemini Models
    {
        id: 'gemini-2.0-flash-exp',
        provider: 'gemini',
        name: 'Gemini 2.0 Flash (Experimental)',
        contextWindow: 1048576, // 1M tokens
        capabilities: {
            streaming: true,
            functionCalling: true,
            vision: true,
            audio: true,
            embeddings: false,
            reasoning: true,
            video: true,
            documents: true
        },
        pricing: { inputTokens: 0.075, outputTokens: 0.30 }
    },
    {
        id: 'gemini-1.5-pro',
        provider: 'gemini',
        name: 'Gemini 1.5 Pro',
        contextWindow: 2097152, // 2M tokens
        capabilities: {
            streaming: true,
            functionCalling: true,
            vision: true,
            audio: true,
            embeddings: false,
            reasoning: false,
            video: true,
            documents: true
        },
        pricing: { inputTokens: 1.25, outputTokens: 5.00 }
    },
    {
        id: 'gemini-1.5-flash',
        provider: 'gemini',
        name: 'Gemini 1.5 Flash',
        contextWindow: 1048576, // 1M tokens
        capabilities: {
            streaming: true,
            functionCalling: true,
            vision: true,
            audio: true,
            embeddings: false,
            reasoning: false,
            video: true,
            documents: true
        },
        pricing: { inputTokens: 0.075, outputTokens: 0.30 }
    }
];
