import { OpenAIProvider, AnthropicProvider } from '../src/index.js';

// Example: Streaming with OpenAI
async function openAIStreamingExample() {
    console.log('🌊 OpenAI Streaming Example\n');

    const openai = new OpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key'
    });

    try {
        const streamRequest = {
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'user' as const,
                    content: 'Write a short story about a robot who discovers music.'
                }
            ],
            temperature: 0.8,
            maxTokens: 200
        };

        console.log('🤖 Streaming response from OpenAI:');
        console.log('---');

        let fullResponse = '';
        for await (const chunk of openai.streamCompletion(streamRequest)) {
            if (chunk.delta) {
                fullResponse += chunk.delta;
                process.stdout.write(chunk.delta);
            }

            if (chunk.finished) {
                console.log('\n---');
                if (chunk.usage) {
                    console.log(`\nTokens used: ${chunk.usage.totalTokens}`);
                }
                break;
            }
        }

    } catch (error) {
        console.error('❌ OpenAI streaming error:', error);
    }
}

// Example: Streaming with Anthropic
async function anthropicStreamingExample() {
    console.log('\n\n🌊 Anthropic Streaming Example\n');

    const anthropic = new AnthropicProvider({
        apiKey: process.env.ANTHROPIC_API_KEY || 'your-anthropic-api-key'
    });

    try {
        const streamRequest = {
            model: 'claude-3-haiku-20240307',
            messages: [
                {
                    role: 'user' as const,
                    content: 'Write a poem about the vastness of space.'
                }
            ],
            temperature: 0.7,
            maxTokens: 150
        };

        console.log('🤖 Streaming response from Anthropic:');
        console.log('---');

        let fullResponse = '';
        for await (const chunk of anthropic.streamCompletion(streamRequest)) {
            if (chunk.delta) {
                fullResponse += chunk.delta;
                process.stdout.write(chunk.delta);
            }

            if (chunk.finished) {
                console.log('\n---');
                if (chunk.usage) {
                    console.log(`\nTokens used: ${chunk.usage.totalTokens}`);
                }
                break;
            }
        }

    } catch (error) {
        console.error('❌ Anthropic streaming error:', error);
    }
}


// Run examples
async function runExamples() {
    await openAIStreamingExample();
    await anthropicStreamingExample();
}

// Only run if this file is executed directly
if (import.meta.main) {
    runExamples().catch(console.error);
}
