# 08. Text-to-Speech with Gemini

This example demonstrates how to use Google's Gemini TTS (Text-to-Speech) capabilities to convert text into high-quality audio.

## What This Example Covers

1. **Basic TTS Generation**: Convert simple text to speech using default settings
2. **Voice Selection**: Use different voice options for varied speech characteristics
3. **Long Content Processing**: Handle longer text content with proper pacing
4. **Special Formatting**: Process numbers, emails, and URLs appropriately
5. **Audio File Management**: Save generated audio to WAV files

## Prerequisites

- Gemini API key set as environment variable:
  ```bash
  export GOOGLE_GENERATIVE_AI_API_KEY="your-gemini-api-key"
  ```

## Running the Example

```bash
bun run examples/08-text-to-speech.ts
```

## Voice Options

The Gemini TTS system supports the following voices (use these exact names):

**Available Voices:**
`achernar`, `achird`, `algenib`, `algieba`, `alnilam`, `aoede`, `autonoe`, `callirrhoe`, `charon`, `despina`, `enceladus`, `erinome`, `fenrir`, `gacrux`, `iapetus`, `kore`, `laomedeia`, `leda`, `orus`, `puck`, `pulcherrima`, `rasalgethi`, `sadachbia`, `sadaltager`, `schedar`, `sulafat`, `umbriel`, `vindemiatrix`, `zephyr`, `zubenelgenubi`

Default voice: `zephyr`

## Output

The script generates two audio files in the `examples/output/` directory:

1. `long-tts.wav` - Longer content with `leda` voice
2. `formatted-tts.wav` - Text with special formatting with `aoede` voice

## Technical Details

### Models Available
- `gemini-2.5-flash-preview-tts` - Fast TTS model
- `gemini-2.5-pro-preview-tts` - High-quality TTS model

### Audio Format
- Output format: WAV (converted from raw audio)
- Sample rate: 24kHz (default)
- Channels: Mono
- Bit depth: 16-bit

### Voice Usage
- Use the exact voice names from the supported voices list above
- No voice mapping or conversion is performed - names are passed directly to Gemini
- If no voice is specified, the default voice (`zephyr`) is used

## Error Handling

The example includes comprehensive error handling for:
- Missing API keys
- TTS model availability
- Audio generation failures
- File system operations

## Customization

You can modify the script to:
- Use different text content
- Experiment with voice options
- Change output file formats
- Adjust audio quality settings
- Process text from external files

## Next Steps

After running this example, you might want to explore:
- Integrating TTS into larger applications
- Creating voice-over for presentations
- Building voice assistants
- Combining TTS with other AI capabilities
