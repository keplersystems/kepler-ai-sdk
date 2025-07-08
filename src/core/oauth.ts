/**
 * OAuth token information
 */
export interface OAuthToken {
  /** Access token for API calls */
  accessToken: string;
  
  /** Refresh token for obtaining new access tokens */
  refreshToken?: string;
  
  /** Token expiration timestamp (Unix timestamp) */
  expiresAt?: number;
  
  /** Token type (typically 'Bearer') */
  tokenType?: string;
  
  /** Scopes granted to this token */
  scopes?: string[];
}

/**
 * Interface for token storage implementations
 * 
 * IMPORTANT: Applications must implement this interface themselves.
 * The SDK does not provide concrete implementations to give you full control
 * over how and where tokens are stored (database, Redis, file system, etc.).
 */
export interface TokenStorage {
  /**
   * Store OAuth tokens for a provider
   * @param provider - Provider name (e.g., 'anthropic', 'github-copilot')
   * @param tokens - OAuth tokens to store
   */
  storeTokens(provider: string, tokens: OAuthToken): Promise<void>;
  
  /**
   * Retrieve OAuth tokens for a provider
   * @param provider - Provider name
   * @returns Promise resolving to tokens or null if not found
   */
  getTokens(provider: string): Promise<OAuthToken | null>;
  
  /**
   * Remove OAuth tokens for a provider
   * @param provider - Provider name
   */
  removeTokens(provider: string): Promise<void>;
  
  /**
   * Check if tokens exist for a provider
   * @param provider - Provider name
   * @returns Promise resolving to true if tokens exist
   */
  hasTokens(provider: string): Promise<boolean>;
}

/**
 * OAuth configuration for a provider
 */
export interface OAuthConfig {
  /** Provider name (e.g., 'anthropic', 'github-copilot') */
  provider: string;
  
  /** OAuth client ID */
  clientId: string;
  
  /** OAuth client secret (optional for PKCE flows) */
  clientSecret?: string;
  
  /** OAuth scopes to request */
  scopes?: string[];
  
  /** Token storage implementation */
  tokenStorage: TokenStorage;
  
  /** Whether to automatically refresh tokens (default: true) */
  autoRefresh?: boolean;
}

/**
 * OAuth error types for structured error handling
 */
export type OAuthErrorType = 
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'unauthorized_client'
  | 'unsupported_grant_type'
  | 'invalid_scope'
  | 'access_denied'
  | 'token_expired'
  | 'token_refresh_failed'
  | 'authorization_pending'
  | 'slow_down'
  | 'expired_token'; 