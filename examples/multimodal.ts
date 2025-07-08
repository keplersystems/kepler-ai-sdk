import { OpenAIProvider } from '../src/index';
import * as fs from 'fs';
import * as path from 'path';

// Helper function to encode image to base64
function encodeImage(imagePath: string): string {
    const absolutePath = path.resolve(imagePath);
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Image not found at path: ${absolutePath}`);
    }
    const imageBuffer = fs.readFileSync(absolutePath);
    return imageBuffer.toString('base64');
}

// Example: Vision with OpenAI
async function openAIVisionExample() {
    console.log('🖼️ OpenAI Vision Example\n');

    const openai = new OpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key'
    });

    try {
        // Note: You need to have an image file at 'examples/assets/sample-image.png'
        const imageUrl = `data:image/png;base64,${encodeImage('examples/assets/sample-image.png')}`;

        const request = {
            model: 'gpt-4o',
            messages: [
                {
                    role: 'user' as const,
                    content: [
                        { type: 'text' as const, text: 'What do you see in this image?' },
                        { type: 'image' as const, imageUrl }
                    ]
                }
            ],
            maxTokens: 150
        };

        const response = await openai.generateCompletion(request);
        console.log('🤖 Vision Response:');
        console.log(response.content);

    } catch (error) {
        console.error('❌ OpenAI vision error:', error);
    }
}


// Run examples
async function runExamples() {
    await openAIVisionExample();
}

// Only run if this file is executed directly
if (import.meta.main) {
    runExamples().catch(console.error);
}
