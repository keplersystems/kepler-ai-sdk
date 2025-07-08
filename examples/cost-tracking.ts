import {
    OpenAIProvider,
    PricingCalculator,
    UsageTracker,
    ModelManager
} from '../src/index';

// Example: Cost and usage tracking
async function costTrackingExample() {
    console.log('💰 Cost and Usage Tracking Example\n');

    const openai = new OpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key'
    });

    const pricingCalculator = new PricingCalculator();
    const usageTracker = new UsageTracker();
    const modelManager = new ModelManager();
    modelManager.addProvider(openai);

    try {
        // 1. Estimate cost before making a request
        const estimationRequest = {
            model: 'gpt-4o-mini',
            messages: [{ role: 'user' as const, content: 'This is a test prompt for cost estimation.' }],
        };
        const estimatedCost = await pricingCalculator.estimateCost(estimationRequest as any, 200);
        console.log(`Estimated cost for the request: $${estimatedCost?.toFixed(6)}`);

        // 2. Make a request
        const completionRequest = {
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'user' as const,
                    content: 'Tell me a fun fact about the Roman Empire.'
                }
            ],
            maxTokens: 100
        };
        const response = await openai.generateCompletion(completionRequest);
        console.log('\n🤖 Response:', response.content);

        // 3. Calculate the actual cost
        const actualCost = await pricingCalculator.calculateCost(response.usage, response.model);
        console.log(`Actual cost: $${actualCost?.totalCost.toFixed(6)}`);

        // 4. Track the usage
        usageTracker.trackUsage(response.model, response.usage, actualCost?.totalCost);

        // 5. Get usage stats for the model
        let stats = usageTracker.getUsage(response.model) as any;
        console.log(`\n📊 Stats for ${response.model}:`);
        console.log(`  - Total Requests: ${stats.totalRequests}`);
        console.log(`  - Total Tokens: ${stats.totalTokens}`);
        console.log(`  - Total Cost: $${stats.totalCost.toFixed(6)}`);

        // 6. Make another request to the same model
        await openai.generateCompletion(completionRequest);
        usageTracker.trackUsage(response.model, response.usage, actualCost?.totalCost);

        stats = usageTracker.getUsage(response.model) as any;
        console.log(`\n📊 Updated stats for ${response.model}:`);
        console.log(`  - Total Requests: ${stats.totalRequests}`);
        console.log(`  - Average Cost/Request: $${stats.averageCostPerRequest.toFixed(6)}`);

        // 7. Get aggregated usage across all models
        const aggregatedStats = usageTracker.getAggregatedUsage();
        console.log('\n📈 Aggregated Stats:');
        console.log(`  - Total Requests: ${aggregatedStats.totalRequests}`);
        console.log(`  - Total Cost: $${aggregatedStats.totalCost.toFixed(6)}`);

    } catch (error) {
        console.error('❌ Cost tracking error:', error);
    }
}

// Run examples
async function runExamples() {
    await costTrackingExample();
}

// Only run if this file is executed directly
if (import.meta.main) {
    runExamples().catch(console.error);
}
