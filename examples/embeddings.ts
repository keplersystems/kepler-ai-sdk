import {
    OpenAIProvider,
    CohereProvider,
    UsageTracker
} from '../src/index.js';

// Example: Embedding generation and comparison
async function embeddingExample() {
    console.log('🔗 Embedding Generation Example\n');

    // Initialize providers that support embeddings
    const openai = new OpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key'
    });

    const cohere = new CohereProvider({
        apiKey: process.env.COHERE_API_KEY || 'your-cohere-api-key'
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

        // 2. Generate embeddings with Cohere
        if (process.env.COHERE_API_KEY) {
            try {
                console.log('\n💼 Generating embeddings with Cohere...');
                const cohereEmbeddings = await cohere.generateEmbedding({
                    model: 'embed-english-v3.0',
                    input: documents
                });

                console.log(`✅ Generated ${cohereEmbeddings.embeddings.length} embeddings`);
                console.log(`📏 Embedding dimension: ${cohereEmbeddings.embeddings[0].length}`);
                console.log(`🎯 Tokens used: ${cohereEmbeddings.usage.totalTokens}`);

                // Track usage
                usageTracker.trackUsage('embed-english-v3.0', cohereEmbeddings.usage, 0);

                // Show similarity between first two documents
                const similarity = cosineSimilarity(
                    cohereEmbeddings.embeddings[0], 
                    cohereEmbeddings.embeddings[1]
                );
                console.log(`🔄 Similarity between docs 1 & 2: ${similarity.toFixed(4)}`);

                // Demonstrate semantic search
                console.log('\n🔍 Semantic search demonstration:');
                const query = "How do neural networks learn?";
                const queryEmbedding = await cohere.generateEmbedding({
                    model: 'embed-english-v3.0',
                    input: [query]
                });

                // Find most similar document
                const similarities = cohereEmbeddings.embeddings.map((docEmb, idx) => ({
                    index: idx,
                    similarity: cosineSimilarity(queryEmbedding.embeddings[0], docEmb),
                    document: documents[idx]
                }));

                similarities.sort((a, b) => b.similarity - a.similarity);

                console.log(`Query: "${query}"`);
                console.log('📊 Top 3 most similar documents:');
                similarities.slice(0, 3).forEach((result, i) => {
                    console.log(`  ${i + 1}. (${result.similarity.toFixed(4)}) ${result.document}`);
                });

            } catch (error) {
                console.log('Cohere embeddings test skipped (likely missing API key)');
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

// Example: Document clustering with embeddings
async function documentClusteringExample() {
    console.log('\n\n📚 Document Clustering Example\n');

    const cohere = new CohereProvider({
        apiKey: process.env.COHERE_API_KEY || 'your-cohere-api-key'
    });

    try {
        // Sample documents from different topics
        const documents = [
            // Technology
            "Machine learning algorithms are revolutionizing data analysis and decision making.",
            "Artificial intelligence systems can now perform complex reasoning tasks.",
            "Neural networks mimic the structure and function of biological neurons.",
            
            // Cooking
            "Italian pasta dishes often feature fresh tomatoes and basil.",
            "French cuisine emphasizes butter, cream, and complex flavor combinations.",
            "Asian stir-fry techniques preserve the texture and nutrients of vegetables.",
            
            // Sports
            "Professional basketball players train year-round to maintain peak performance.",
            "Soccer requires both individual skill and excellent team coordination.",
            "Olympic swimmers follow strict training regimens and dietary plans."
        ];

        if (process.env.COHERE_API_KEY) {
            console.log('🔗 Generating embeddings for document clustering...');
            const embeddings = await cohere.generateEmbedding({
                model: 'embed-english-v3.0',
                input: documents
            });

            console.log(`✅ Generated embeddings for ${documents.length} documents`);

            // Simple clustering: find documents similar to each topic seed
            const topicSeeds = [
                { topic: "Technology", index: 0 },
                { topic: "Cooking", index: 3 },
                { topic: "Sports", index: 6 }
            ];

            console.log('\n🎯 Document clustering by topic:');
            
            topicSeeds.forEach(seed => {
                console.log(`\n${seed.topic} cluster:`);
                const seedEmbedding = embeddings.embeddings[seed.index];
                
                const similarities = documents.map((doc, idx) => ({
                    index: idx,
                    similarity: cosineSimilarity(seedEmbedding, embeddings.embeddings[idx]),
                    document: doc
                }));

                // Sort by similarity and show top matches
                similarities
                    .sort((a, b) => b.similarity - a.similarity)
                    .slice(0, 4) // Show top 4 (including the seed itself)
                    .forEach((result, i) => {
                        const marker = result.index === seed.index ? '🌟' : '  ';
                        console.log(`${marker} (${result.similarity.toFixed(3)}) ${result.document.substring(0, 60)}...`);
                    });
            });

        } else {
            console.log('Cohere API key required for this example');
        }

    } catch (error) {
        console.error('❌ Clustering error:', error);
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