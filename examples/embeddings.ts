import {
    OpenAIProvider,
    UsageTracker
} from '../src/index';

// Example: Embedding generation and comparison
async function embeddingExample() {
    console.log('🔗 Embedding Generation Example\n');

    // Initialize providers that support embeddings
    const openai = new OpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key'
    });

    const usageTracker = new UsageTracker();

    try {
        const documents = [
            "Artificial intelligence is transforming how we work and live.",
            "Machine learning algorithms can identify patterns in large datasets.",
            "Natural language processing enables computers to understand human language.",
            "Computer vision allows machines to interpret and analyze visual information.",
            "Deep learning uses neural networks with multiple layers to learn complex patterns."
        ];

        // 1. Generate embeddings with OpenAI
        if (process.env.OPENAI_API_KEY) {
            try {
                console.log('🤖 Generating embeddings with OpenAI...');
                const openaiEmbeddings = await openai.generateEmbedding({
                    model: 'text-embedding-3-small',
                    input: documents
                });

                console.log(`✅ Generated ${openaiEmbeddings.embeddings.length} embeddings`);
                console.log(`📏 Embedding dimension: ${openaiEmbeddings.embeddings[0].length}`);
                console.log(`🎯 Tokens used: ${openaiEmbeddings.usage.totalTokens}`);

                // Track usage
                usageTracker.trackUsage('text-embedding-3-small', openaiEmbeddings.usage, 0);

                // Show similarity between first two documents
                const similarity = cosineSimilarity(
                    openaiEmbeddings.embeddings[0], 
                    openaiEmbeddings.embeddings[1]
                );
                console.log(`🔄 Similarity between docs 1 & 2: ${similarity.toFixed(4)}`);

            } catch (error) {
                console.log('OpenAI embeddings test skipped (likely missing API key)');
            }
        }

        // 3. Show usage statistics
        console.log('\n📊 Embedding Usage Statistics:');
        const allStats = usageTracker.getUsage() as any[];
        if (allStats.length > 0) {
            allStats.forEach(stats => {
                console.log(`${stats.model}:`);
                console.log(`  Requests: ${stats.totalRequests}`);
                console.log(`  Tokens: ${stats.totalTokens}`);
            });
        } else {
            console.log('No usage tracked (likely due to missing API keys)');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Utility function to calculate cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
        throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
        return 0;
    }

    return dotProduct / (normA * normB);
}

// Run examples
async function runExamples() {
    await embeddingExample();
    await documentClusteringExample();
}

// Only run if this file is executed directly
if (import.meta.main) {
    runExamples().catch(console.error);
} 