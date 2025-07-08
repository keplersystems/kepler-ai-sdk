# 🔌 OAuth & Custom Providers

This guide covers advanced features of the Kepler AI SDK, including using OAuth for authentication and creating custom providers to support new LLM services.

## 🔐 OAuth

OAuth is a common authentication method for services like Google Gemini or GitHub Copilot. The SDK provides an `OAuth` helper class to manage the token lifecycle.

### How it works

1.  **Implement `TokenStorage`**: Create a class that implements the `TokenStorage` interface to handle storing and retrieving OAuth tokens.
2.  **Configure `OAuthConfig`**: Create an `OAuthConfig` object with the provider name, client ID, scopes, and your token storage implementation.
3.  **Initiate the OAuth flow**: Use the `initiateAuth` method on the `OAuth` class to get the authorization URL and other details.
4.  **Poll for authorization**: For device flows, use the `pollForDeviceAuth` method to wait for the user to complete the authorization.
5.  **Get the access token**: Use the `getAccessToken` method to retrieve the access token, which will be automatically refreshed when it expires.

The following example demonstrates the device flow for the `github-copilot` provider.

```typescript
import {
  OAuth,
  OAuthConfig,
  TokenStorage,
  OAuthToken,
  LLMError,
} from "kepler-ai-sdk";

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
  const provider = "github-copilot";
  const tokenStorage = new InMemoryTokenStorage();

  const oauthConfig: OAuthConfig = {
    provider,
    clientId: "Iv1.b507a08c87ecfe98",
    scopes: ["read:user"],
    tokenStorage,
  };

  const oauth = new OAuth(oauthConfig);

  const { authUrl, deviceCode } = await oauth.initiateAuth();

  if (deviceCode) {
    console.log(
      `\nTo authorize, open this URL in your browser:\n   ${authUrl}`
    );
    console.log(`And enter this code: ${deviceCode.userCode}`);

    await oauth.pollForDeviceAuth(deviceCode.deviceCode, deviceCode.interval);

    const accessToken = await oauth.getAccessToken();
    console.log("\n✅ Authorization successful!");
  }
}
```

> [!WARNING]
> The OAuth example requires user interaction and will cause the script to hang if run directly. It is commented out in the example file.

## 📦 Custom Providers

You can extend the SDK by creating your own provider adapter. This is useful if you want to add support for an LLM service that isn't built-in.

### How it works

Create a class that implements the `ProviderAdapter` interface. You will need to implement the following methods:

-   `listModels`
-   `getModel`
-   `generateCompletion`
-   `streamCompletion`

The following example demonstrates how to create a mock custom provider.

```typescript
import {
  ProviderAdapter,
  CompletionRequest,
  CompletionResponse,
  ModelInfo,
  ModelCapabilities,
  LLMError,
  CompletionChunk,
} from "kepler-ai-sdk";

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
```

> [!TIP]
> To run this example, you can execute the file using `bun run`:
>
> ```bash
> bun run examples/07-oauth-and-custom-providers.ts
