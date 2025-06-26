import type { ProviderAdapter, ModelInfo, ModelCapabilities } from '../core/interfaces.js';
import { LLMError } from '../errors/LLMError.js';

/**
 * Manages models across all providers with intelligent caching
 * Handles model discovery, capability detection, and metadata management
 */
export class ModelManager {
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
