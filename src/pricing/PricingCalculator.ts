import type { TokenUsage, CompletionRequest } from '../core/interfaces.js';
import { MODEL_DATA } from '../models/model-data.js';

/**
 * Detailed cost breakdown for a completion
 */
export interface CostBreakdown {
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

/**
 * Calculates costs for LLM usage across different providers
 * Maintains pricing data that should be updated regularly
 */
export class PricingCalculator {
    /** Map of model ID to pricing information */
    constructor() { }

    /**
     * Calculate cost for a completed request
     * @param usage - Token usage from the request
     * @param modelId - Model that was used
     * @returns Promise resolving to cost breakdown or null if pricing unavailable
     */
    async calculateCost(usage: TokenUsage, modelId: string): Promise<CostBreakdown | null> {
        const model = MODEL_DATA.find(m => m.id === modelId);
        if (!model || !model.pricing) {
            console.warn(`No pricing data available for model: ${modelId}`);
            return null;
        }

        const pricing = model.pricing;

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
        const model = MODEL_DATA.find(m => m.id === request.model);
        if (!model || !model.pricing) return null;

        const pricing = model.pricing;

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

    /**
     * Get pricing for a specific model
     * @param modelId - Model to get pricing for
     * @returns Pricing information or undefined if not available
     */
    getPricing(modelId: string) {
        const model = MODEL_DATA.find(m => m.id === modelId);
        return model?.pricing;
    }

    /**
     * Get all available pricing data
     * @returns Array of model IDs with pricing
     */
    getAvailablePricing() {
        return MODEL_DATA
            .filter(model => model.pricing)
            .map(model => ({
                modelId: model.id,
                pricing: model.pricing!
            }));
    }

    /**
     * Load pricing data for all supported models
     * This should be updated regularly with current pricing
     */

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
