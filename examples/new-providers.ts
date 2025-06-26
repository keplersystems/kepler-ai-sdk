import {
    GeminiProvider,
    MistralProvider,
    CohereProvider,
    OpenRouterProvider,
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
    modelManager.addProvider(gemini);
    modelManager.addProvider(mistral);
    modelManager.addProvider(cohere);
    modelManager.addProvider(openrouter);

    const pricingCalculator = new PricingCalculator();
    const usageTracker = new UsageTracker();

    try {
        // 3. List all available models
        console.log('📋 Listing models from all new providers...');
        const allModels = await modelManager.listModels();
        console.log(`Found ${allModels.length} models across all providers`);

        // Show models by provider
        const providers = ['gemini', 'mistral', 'cohere', 'openrouter'];
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

        // Test Mistral (Pixtral for vision)
        if (process.env.MISTRAL_API_KEY) {
            try {
                console.log('\n🎨 Mistral Large:');
                const mistralResponse = await mistral.generateCompletion({
                    model: 'mistral-large-latest',
                    messages: [
                        { role: 'user', content: 'What are the advantages of edge computing?' }
                    ],
                    temperature: 0.5,
                    maxTokens: 100
                });
                console.log(`Response: ${mistralResponse.content.substring(0, 150)}...`);
                console.log(`Tokens: ${mistralResponse.usage.totalTokens}`);
            } catch (error) {
                console.log('Mistral test skipped (likely missing API key)');
            }
        }

        // Test Cohere (Command R+)
        if (process.env.COHERE_API_KEY) {
            try {
                console.log('\n💼 Cohere Command R+:');
                const cohereResponse = await cohere.generateCompletion({
                    model: 'command-r-plus',
                    messages: [
                        { role: 'user', content: 'Describe the benefits of distributed systems.' }
                    ],
                    temperature: 0.6,
                    maxTokens: 100
                });
                console.log(`Response: ${cohereResponse.content.substring(0, 150)}...`);
                console.log(`Tokens: ${cohereResponse.usage.totalTokens}`);
            } catch (error) {
                console.log('Cohere test skipped (likely missing API key)');
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

// Example: Document OCR with Pixtral
async function pixtralOCRExample() {
    console.log('\n\n📄 Pixtral Document OCR Example\n');

    const mistral = new MistralProvider({
        apiKey: process.env.MISTRAL_API_KEY || 'your-mistral-api-key'
    });

    try {
        // Note: This is a demonstration - you would need actual document image data
        const ocrRequest = {
            model: 'pixtral-12b-2409',
            messages: [
                {
                    role: 'user' as const,
                    content: [
                        { 
                            type: 'text' as const, 
                            text: 'Extract all text from this document and format it nicely. Also identify the document type.' 
                        },
                        // In a real scenario, you would provide a document image
                        // { 
                        //     type: 'document' as const, 
                        //     documentUrl: 'data:image/png;base64,<your-base64-document-image>',
                        //     mimeType: 'image/png'
                        // }
                    ]
                }
            ],
            maxTokens: 1000
        };

        console.log('📋 This example shows the structure for document OCR with Pixtral.');
        console.log('To use this with real documents, take a photo/scan of your document,');
        console.log('encode it to base64, and add it to the content array.');
        console.log('Pixtral excels at extracting text from complex document layouts.');

        // Uncomment the following to test with actual document data:
        // const response = await mistral.generateCompletion(ocrRequest);
        // console.log('Extracted text:', response.content);

    } catch (error) {
        console.error('❌ OCR processing error:', error);
    }
}

// Example: OpenRouter model exploration
async function openRouterExplorationExample() {
    console.log('\n\n🌐 OpenRouter Model Exploration Example\n');

    const openrouter = new OpenRouterProvider({
        apiKey: process.env.OPENROUTER_API_KEY || 'your-openrouter-api-key',
        siteUrl: 'https://your-site.com',
        appName: 'Kepler AI SDK Demo'
    });

    try {
        console.log('🔍 Discovering available models on OpenRouter...');
        const models = await openrouter.listModels();
        console.log(`Found ${models.length} models available through OpenRouter`);

        // Group models by provider
        const modelsByProvider = models.reduce((acc, model) => {
            const provider = model.metadata?.top_provider || 'unknown';
            if (!acc[provider]) acc[provider] = [];
            acc[provider].push(model);
            return acc;
        }, {} as Record<string, any[]>);

        console.log('\n📊 Models by underlying provider:');
        Object.entries(modelsByProvider).slice(0, 5).forEach(([provider, providerModels]) => {
            console.log(`  ${provider}: ${providerModels.length} models`);
            if (providerModels.length > 0) {
                const example = providerModels[0];
                console.log(`    Example: ${example.id} (${example.contextWindow} tokens)`);
            }
        });

        // Find models with specific capabilities
        const functionModels = models.filter(m => m.capabilities.functionCalling);
        const visionModels = models.filter(m => m.capabilities.vision);
        const reasoningModels = models.filter(m => m.capabilities.reasoning);

        console.log('\n🔧 Models by capability:');
        console.log(`  Function calling: ${functionModels.length} models`);
        console.log(`  Vision: ${visionModels.length} models`);
        console.log(`  Reasoning: ${reasoningModels.length} models`);

        // Show some high-context models
        const highContextModels = models
            .filter(m => m.contextWindow >= 100000)
            .sort((a, b) => b.contextWindow - a.contextWindow)
            .slice(0, 5);

        console.log('\n🧠 Top 5 highest context models:');
        highContextModels.forEach(model => {
            console.log(`  • ${model.id}: ${(model.contextWindow / 1000).toFixed(0)}K tokens`);
        });

    } catch (error) {
        console.error('❌ OpenRouter exploration error:', error);
    }
}

// Run examples
async function runExamples() {
    await newProvidersExample();
    await geminiVideoExample();
    await pixtralOCRExample();
    await openRouterExplorationExample();
}

// Only run if this file is executed directly
if (import.meta.main) {
    runExamples().catch(console.error);
}