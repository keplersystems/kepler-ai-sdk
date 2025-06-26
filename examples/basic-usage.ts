import {
    OpenAIProvider,
    AnthropicProvider,
    GeminiProvider,
    MistralProvider,
    CohereProvider,
    OpenRouterProvider,
    ModelManager,
    PricingCalculator,
    UsageTracker
} from '../src/index.js';

// Example: Basic usage of the Kepler AI SDK
async function basicExample() {
    console.log('🚀 Kepler AI SDK Example\n');

    // 1. Create provider instances for all supported providers
    const openai = new OpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key'
    });

    const anthropic = new AnthropicProvider({
        apiKey: process.env.ANTHROPIC_API_KEY || 'your-anthropic-api-key'
    });

    const gemini = new GeminiProvider({
        apiKey: process.env.GEMINI_API_KEY || 'your-gemini-api-key'
    });

    const mistral = new MistralProvider({
        apiKey: process.env.MISTRAL_API_KEY || 'your-mistral-api-key'
    });

    const cohere = new CohereProvider({
        apiKey: process.env.COHERE_API_KEY || 'your-cohere-api-key'
    });

    const openrouter = new OpenRouterProvider({
        apiKey: process.env.OPENROUTER_API_KEY || 'your-openrouter-api-key',
        siteUrl: 'https://your-site.com',
        appName: 'Kepler AI SDK Demo'
    });

    // 2. Set up model manager with all providers
    const modelManager = new ModelManager();
    modelManager.addProvider(openai);
    modelManager.addProvider(anthropic);
    modelManager.addProvider(gemini);
    modelManager.addProvider(mistral);
    modelManager.addProvider(cohere);
    modelManager.addProvider(openrouter);

    // 3. Set up pricing and usage tracking
    const pricingCalculator = new PricingCalculator();
    const usageTracker = new UsageTracker();

    try {
        // 4. List available models
        console.log('📋 Listing available models...');
        const models = await modelManager.listModels();
        console.log(`Found ${models.length} models across all providers`);

        // Show first few models
        models.slice(0, 5).forEach(model => {
            console.log(`  • ${model.id} (${model.provider}) - Context: ${model.contextWindow} tokens`);
        });

        // 5. Find models with specific capabilities
        console.log('\n🔍 Finding models with vision capabilities...');
        const visionModels = await modelManager.findModelsByCapability('vision');
        console.log(`Found ${visionModels.length} models with vision support:`);
        visionModels.slice(0, 3).forEach(model => {
            console.log(`  • ${model.id} (${model.provider})`);
        });

        // 6. Get the cheapest model
        console.log('\n💰 Finding cheapest model...');
        const cheapestModel = await modelManager.getCheapestModel();
        if (cheapestModel && cheapestModel.pricing) {
            console.log(`Cheapest model: ${cheapestModel.id} - $${cheapestModel.pricing.inputTokens}/M input tokens`);
        }

        // 7. Generate a completion (using OpenAI as example)
        console.log('\n🤖 Generating a completion...');
        const completionRequest = {
            model: 'gpt-4o-mini', // Using a cost-effective model
            messages: [
                {
                    role: 'user' as const,
                    content: 'Explain what a unified LLM SDK is in one sentence.'
                }
            ],
            temperature: 0.7,
            maxTokens: 100
        };

        const response = await openai.generateCompletion(completionRequest);
        console.log('Response:', response.content);

        // 8. Calculate cost
        const costBreakdown = await pricingCalculator.calculateCost(response.usage, response.model);
        if (costBreakdown) {
            console.log(`\n💵 Cost: $${costBreakdown.totalCost.toFixed(6)} (${response.usage.totalTokens} tokens)`);
        }

        // 9. Track usage
        usageTracker.trackUsage(response.model, response.usage, costBreakdown?.totalCost);

        // 10. Show usage statistics
        const usage = usageTracker.getUsage(response.model) as any;
        console.log(`\n📊 Usage for ${response.model}:`);
        console.log(`  Requests: ${usage.totalRequests}`);
        console.log(`  Total tokens: ${usage.totalTokens}`);
        console.log(`  Total cost: $${usage.totalCost.toFixed(6)}`);

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Example: Streaming completion
async function streamingExample() {
    console.log('\n\n🌊 Streaming Example\n');

    const openai = new OpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key'
    });

    try {
        const streamRequest = {
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'user' as const,
                    content: 'Write a haiku about artificial intelligence.'
                }
            ],
            temperature: 0.8,
            maxTokens: 50
        };

        console.log('🎭 Streaming response:');
        console.log('---');

        for await (const chunk of openai.streamCompletion(streamRequest)) {
            if (chunk.delta) {
                process.stdout.write(chunk.delta);
            }

            if (chunk.finished) {
                console.log('\n---');
                if (chunk.usage) {
                    console.log(`Tokens used: ${chunk.usage.totalTokens}`);
                }
                break;
            }
        }

    } catch (error) {
        console.error('❌ Streaming error:', error);
    }
}

// Example: Tool usage
async function toolExample() {
    console.log('\n\n🔧 Tool Usage Example\n');

    const openai = new OpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key'
    });

    try {
        const toolRequest = {
            model: 'gpt-4o',
            messages: [
                {
                    role: 'user' as const,
                    content: 'What\'s the weather like in San Francisco? Use the weather tool.'
                }
            ],
            tools: [
                {
                    name: 'get_weather',
                    description: 'Get the current weather for a city',
                    parameters: {
                        type: 'object' as const,
                        properties: {
                            city: {
                                type: 'string',
                                description: 'The city name'
                            },
                            unit: {
                                type: 'string',
                                description: 'Temperature unit',
                                enum: ['celsius', 'fahrenheit']
                            }
                        },
                        required: ['city']
                    }
                }
            ],
            toolChoice: 'auto' as const
        };

        const response = await openai.generateCompletion(toolRequest);

        if (response.toolCalls) {
            console.log('🔧 Model wants to use tools:');
            response.toolCalls.forEach(call => {
                console.log(`  • ${call.name}(${JSON.stringify(call.arguments)})`);
            });
        } else {
            console.log('📝 Response:', response.content);
        }

    } catch (error) {
        console.error('❌ Tool example error:', error);
    }
}

// Run examples
async function runExamples() {
    await basicExample();
    await streamingExample();
    await toolExample();
}

// Only run if this file is executed directly
if (import.meta.main) {
    runExamples().catch(console.error);
}
