import {
    GeminiProvider,
    ModelManager,
    PricingCalculator,
    UsageTracker
} from '../src/index.js';

// Example: Using all new providers
async function newProvidersExample() {
    console.log('🚀 New Providers Example\n');

    // 1. Initialize all new providers
    const gemini = new GeminiProvider({
        apiKey: process.env.GEMINI_API_KEY || 'your-gemini-api-key'
    });

    // 2. Set up model manager with all providers
    const modelManager = new ModelManager();
    modelManager.addProvider(gemini);

    const pricingCalculator = new PricingCalculator();
    const usageTracker = new UsageTracker();

    try {
        // 3. List all available models
        console.log('📋 Listing models from all new providers...');
        const allModels = await modelManager.listModels();
        console.log(`Found ${allModels.length} models across all providers`);

        // Show models by provider
        const providers = ['gemini'];
        for (const provider of providers) {
            const providerModels = allModels.filter(m => m.provider === provider);
            console.log(`  ${provider}: ${providerModels.length} models`);
            if (providerModels.length > 0) {
                console.log(`    Example: ${providerModels[0].id} (${providerModels[0].contextWindow} tokens)`);
            }
        }

        // 4. Find models with large context windows (1M+ tokens)
        console.log('\n🔍 Finding models with large context windows (1M+ tokens)...');
        const largeContextModels = allModels.filter(model => model.contextWindow >= 1000000);
        console.log(`Found ${largeContextModels.length} models with 1M+ token context:`);
        largeContextModels.slice(0, 3).forEach(model => {
            console.log(`  • ${model.id} (${model.provider}) - ${(model.contextWindow / 1000000).toFixed(1)}M tokens`);
        });

        // 5. Find models with video capabilities
        console.log('\n🎥 Finding models with video capabilities...');
        const videoModels = await modelManager.findModelsByCapability('video');
        console.log(`Found ${videoModels.length} models with video support:`);
        videoModels.forEach(model => {
            console.log(`  • ${model.id} (${model.provider})`);
        });

        // 6. Generate completions with different providers
        console.log('\n🤖 Testing completions across providers...');

        // Test Gemini (large context)
        if (process.env.GEMINI_API_KEY) {
            try {
                console.log('\n🔮 Gemini 1.5 Flash:');
                const geminiResponse = await gemini.generateCompletion({
                    model: 'gemini-1.5-flash',
                    messages: [
                        { role: 'user', content: 'Explain quantum computing in simple terms.' }
                    ],
                    temperature: 0.7,
                    maxTokens: 100
                });
                console.log(`Response: ${geminiResponse.content.substring(0, 150)}...`);
                console.log(`Tokens: ${geminiResponse.usage.totalTokens}`);

                // Track usage
                const cost = await pricingCalculator.calculateCost(geminiResponse.usage, geminiResponse.model);
                usageTracker.trackUsage(geminiResponse.model, geminiResponse.usage, cost?.totalCost);
            } catch (error) {
                console.log('Gemini test skipped (likely missing API key)');
            }
        }

        // 7. Show usage statistics
        console.log('\n📊 Usage Statistics:');
        const aggregatedStats = usageTracker.getAggregatedUsage();
        if (aggregatedStats.totalRequests > 0) {
            console.log(`Total requests: ${aggregatedStats.totalRequests}`);
            console.log(`Total tokens: ${aggregatedStats.totalTokens}`);
            console.log(`Total cost: $${aggregatedStats.totalCost.toFixed(6)}`);
        } else {
            console.log('No successful requests tracked (likely due to missing API keys)');
        }

        // 8. Find most cost-effective model
        console.log('\n💰 Most cost-effective models:');
        const cheapestModel = await modelManager.getCheapestModel(['streaming']);
        if (cheapestModel && cheapestModel.pricing) {
            console.log(`Cheapest with streaming: ${cheapestModel.id} - $${cheapestModel.pricing.inputTokens}/M input tokens`);
        }

        const cheapestVision = await modelManager.getCheapestModel(['vision']);
        if (cheapestVision && cheapestVision.pricing) {
            console.log(`Cheapest with vision: ${cheapestVision.id} - $${cheapestVision.pricing.inputTokens}/M input tokens`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Example: Video processing with Gemini
async function geminiVideoExample() {
    console.log('\n\n🎥 Gemini Video Processing Example\n');

    const gemini = new GeminiProvider({
        apiKey: process.env.GEMINI_API_KEY || 'your-gemini-api-key'
    });

    try {
        // Note: This is a demonstration - you would need actual video data
        const videoRequest = {
            model: 'gemini-1.5-pro',
            messages: [
                {
                    role: 'user' as const,
                    content: [
                        {
                            type: 'text' as const,
                            text: 'Analyze this video and describe what you see. Focus on the main actions and objects.'
                        },
                        // In a real scenario, you would encode your video file to base64
                        // { 
                        //     type: 'video' as const, 
                        //     videoUrl: 'data:video/mp4;base64,<your-base64-video-data>',
                        //     mimeType: 'video/mp4'
                        // }
                    ]
                }
            ],
            maxTokens: 500
        };

        console.log('🎬 This example shows the structure for video processing with Gemini.');
        console.log('To use this with real video, encode your video file to base64 and add it to the content array.');
        console.log('Gemini 1.5 Pro supports up to 2M token context, allowing for long video analysis.');

        // Uncomment the following to test with actual video data:
        // const response = await gemini.generateCompletion(videoRequest);
        // console.log('Video analysis:', response.content);

    } catch (error) {
        console.error('❌ Video processing error:', error);
    }
}

// Run examples
async function runExamples() {
    await newProvidersExample();
    await geminiVideoExample();
}

// Only run if this file is executed directly
if (import.meta.main) {
    runExamples().catch(console.error);
} 