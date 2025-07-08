import { OpenAIProvider, AnthropicProvider } from '../src/index';

// Mock function to simulate an API call
function getCurrentWeather(city: string, unit: 'celsius' | 'fahrenheit' = 'celsius') {
    const weather = {
        city,
        temperature: Math.floor(Math.random() * 20 + 10), // Random temp between 10-30
        unit,
        description: ['Sunny', 'Cloudy', 'Rainy', 'Windy'][Math.floor(Math.random() * 4)]
    };
    return JSON.stringify(weather);
}

// Example: Tool usage with OpenAI
async function openAIToolExample() {
    console.log('🔧 OpenAI Tool Usage Example\n');

    const openai = new OpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key'
    });

    try {
        const messages: any[] = [
            {
                role: 'user',
                content: 'What\'s the weather like in San Francisco?'
            }
        ];

        const tools = [
            {
                name: 'get_current_weather',
                description: 'Get the current weather in a given location',
                parameters: {
                    type: 'object' as const,
                    properties: {
                        city: {
                            type: 'string',
                            description: 'The city and state, e.g. San Francisco, CA',
                        },
                        unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
                    },
                    required: ['city'],
                },
            },
        ];

        let response = await openai.generateCompletion({
            model: 'gpt-4o',
            messages,
            tools,
            toolChoice: 'auto',
        });

        while (response.toolCalls) {
            console.log('🔧 Model wants to use tools:');
            for (const toolCall of response.toolCalls) {
                console.log(`  • Calling: ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);
                const toolResult = getCurrentWeather(
                    toolCall.arguments.city as string,
                    toolCall.arguments.unit as any
                );
                console.log(`  • Result: ${toolResult}`);
                messages.push({
                    role: 'assistant',
                    content: null,
                    tool_calls: response.toolCalls.map(tc => ({ 
                        id: tc.id,
                        type: 'function',
                        function: {
                            name: tc.name,
                            arguments: JSON.stringify(tc.arguments)
                        }
                    }))
                });
                messages.push({
                    role: 'tool',
                    toolCallId: toolCall.id,
                    content: toolResult,
                });
            }

            response = await openai.generateCompletion({
                model: 'gpt-4o',
                messages,
                tools,
                toolChoice: 'auto',
            });
        }

        console.log('\n💬 Final Response:');
        console.log(response.content);

    } catch (error) {
        console.error('❌ OpenAI tool usage error:', error);
    }
}

// Run examples
async function runExamples() {
    await openAIToolExample();
}

// Only run if this file is executed directly
if (import.meta.main) {
    runExamples().catch(console.error);
}
