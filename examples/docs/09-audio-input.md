# 09. Audio Inputs with OpenRouter

This example demonstrates how to use audio inputs with OpenRouter models that support audio processing capabilities.

## What This Example Covers

1. **Audio File Encoding**: Convert audio files to base64 format required by OpenRouter
2. **Audio Content Types**: Use the SDK's audio content type in messages
3. **Format Support**: Work with supported audio formats (WAV, MP3)
4. **Model Selection**: Choose models that support audio processing
5. **Error Handling**: Handle audio-specific errors and unsupported formats

## Prerequisites

- OpenRouter API key set as environment variable:
  ```bash
  export OPENROUTER_API_KEY="your-openrouter-api-key"
  ```
- Audio file to process (WAV or MP3 format)

## Running the Example

```bash
bun run examples/09-audio-input.ts
```

## Supported Audio Formats

OpenRouter supports the following audio formats:

| Format | MIME Type   | File Extension |
|--------|-------------|----------------|
| WAV    | `audio/wav` | `.wav`         |
| MP3    | `audio/mp3` | `.mp3`         |

## Usage Pattern

```typescript
import { readFileSync } from "fs";

// 1. Encode audio file to base64
function encodeAudioToBase64(audioPath: string): string {
  const audioBuffer = readFileSync(audioPath);
  return audioBuffer.toString("base64");
}

// 2. Use in completion request
const base64Audio = encodeAudioToBase64("path/to/audio.wav");

const response = await provider.generateCompletion({
  model: "google/gemini-2.5-flash",
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Please transcribe this audio file."
        },
        {
          type: "audio",
          audioUrl: base64Audio,    // Base64-encoded audio data
          mimeType: "audio/wav"     // Specify the format
        }
      ]
    }
  ]
});
```

## Recommended Models

Models that support audio input processing:

- `google/gemini-2.5-flash` - Fast audio processing
- `google/gemini-2.5-pro` - High-quality audio analysis
- Other Gemini models with audio capabilities

## Technical Details

### Audio Processing Flow

1. **File Reading**: Read audio file from filesystem
2. **Base64 Encoding**: Convert binary audio data to base64 string
3. **Format Detection**: Extract format from MIME type (wav/mp3)
4. **API Request**: Send as `input_audio` content type to OpenRouter
5. **Model Processing**: Audio-capable model processes the content

### Content Structure

The SDK automatically converts audio content to OpenRouter's expected format:

```json
{
  "type": "input_audio",
  "input_audio": {
    "data": "base64_encoded_audio_data",
    "format": "wav"
  }
}
```

### Error Handling

Common errors and solutions:

- **Unsupported Format**: Use WAV or MP3 only
- **Model Compatibility**: Ensure model supports audio inputs
- **File Size**: Large files may exceed API limits
- **Encoding Issues**: Verify base64 encoding is correct

## Use Cases

- **Transcription**: Convert speech to text
- **Audio Analysis**: Analyze audio content and characteristics
- **Language Detection**: Identify spoken language
- **Content Summarization**: Summarize audio content
- **Sentiment Analysis**: Analyze tone and emotion in speech

## Next Steps

After running this example, you might want to explore:

- Building transcription services
- Creating audio-based chatbots
- Implementing voice commands
- Analyzing recorded meetings or calls
- Processing podcasts or interviews