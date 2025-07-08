import {
    GitHubCopilotProvider,
    TokenStorage,
    OAuthToken,
    OAuth,
} from '../src/index';

/**
 * Test TokenStorage implementation that doesn't persist tokens
 * This allows testing the OAuth flow repeatedly
 */
class TestTokenStorage implements TokenStorage {
    private tempTokens = new Map<string, OAuthToken>();
    
    async storeTokens(provider: string, tokens: OAuthToken): Promise<void> {
        this.tempTokens.set(provider, tokens);
    }
    
    async getTokens(provider: string): Promise<OAuthToken | null> {
        return this.tempTokens.get(provider) || null;
    }
    
    async removeTokens(provider: string): Promise<void> {
        this.tempTokens.delete(provider);
    }
    
    async hasTokens(provider: string): Promise<boolean> {
        return this.tempTokens.has(provider);
    }
}

/**
 * GitHub Copilot device flow example
 */
async function deviceFlowExample() {
    console.log('🚀 GitHub Copilot Device Flow Example\n');
    
    const testStorage = new TestTokenStorage();
    const copilotProvider = new GitHubCopilotProvider({
        oauth: {
            provider: 'github-copilot',
            clientId: 'Iv1.b507a08c87ecfe98',
            tokenStorage: testStorage,
            scopes: ['read:user'],
            autoRefresh: true
        }
    });
    
    try {
        console.log('🔐 Starting GitHub Copilot device flow...');
        
        // GitHub Copilot uses device flow
        const authResult = await copilotProvider.initiateOAuth();
        
        if ('deviceCode' in authResult) {
            console.log('📱 GitHub Copilot Device Flow:');
            console.log('1. Visit:', authResult.deviceCode.verificationUrl);
            console.log('2. Enter code:', authResult.deviceCode.userCode);
            console.log('3. Click "Authorize" when prompted');
            console.log(`⏰ You have ${Math.floor(authResult.deviceCode.expiresIn / 60)} minutes to complete this\n`);
            
            try {
                // Create OAuth instance to poll
                const oauth = new OAuth({
                    provider: 'github-copilot',
                    clientId: 'Iv1.b507a08c87ecfe98',
                    tokenStorage: testStorage,
                    scopes: ['read:user'],
                    autoRefresh: true
                });
                
                await oauth.pollForDeviceAuth(
                    authResult.deviceCode.deviceCode, 
                    authResult.deviceCode.interval
                );
                
                console.log('✅ Authorization completed! Tokens stored.');
                
                // Test the API
                console.log('🧪 Testing GitHub Copilot API...');
                const response = await copilotProvider.generateCompletion({
                    model: 'gpt-4o',
                    messages: [{ 
                        role: 'user', 
                        content: 'Help me write a Python function to calculate fibonacci numbers' 
                    }],
                    maxTokens: 200
                });
                
                console.log('🎉 GitHub Copilot Success!');
                console.log('Response:', response.content);
                console.log('💡 Using your GitHub Copilot subscription!');
                
            } catch (error: any) {
                console.error('❌ Polling failed:', error.message);
            }
        }
        
    } catch (error: any) {
        console.error('❌ Error:', error.message);
        
        if (error.isOAuthError && error.isOAuthError()) {
            console.log('OAuth error type:', error.oauthError?.type);
        }
    }
}

/**
 * GitHub Copilot manual token example
 */
async function manualTokenExample() {
    console.log('🔧 GitHub Copilot Manual Token Example\n');
    
    const testStorage = new TestTokenStorage();
    const copilotProvider = new GitHubCopilotProvider({
        oauth: {
            provider: 'github-copilot',
            clientId: 'Iv1.b507a08c87ecfe98',
            tokenStorage: testStorage,
            scopes: ['read:user'],
            autoRefresh: true
        }
    });
    
    const accessToken = process.env.GITHUB_TOKEN || 'your-github-token-here';
    
    if (accessToken === 'your-github-token-here') {
        console.log('❌ Please set GITHUB_TOKEN environment variable');
        console.log('Example: GITHUB_TOKEN="gho_xxxx" bun run examples/github-copilot-example.ts');
        return;
    }
    
    try {
        // Manually store the token
        await testStorage.storeTokens('github-copilot', {
            accessToken: accessToken,
            tokenType: 'bearer',
            expiresAt: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
        });
        
        console.log('✅ Manual token stored. Testing GitHub Copilot API...');
        
        // Test the API
        const response = await copilotProvider.generateCompletion({
            model: 'gpt-4o',
            messages: [{ 
                role: 'user', 
                content: 'Help me write a Python function to calculate fibonacci numbers' 
            }],
            maxTokens: 200
        });
        
        console.log('🎉 GitHub Copilot Success!');
        console.log('Response:', response.content);
        console.log('💡 Using your GitHub Copilot subscription!');
        
    } catch (error: any) {
        console.error('❌ Error:', error.message);
        
        if (error.isOAuthError && error.isOAuthError()) {
            console.log('OAuth error type:', error.oauthError?.type);
        }
    }
}

// Run the appropriate example based on environment variables
if (process.env.GITHUB_TOKEN) {
    manualTokenExample().catch(console.error);
} else {
    deviceFlowExample().catch(console.error);
} 