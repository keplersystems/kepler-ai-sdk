/**
 * Base error class for all LLM-related errors
 * Provides structured error information and context
 */
export class LLMError extends Error {
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
