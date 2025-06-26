import type { TokenUsage } from '../core/interfaces.js';

/**
 * Usage statistics for a model or time period
 */
export interface UsageStats {
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
export interface RequestRecord {
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
export interface UsageTrend {
    /** Timestamp for this data point */
    timestamp: Date;

    /** Number of requests in this interval */
    requests: number;

    /** Total tokens in this interval */
    tokens: number;

    /** Total cost in this interval */
    cost: number;
}

/**
 * Tracks usage statistics across models and time periods
 * Provides insights into costs and token consumption
 */
export class UsageTracker {
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

        // Calculate averages
        updated.averageTokensPerRequest = updated.totalTokens / updated.totalRequests;
        updated.averageCostPerRequest = updated.totalCost / updated.totalRequests;

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

        const aggregated = allUsage.reduce((agg, usage) => ({
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

        // Calculate averages
        if (aggregated.totalRequests > 0) {
            aggregated.averageTokensPerRequest = aggregated.totalTokens / aggregated.totalRequests;
            aggregated.averageCostPerRequest = aggregated.totalCost / aggregated.totalRequests;
        }

        return aggregated;
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
