import { OAuthToken, OAuthConfig, OAuthErrorType } from '../core/oauth.js';
import { LLMError } from '../errors/LLMError.js';

/**
 * OAuth API response types
 */
interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

interface TokenErrorResponse {
  error: string | {
    type: string;
    message: string;
  };
  error_description?: string;
  error_uri?: string;
}

/**
 * Provider-specific OAuth configurations
 */
interface PKCEProviderConfig {
  authUrl: string;
  tokenUrl: string;
  redirectUri: string;
  flow: 'pkce';
  defaultClientId: string;
  defaultScopes: string[];
}

interface DeviceProviderConfig {
  authUrl: string;
  tokenUrl: string;
  flow: 'device';
  defaultClientId: string;
  defaultScopes: string[];
}

type ProviderConfig = PKCEProviderConfig | DeviceProviderConfig;

const OAUTH_PROVIDERS: Record<string, ProviderConfig> = {
  anthropic: {
    authUrl: 'https://claude.ai/oauth/authorize',
    tokenUrl: 'https://console.anthropic.com/v1/oauth/token',
    redirectUri: 'https://console.anthropic.com/oauth/code/callback',
    flow: 'pkce',
    defaultClientId: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
    defaultScopes: ['org:create_api_key', 'user:profile', 'user:inference']
  },
  'github-copilot': {
    authUrl: 'https://github.com/login/device/code',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    flow: 'device',
    defaultClientId: 'Iv1.b507a08c87ecfe98',
    defaultScopes: ['read:user']
  }
};

type SupportedProvider = keyof typeof OAUTH_PROVIDERS;

/**
 * OAuth class that handles all provider flows
 */
export class OAuth {
  private config: OAuthConfig;
  private providerConfig: ProviderConfig;
  
  constructor(config: OAuthConfig) {
    this.config = config;
    this.providerConfig = OAUTH_PROVIDERS[config.provider as SupportedProvider];
    
    if (!this.providerConfig) {
      throw new LLMError(
        `Unsupported OAuth provider: ${config.provider}`,
        undefined,
        { provider: config.provider, type: 'invalid_client' }
      );
    }
  }
  
  /**
   * Initiate OAuth authorization flow
   */
  async initiateAuth(): Promise<{ authUrl: string; deviceCode?: any; codeVerifier?: string }> {
    if (this.providerConfig.flow === 'pkce') {
      return this.initiatePKCEFlow();
    } else {
      return this.initiateDeviceFlow();
    }
  }
  
  
  /**
   * Complete OAuth authorization
   */
  async completeAuth(code: string, codeVerifier?: string): Promise<void> {
    const tokens = await this.exchangeCodeForTokens(code, codeVerifier);
    await this.config.tokenStorage.storeTokens(this.config.provider, tokens);
  }
  
  /**
   * Poll for device code completion (for device flows)
   */
  async pollForDeviceAuth(deviceCode: string, interval: number = 5): Promise<void> {
    const endTime = Date.now() + (15 * 60 * 1000); // 15 minutes
    
    let attemptCount = 0;
    while (Date.now() < endTime) {
      attemptCount++;
      
      try {
        const tokens = await this.checkDeviceCodeStatus(deviceCode);
        await this.config.tokenStorage.storeTokens(this.config.provider, tokens);
        return;
      } catch (error: any) {
        if (error.oauthError?.type === 'authorization_pending') {
          await this.sleep(interval * 1000);
          continue;
        }
        if (error.oauthError?.type === 'slow_down') {
          const waitTime = interval + 5;
          await this.sleep(waitTime * 1000);
          continue;
        }
        throw error;
      }
    }
    
    throw new LLMError(
      'Device code authorization timed out',
      undefined,
      { provider: this.config.provider, type: 'expired_token' }
    );
  }
  
  /**
   * Get valid access token (with automatic refresh)
   */
  async getAccessToken(): Promise<string> {
    const tokens = await this.config.tokenStorage.getTokens(this.config.provider);
    
    if (!tokens) {
      throw new LLMError(
        'No OAuth tokens found. Please authenticate first.',
        undefined,
        { provider: this.config.provider, type: 'access_denied' }
      );
    }
    
    // For GitHub Copilot, we need to exchange the OAuth token for a Copilot API token
    if (this.config.provider === 'github-copilot') {
      return await this.getCopilotApiToken(tokens.accessToken);
    }
    
    // Check if token is still valid
    if (this.isTokenValid(tokens)) {
      return tokens.accessToken;
    }
    
    // Try to refresh if auto-refresh is enabled
    if (this.config.autoRefresh !== false && tokens.refreshToken) {
      const newTokens = await this.refreshToken(tokens.refreshToken);
      await this.config.tokenStorage.storeTokens(this.config.provider, newTokens);
      return newTokens.accessToken;
    }
    
    throw new LLMError(
      'OAuth tokens have expired and cannot be refreshed',
      undefined,
      { provider: this.config.provider, type: 'token_expired' }
    );
  }

  
  // Private methods for different OAuth flows
  
  /**
   * Exchange GitHub OAuth token for Copilot API token
   */
  private async getCopilotApiToken(oauthToken: string): Promise<string> {
    const response = await fetch('https://api.github.com/copilot_internal/v2/token', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${oauthToken}`,
        'User-Agent': 'GitHubCopilotChat/0.26.7',
        'Editor-Version': 'vscode/1.99.3',
        'Editor-Plugin-Version': 'copilot-chat/0.26.7',
        'Copilot-Integration-Id': 'vscode-chat'
      }
    });
    
    if (!response.ok) {
      throw new LLMError(
        `GitHub Copilot API token exchange failed: ${response.statusText}`,
        undefined,
        { provider: this.config.provider, statusCode: response.status }
      );
    }
    
    const data = await response.json() as {
      token: string;
      expires_at: number;
      refresh_in: number;
      endpoints: {
        api: string;
      };
    };
    
    return data.token;
  }
  
  private async initiatePKCEFlow() {
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    
    // Build URL manually to ensure proper encoding and avoid truncation
    const baseUrl = this.providerConfig.authUrl;
    const clientId = this.config.clientId || this.providerConfig.defaultClientId;
    const redirectUri = encodeURIComponent((this.providerConfig as PKCEProviderConfig).redirectUri);
    const scope = encodeURIComponent((this.config.scopes || this.providerConfig.defaultScopes).join(' '));
    
    const authUrl = `${baseUrl}?` + [
      `code=true`,
      `client_id=${clientId}`,
      `response_type=code`,
      `redirect_uri=${redirectUri}`,
      `scope=${scope}`,
      `code_challenge=${codeChallenge}`,
      `code_challenge_method=S256`,
      `state=${codeVerifier}`
    ].join('&');
    
    return {
      authUrl,
      codeVerifier
    };
  }
  
  private async initiateDeviceFlow() {
    const params = new URLSearchParams({
      client_id: this.config.clientId || this.providerConfig.defaultClientId,
      scope: (this.config.scopes || this.providerConfig.defaultScopes).join(' ')
    });
    
    const response = await fetch(this.providerConfig.authUrl, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    
    if (!response.ok) {
      throw new LLMError(
        `Device code request failed: ${response.statusText}`,
        undefined,
        { provider: this.config.provider, statusCode: response.status }
      );
    }
    
    const data = await response.json() as DeviceCodeResponse;
    
    return {
      authUrl: data.verification_uri,
      deviceCode: {
        deviceCode: data.device_code,
        userCode: data.user_code,
        verificationUrl: data.verification_uri,
        interval: data.interval || 5,
        expiresIn: data.expires_in || 900
      }
    };
  }
  
  private async exchangeCodeForTokens(code: string, codeVerifier?: string): Promise<OAuthToken> {
    // Handle code that might come with hash fragments (like from Anthropic)
    const splits = code.split('#');
    const actualCode = splits[0];
    const state = splits.length > 1 ? splits[1] : undefined;
    
    if (this.providerConfig.flow === 'pkce') {
      // Anthropic uses JSON format for token exchange (match SST reference implementation)
      const tokenData: any = {
        code: actualCode,
        grant_type: 'authorization_code',
        client_id: this.config.clientId || this.providerConfig.defaultClientId,
        redirect_uri: (this.providerConfig as PKCEProviderConfig).redirectUri,
        code_verifier: codeVerifier!
      };
      
      // Include state if it exists (from hash fragment)
      if (state) {
        tokenData.state = state;
      }
      
      const response = await fetch(this.providerConfig.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tokenData)
      });
      
      const result = await response.json() as TokenResponse | TokenErrorResponse;
      
      if (!response.ok) {
        const errorResult = result as TokenErrorResponse;
        // Handle nested error structure like {"type":"error","error":{"type":"invalid_request_error","message":"Invalid request format"}}
        let errorMessage: string;
        let errorType: string;
        
        if (errorResult.error_description) {
          errorMessage = errorResult.error_description;
          errorType = typeof errorResult.error === 'string' ? errorResult.error : 'invalid_grant';
        } else if (typeof errorResult.error === 'object' && errorResult.error.message) {
          errorMessage = errorResult.error.message;
          errorType = errorResult.error.type;
        } else if (typeof errorResult.error === 'string') {
          errorMessage = errorResult.error;
          errorType = errorResult.error;
        } else {
          errorMessage = response.statusText;
          errorType = 'invalid_grant';
        }
        
        throw new LLMError(
          `Token exchange failed: ${errorMessage}`,
          undefined,
          { provider: this.config.provider, type: errorType, statusCode: response.status }
        );
      }
      
      const tokenResult = result as TokenResponse;
      return {
        accessToken: tokenResult.access_token,
        refreshToken: tokenResult.refresh_token,
        tokenType: tokenResult.token_type || 'Bearer',
        expiresAt: tokenResult.expires_in ? Math.floor(Date.now() / 1000) + tokenResult.expires_in : undefined,
        scopes: tokenResult.scope ? tokenResult.scope.split(' ') : this.config.scopes
      };
    } else {
      // Device flow uses form-encoded data
      const tokenData: Record<string, string> = {
        grant_type: 'authorization_code',
        client_id: this.config.clientId || this.providerConfig.defaultClientId,
        code: actualCode
      };
      
      const response = await fetch(this.providerConfig.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
        body: new URLSearchParams(tokenData).toString()
      });
      
      const result = await response.json() as TokenResponse | TokenErrorResponse;
      
      if (!response.ok) {
        const errorResult = result as TokenErrorResponse;
        const errorType = typeof errorResult.error === 'string' ? errorResult.error : 'invalid_grant';
        throw new LLMError(
          `Token exchange failed: ${errorResult.error_description || response.statusText}`,
          undefined,
          { provider: this.config.provider, type: errorType, statusCode: response.status }
        );
      }
      
      const tokenResult = result as TokenResponse;
      return {
        accessToken: tokenResult.access_token,
        refreshToken: tokenResult.refresh_token,
        tokenType: tokenResult.token_type || 'Bearer',
        expiresAt: tokenResult.expires_in ? Math.floor(Date.now() / 1000) + tokenResult.expires_in : undefined,
        scopes: tokenResult.scope ? tokenResult.scope.split(' ') : this.config.scopes
      };
    }
  }
  
  private async checkDeviceCodeStatus(deviceCode: string): Promise<OAuthToken> {
    // Use the same headers as opencode reference for GitHub Copilot
    const headers: Record<string, string> = this.config.provider === 'github-copilot' 
      ? {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'GitHubCopilotChat/0.26.7'
        }
      : {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        };
    
    const body = this.config.provider === 'github-copilot'
      ? JSON.stringify({
          client_id: this.config.clientId || this.providerConfig.defaultClientId,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      : new URLSearchParams({
          client_id: this.config.clientId || this.providerConfig.defaultClientId,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        }).toString();
    
    const response = await fetch(this.providerConfig.tokenUrl, {
      method: 'POST',
      headers,
      body
    });
    
    if (!response.ok) {
      throw new LLMError(
        `Device code check failed: ${response.statusText}`,
        undefined,
        { provider: this.config.provider, type: 'request_failed', statusCode: response.status }
      );
    }
    
    const data = await response.json() as TokenResponse | TokenErrorResponse;
    
    // Check for access token (success case)
    if ('access_token' in data && data.access_token) {
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        tokenType: data.token_type || 'Bearer',
        expiresAt: data.expires_in ? Math.floor(Date.now() / 1000) + data.expires_in : undefined,
        scopes: data.scope ? data.scope.split(' ') : this.config.scopes
      };
    }
    
    // Check for errors
    const errorData = data as TokenErrorResponse;
    const errorMessage = errorData.error_description || 
                        (typeof errorData.error === 'string' ? errorData.error : 
                         typeof errorData.error === 'object' ? errorData.error.message : 'Unknown error');
    const errorType = typeof errorData.error === 'string' ? errorData.error : 
                     typeof errorData.error === 'object' ? errorData.error.type : 'invalid_grant';
    
    const errorMetadata = { 
      provider: this.config.provider, 
      type: errorType, 
      statusCode: response.status 
    };
    
    throw new LLMError(
      `Device code check failed: ${errorMessage}`,
      undefined,
      errorMetadata
    );
  }
  
  private async refreshToken(refreshToken: string): Promise<OAuthToken> {
    const tokenData = {
      grant_type: 'refresh_token',
      client_id: this.config.clientId || this.providerConfig.defaultClientId,
      refresh_token: refreshToken
    };
    
    // Anthropic uses JSON format, others might use form-encoded
    const isAnthropic = this.config.provider === 'anthropic';
    const headers: Record<string, string> = isAnthropic 
      ? { 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' };
    const body = isAnthropic 
      ? JSON.stringify(tokenData)
      : new URLSearchParams(tokenData).toString();
    
    const response = await fetch(this.providerConfig.tokenUrl, {
      method: 'POST',
      headers,
      body
    });
    
    const result = await response.json() as TokenResponse | TokenErrorResponse;
    
    if (!response.ok) {
      const errorResult = result as TokenErrorResponse;
      const errorType = typeof errorResult.error === 'string' ? errorResult.error : 'token_refresh_failed';
      throw new LLMError(
        `Token refresh failed: ${errorResult.error_description || response.statusText}`,
        undefined,
        { provider: this.config.provider, type: errorType, statusCode: response.status }
      );
    }
    
    const tokenResult = result as TokenResponse;
    return {
      accessToken: tokenResult.access_token,
      refreshToken: tokenResult.refresh_token || refreshToken,
      tokenType: tokenResult.token_type || 'Bearer',
      expiresAt: tokenResult.expires_in ? Math.floor(Date.now() / 1000) + tokenResult.expires_in : undefined,
      scopes: tokenResult.scope ? tokenResult.scope.split(' ') : this.config.scopes
    };
  }
  
  private isTokenValid(tokens: OAuthToken): boolean {
    if (!tokens.expiresAt) return true;
    const now = Math.floor(Date.now() / 1000);
    return tokens.expiresAt > (now + 300); // 5 minute buffer
  }
  
  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64URLEncode(array);
  }
  
  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return this.base64URLEncode(new Uint8Array(digest));
  }
  
  private generateState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return this.base64URLEncode(array);
  }
  
  private base64URLEncode(array: Uint8Array): string {
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 