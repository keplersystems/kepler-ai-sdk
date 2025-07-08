import { OAuthErrorType } from '../core/oauth';

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

    /** OAuth-specific error information */
    public readonly oauthError?: {
        type: OAuthErrorType;
        description?: string;
        uri?: string;
        provider?: string;
    };

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
        
        // Extract OAuth error information if present
        if (context?.type && typeof context.type === 'string') {
            const oauthErrorTypes: string[] = [
                'invalid_request', 'invalid_client', 'invalid_grant', 'unauthorized_client',
                'unsupported_grant_type', 'invalid_scope', 'access_denied', 'token_expired',
                'token_refresh_failed', 'authorization_pending', 'slow_down', 'expired_token'
            ];
            
            if (oauthErrorTypes.includes(context.type)) {
                const extendedContext = context as {
                    provider?: string;
                    statusCode?: number;
                    type?: string;
                    code?: string;
                    description?: string;
                    uri?: string;
                };
                
                this.oauthError = {
                    type: context.type as OAuthErrorType,
                    description: extendedContext.description,
                    uri: extendedContext.uri,
                    provider: context.provider
                };
            }
        }
    }

    /**
     * Check if this error is retryable
     * @returns true if the error might succeed on retry
     */
    isRetryable(): boolean {
        // OAuth-specific retryable errors
        if (this.oauthError?.type === 'authorization_pending') return true;
        if (this.oauthError?.type === 'slow_down') return true;
        
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
        // OAuth-specific messages
        if (this.oauthError) {
            switch (this.oauthError.type) {
                case 'access_denied':
                    return 'OAuth access denied. Please re-authenticate.';
                case 'token_expired':
                case 'expired_token':
                    return 'OAuth token expired. Please re-authenticate.';
                case 'token_refresh_failed':
                    return 'Failed to refresh OAuth token. Please re-authenticate.';
                case 'authorization_pending':
                    return 'OAuth authorization pending. Please complete the authorization process.';
                case 'invalid_client':
                    return 'Invalid OAuth client configuration.';
                case 'invalid_grant':
                    return 'Invalid OAuth grant. Please re-authenticate.';
                default:
                    return 'OAuth authentication error. Please re-authenticate.';
            }
        }
        
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
            context: this.context,
            oauthError: this.oauthError
        };
    }
    
    /**
     * Check if this error is OAuth-related
     */
    isOAuthError(): boolean {
        return this.oauthError !== undefined;
    }
    
    /**
     * Check if this error indicates expired tokens
     */
    isTokenExpired(): boolean {
        return this.oauthError?.type === 'token_expired' || this.oauthError?.type === 'expired_token';
    }
    
    /**
     * Check if this error indicates authentication is required
     */
    isAuthRequired(): boolean {
        return this.oauthError?.type === 'access_denied' || this.oauthError?.type === 'unauthorized_client';
    }
}
