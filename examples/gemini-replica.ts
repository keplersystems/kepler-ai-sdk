// To run this code you need to install the following dependencies:
// npm install @google/genai mime
// npm install -D @types/node
import { sampleImageBase64, sampleVideoBase64, sampleAudioBase64, samplePDFBase64 } from `./sample-media`;


import {
    GoogleGenAI,
} from '@google/genai';
  
async function main() {
    const ai = new GoogleGenAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });
    const config = {
        thinkingConfig: {
            thinkingBudget: -1,
        },
        responseMimeType: 'text/plain',
    };
    const model = 'gemini-2.5-pro';
    const contents = [
        {
            role: 'user',
            parts: [
                {
                    inlineData: {
                        data: samplePDFBase64,
                        mimeType: `application/pdf`,
                    },
                },
                {
                    inlineData: {
                        data: sampleImageBase64,
                        mimeType: `image/jpeg`,
                    },
                },
            ],
        },
        {
            role: 'user',
            parts: [
                {
                    inlineData: {
                        data: sampleVideoBase64,
                        mimeType: `video/mp4`,
                    },
                },
            ],
        },
        {
            role: 'user',
            parts: [
                {
                    inlineData: {
                        data: sampleAudioBase64,
                        mimeType: `audio/mpeg`,
                    },
                },
                {
                    text: `Please analyze all these different types of content and provide insights:`,
                },
            ],
        },
    ];
  
    const response = await ai.models.generateContentStream({
        model,
        config,
        contents,
    });
    let fileIndex = 0;
    for await (const chunk of response) {
        console.log(chunk.text);
    }
}
  
main();
