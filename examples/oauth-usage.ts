import {
    AnthropicProvider,
    TokenStorage,
    OAuthToken,
    OAuthConfig
} from '../src/index';

/**
 * Example TokenStorage implementation
 * Your app should implement this with your preferred storage (database, Redis, etc.)
 */
class MyTokenStorage implements TokenStorage {
    private tokens = new Map<string, OAuthToken>();
    
    async storeTokens(provider: string, tokens: OAuthToken): Promise<void> {
        console.log(`💾 Storing tokens for ${provider}`);
        this.tokens.set(provider, tokens);
    }
    
    async getTokens(provider: string): Promise<OAuthToken | null> {
        return this.tokens.get(provider) || null;
    }
    
    async removeTokens(provider: string): Promise<void> {
        this.tokens.delete(provider);
    }
    
    async hasTokens(provider: string): Promise<boolean> {
        return this.tokens.has(provider);
    }
}

/**
 * Simple OAuth example
 */
async function simplifiedOAuthExample() {
    console.log('🚀 Simplified OAuth Example\n');
    
    // Method 1: API Key (simple)
    console.log('1️⃣  API Key Usage (unchanged):');
    const anthropicApiKey = new AnthropicProvider({
        apiKey: process.env.ANTHROPIC_API_KEY || 'your-api-key'
    });
    console.log('✅ Provider created with API key\n');
    
    // Method 2: OAuth (simple)
    console.log('2️⃣  OAuth Usage (simplified):');
    const myStorage = new MyTokenStorage(); // Your implementation
    
    const anthropicOAuth = new AnthropicProvider({
        oauth: {
            provider: 'anthropic', // Will be set automatically
            clientId: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
            tokenStorage: myStorage,
            scopes: ['org:create_api_key', 'user:profile', 'user:inference'],
            autoRefresh: true
        }
    });
    console.log('✅ Provider created with OAuth\n');
    
    try {
        // Check if we have OAuth tokens
        const hasTokens = await myStorage.hasTokens('anthropic');
        
        if (!hasTokens) {
            console.log('🔐 No OAuth tokens found. Starting authorization...');
            
            // Get OAuth authorization URL
            const authResult = await anthropicOAuth.getOAuthUrl();
            
            console.log('📋 Please visit:', authResult.authUrl);
            console.log('After authorization, call: provider.completeOAuth(code, codeVerifier)');
            console.log('Code Verifier:', authResult.codeVerifier);
            console.log('State:', authResult.state);
            
            console.log('\n🔧 To complete OAuth after authorization:');
            console.log('1. Visit the URL above and authorize the app');
            console.log('2. Copy the authorization code from the redirect URL');
            console.log('3. Run: await provider.completeOAuth("your-auth-code", "' + authResult.codeVerifier + '")');
            console.log('4. Then run this script again to test the API');
            
            return;
        }
        
        console.log('✅ Found OAuth tokens. Testing API...');
        
        // Use the OAuth provider just like API key provider
        const response = await anthropicOAuth.generateCompletion({
            model: 'claude-3-haiku-20240307',
            messages: [{ role: 'user', content: 'Hello! OAuth is working!' }],
            maxTokens: 50
        });
        
        console.log('🎉 OAuth Success!');
        console.log('Response:', response.content);
        console.log('💡 Using your Claude subscription quota, not paying extra!');
        
    } catch (error: any) {
        console.error('❌ Error:', error.message);
        
        if (error.isOAuthError && error.isOAuthError()) {
            console.log('OAuth error type:', error.oauthError?.type);
        }
    }
}

/**
 * Example showing how to complete OAuth with authorization code
 */
async function completeOAuthExample() {
    console.log('🔧 Complete OAuth Example\n');
    
    const myStorage = new MyTokenStorage();
    const anthropicOAuth = new AnthropicProvider({
        oauth: {
            provider: 'anthropic',
            clientId: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
            tokenStorage: myStorage,
            scopes: ['org:create_api_key', 'user:profile', 'user:inference'],
            autoRefresh: true
        }
    });
    
    // Replace these with your actual values from the authorization flow
    const authorizationCode = process.env.OAUTH_CODE || 'your-auth-code-here';
    const codeVerifier = process.env.CODE_VERIFIER || 'your-code-verifier-here';
    
    if (authorizationCode === 'your-auth-code-here') {
        console.log('❌ Please set OAUTH_CODE and CODE_VERIFIER environment variables');
        console.log('Example: OAUTH_CODE="abc123" CODE_VERIFIER="xyz789" bun run examples/oauth-usage.ts');
        return;
    }
    
    try {
        console.log('🔄 Exchanging authorization code for tokens...');
        await anthropicOAuth.completeOAuth(authorizationCode, codeVerifier);
        console.log('✅ OAuth completed successfully!');
        
        // Test the API
        console.log('🧪 Testing API with OAuth tokens...');
        const response = await anthropicOAuth.generateCompletion({
            model: 'claude-sonnet-4-20250514',
            messages: [{ role: 'user', content: 'Hello! OAuth is working!' }],
            maxTokens: 50
        });
        
        console.log('🎉 API call successful!');
        console.log('Response:', response.content);
        
    } catch (error: any) {
        console.error('❌ OAuth completion failed:', error.message);
        
        if (error.isOAuthError && error.isOAuthError()) {
            console.log('OAuth error type:', error.oauthError?.type);
        }
    }
}

// Run the appropriate example based on environment variables
if (process.env.OAUTH_CODE && process.env.CODE_VERIFIER) {
    completeOAuthExample().catch(console.error);
} else {
    simplifiedOAuthExample().catch(console.error);
} 