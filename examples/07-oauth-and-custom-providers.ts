/**
 * --- 07. OAUTH & CUSTOM PROVIDERS ---
 *
 * This example demonstrates advanced features of the Kepler AI SDK, including:
 * 1.  Using OAuth for authentication with providers that support it.
 * 2.  Creating a custom provider to add support for a new LLM service.
 *
 * --- OAUTH ---
 *
 * OAuth is a common authentication method for services like Google Gemini or
 * GitHub Copilot. The SDK provides an `OAuth` helper class to manage the
 * token lifecycle (e.g., refreshing expired tokens).
 *
 * --- CUSTOM PROVIDERS ---
 *
 * You can extend the SDK by creating your own provider adapter. This is useful
 * if you want to add support for an LLM service that isn't built-in, or if
 * you want to customize the behavior of an existing provider.
 *
 * This example includes a mock custom provider to illustrate the process.
 */

import {
    OAuth,
    OAuthConfig,
    TokenStorage,
    ProviderAdapter,
    CompletionRequest,
    CompletionResponse,
    ModelInfo,
    ModelCapabilities,
    LLMError,
    CompletionChunk,
    OAuthToken,
} from "../src/index";

// --- 1. OAUTH EXAMPLE ---

/**
 * A simple in-memory token storage for the OAuth example.
 * In a real application, you would use a more persistent storage
 * mechanism, like a file or a database.
 */
class InMemoryTokenStorage implements TokenStorage {
    private store = new Map<string, OAuthToken>();

    async storeTokens(provider: string, tokens: OAuthToken): Promise<void> {
        this.store.set(provider, tokens);
    }

    async getTokens(provider: string): Promise<OAuthToken | null> {
        return this.store.get(provider) || null;
    }

    async removeTokens(provider: string): Promise<void> {
        this.store.delete(provider);
    }

    async hasTokens(provider: string): Promise<boolean> {
        return this.store.has(provider);
    }
}

async function oauthExample() {
    console.log("\n--- OAUTH EXAMPLE ---");

    // This example uses the 'github-copilot' provider for the device flow.
    const provider = "github-copilot";
    const tokenStorage = new InMemoryTokenStorage();

    const oauthConfig: OAuthConfig = {
        provider,
        clientId: "Iv1.b507a08c87ecfe98", // Default client ID for GitHub Copilot
        scopes: ["read:user"],
        tokenStorage,
    };

    const oauth = new OAuth(oauthConfig);

    try {
        // 1. Initiate the device flow
        console.log(`\n1. Initiating OAuth device flow for ${provider}...`);
        const { authUrl, deviceCode } = await oauth.initiateAuth();

        if (deviceCode) {
            console.log(
                `\n2. To authorize, open this URL in your browser:\n   ${authUrl}`
            );
            console.log(`   And enter this code: ${deviceCode.userCode}`);

            // 3. Poll for authorization
            // In a real application, you would do this in the background.
            console.log("\n3. Polling for authorization...");
            await oauth.pollForDeviceAuth(deviceCode.deviceCode, deviceCode.interval);

            // 4. Get the access token
            const accessToken = await oauth.getAccessToken();
            console.log("\n✅ Authorization successful!");
            console.log(`   - Access Token (first 10 chars): ${accessToken.slice(0, 10)}...`);
        }
    } catch (error) {
        if (error instanceof LLMError && error.isOAuthError()) {
            console.error(`\n❌ OAuth Error: ${error.message}`);
            console.error(`   - Type: ${error.oauthError?.type}`);
        } else if (error instanceof Error) {
            console.error(`\n❌ An unexpected error occurred: ${error.message}`);
        } else {
            console.error("\n❌ An unknown error occurred.", error);
        }
    }
}

// --- 2. CUSTOM PROVIDER EXAMPLE ---

/**
 * A mock provider that simulates a custom LLM service.
 */
class MockCustomProvider implements ProviderAdapter {
    readonly name = "mock-custom-provider";

    async listModels(): Promise<ModelInfo[]> {
        const capabilities: ModelCapabilities = {
            streaming: true,
            functionCalling: false,
            vision: false,
            audio: false,
            embeddings: false,
            reasoning: false,
        };

        return [
            {
                id: "mock-model-1",
                name: "Mock Model 1",
                provider: this.name,
                contextWindow: 4096,
                capabilities,
            },
        ];
    }

    async getModel(modelId: string): Promise<ModelInfo | null> {
        const models = await this.listModels();
        return models.find((m) => m.id === modelId) || null;
    }

    async generateCompletion(
        request: CompletionRequest
    ): Promise<CompletionResponse> {
        if (request.model !== "mock-model-1") {
            throw new LLMError("Model not found", new Error(), {
                type: "NOT_FOUND",
            });
        }

        return {
            id: `cmpl-${Date.now()}`,
            content: "This is a response from the mock custom provider.",
            model: request.model,
            usage: {
                promptTokens: 10,
                completionTokens: 8,
                totalTokens: 18,
            },
            finishReason: "stop",
        };
    }

    async *streamCompletion(
        request: CompletionRequest
    ): AsyncIterable<CompletionChunk> {
        const responseText = "This is a streamed response from the mock provider.";
        for (const char of responseText) {
            yield {
                id: `chunk-${Date.now()}`,
                delta: char,
                finished: false,
            };
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        yield {
            id: `chunk-${Date.now()}`,
            delta: "",
            finished: true,
            usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        };
    }
}

async function customProviderExample() {
    console.log("\n--- CUSTOM PROVIDER EXAMPLE ---");

    const customProvider = new MockCustomProvider();

    try {
        console.log("\n1. Listing models from the custom provider...");
        const models = await customProvider.listModels();
        console.log(models);

        console.log("\n2. Generating a completion from the custom provider...");
        const response = await customProvider.generateCompletion({
            model: "mock-model-1",
            messages: [{ role: "user", content: "Hello, custom provider!" }],
        });
        console.log(response.content);

        console.log("\n3. Streaming a completion from the custom provider...");
        for await (const chunk of customProvider.streamCompletion({
            model: "mock-model-1",
            messages: [{ role: "user", content: "Stream, please!" }],
        })) {
            process.stdout.write(chunk.delta);
        }
        console.log();
    } catch (error) {
        if (error instanceof Error) {
            console.error(`\n❌ An error occurred: ${error.message}`);
        } else {
            console.error("\n❌ An unknown error occurred.", error);
        }
    }
}

async function main() {
    // We are commenting out the oauthExample because it requires user interaction
    // and will cause the script to hang.
    // await oauthExample();
    await customProviderExample();
}

if (import.meta.main) {
    main();
}
