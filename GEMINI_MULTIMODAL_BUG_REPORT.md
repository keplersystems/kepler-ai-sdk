# Bug Report: Gemini 2.5 Pro Multimodal Attachment Issues

## Summary
All Gemini 2.5 models (`gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`) fail to process multimodal requests containing attachments (images, videos, audio, documents), returning 500 internal server errors. The same requests work successfully with `gemini-2.0-flash`.

## Environment
- **SDK**: kepler-ai-sdk
- **Failing Models**: `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`
- **Working Model**: `gemini-2.0-flash`
- **Media Types Tested**: PDF documents, JPEG images, MP4 videos, MPEG audio
- **Content Encoding**: Base64
- **1st Party Platform**: Google AI Studio (confirmed working with identical request structure)

## Problem Description
When sending multimodal requests with attachments to any Gemini 2.5 model (`gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`), the API returns:
```json
{
  "error": {
    "code": 500,
    "message": "An internal error has occurred. Please retry or report in https://developers.generativeai.google/guide/troubleshooting",
    "status": "INTERNAL"
  }
}
```

## Test Case
**File**: `examples/gemini-real-test.ts`

**Request Structure**:
```typescript
const multimodalResponse = await provider.generateCompletion({
  model: "gemini-2.5-pro", // FAILS
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Please analyze all these different types of content and provide insights:",
        },
        {
          type: "image",
          imageUrl: sampleImageBase64,
          mimeType: "image/jpeg"
        },
        {
          type: "video",
          videoUrl: sampleVideoBase64,
          mimeType: "video/mp4"
        },
        {
          type: "audio",
          audioUrl: sampleAudioBase64,
          mimeType: "audio/mpeg"
        },
        {
          type: "document",
          documentUrl: samplePDFBase64,
          mimeType: "application/pdf"
        },
      ],
    },
  ],
  maxTokens: 1024,
});
```

## Investigation Results

### Google AI Studio Reference (log.txt)
The working request structure from Google's 1st party AI Studio platform uses `gemini-2.5-pro` with the following pattern:
```javascript
const model = 'gemini-2.5-pro';
const contents = [
  {
    role: 'user',
    parts: [
      {
        inlineData: {
          data: `JVBERi0xLjUNCiW1txxxxxxxxxx`,
          mimeType: `application/pdf`,
        },
      },
      {
        inlineData: {
          data: `/9j/4AAQSkZJRgABAQAAAQABAAD/xxx`,
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
          data: `AAAAIGZ0eXBntcDQyAAAAAxxx`,
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
          data: `SUQzBAAAAAABBVRYWFgxxxx`,
          mimeType: `audio/mpeg`,
        },
      },
      {
        text: `Please analyze all these different types of content and provide insights:`,
      },
    ],
  }
];
```

**Key Finding**: This exact structure works in Google AI Studio but fails via API, suggesting a platform-specific issue rather than request format problem.

### Request Structure Analysis
Initially suspected the issue was request structure, as Google's AI Studio uses a different pattern:
- **Our Structure**: Single message with multiple parts
- **AI Studio Structure**: Multiple messages, each with specific media types

### API Request Transformation
The SDK transforms the unified message into Google's expected format:
```json
[
  {
    "role": "user",
    "parts": [
      {
        "inlineData": {
          "mimeType": "application/pdf",
          "data": "JVBERi0xLjUNCiW1tbW1..."
        }
      },
      {
        "inlineData": {
          "mimeType": "image/jpeg", 
          "data": "/9j/4AAQSkZJRgABAQAAAQABAAD..."
        }
      }
    ]
  },
  {
    "role": "user",
    "parts": [
      {
        "inlineData": {
          "mimeType": "video/mp4",
          "data": "AAAAIGZ0eXBtcDQyAAAAAxxx..."
        }
      }
    ]
  },
  {
    "role": "user", 
    "parts": [
      {
        "inlineData": {
          "mimeType": "audio/mpeg",
          "data": "SUQzBAAAAAABBVRYWFgxxxx..."
        }
      },
      {
        "text": "Please analyze all these different types of content..."
      }
    ]
  }
]
```

### Error Pattern
- **All Gemini 2.5 models** (`gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`): Return 500 internal error with any attachment combination
- **gemini-2.0-flash**: Processes identical requests successfully
- **Text-only requests**: Work fine on all models
- **Google AI Studio**: Same request structure works with `gemini-2.5-pro` in the web interface

## Workaround
Use `gemini-2.0-flash` instead of any Gemini 2.5 model for multimodal requests:

```typescript
const multimodalResponse = await provider.generateCompletion({
  model: "gemini-2.0-flash", // WORKS
  // ... same request structure
});
```

## Files Modified During Investigation
- `src/providers/gemini.ts:convertMessages()` - Enhanced message splitting logic
- `examples/gemini-real-test.ts` - Test cases for multimodal functionality

## Technical Details

### Base64 Sample Data Used
- **PDF**: 1.4MB document with multiple pages
- **Image**: JPEG format, standard resolution
- **Video**: MP4 format, short duration clip
- **Audio**: MPEG format, brief audio sample

### Request Headers
```json
{
  "Content-Type": "application/json",
  "x-goog-api-key": "[API_KEY]"
}
```

### Error Reproducibility
- **100% reproducible** with any Gemini 2.5 model + any attachment via API
- **0% reproducible** with gemini-2.0-flash + same attachments via API
- **0% reproducible** with any model + text-only requests via API
- **0% reproducible** with gemini-2.5-pro + attachments in Google AI Studio web interface

## Recommendation
1. Document model-specific limitations in SDK documentation
2. Add model validation warnings for multimodal requests
3. Consider defaulting to `gemini-2.0-flash` for multimodal requests
4. Add model capability matrix to prevent user confusion

## Status
- **Confirmed**: API-specific issue affecting all Gemini 2.5 models, not SDK implementation problem
- **Severity**: High - Affects all multimodal functionality on entire Gemini 2.5 model family
- **Impact**: Users must switch to Gemini 2.0 models for attachment support
- **Date Reported**: 2025-06-29
- **Affected Models**: `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`
- **Platform Discrepancy**: Works in Google AI Studio but fails via direct API calls

## Related Files
- `/log.txt` - Working request from Google's playground
- `/examples/gemini-real-test.ts` - Test implementation 
- `/src/providers/gemini.ts` - Provider implementation
- `examples/sample-media.ts` - Files used for testing


## OUTPUT from `gemini-2.0-flash`:

```md
  5️⃣ Testing Multimodal Input:
  Making real API call with image input...

  ✅ SUCCESS! Real Multimodal Response:
  👁️  Vision analysis: "Here's an analysis of the different content types:

  **1. Cream Packaging:**

  *   **Type:** Pharmaceutical product packaging.
  *   **Details:** The box advertises "Eberconazole & Mometasone Cream." This indicates a combination topical medication likely used for fungal infections with inflammation.
  *   **Insights:** The inclusion of Mometasone suggests it's a prescription-strength cream because it is a corticosteroid.

  **2. 3D Game/Model Development:**

  *   **Type:** 3D models and a game development environment.
  *   **Details:** A 3D model of a character wearing medieval fantasy-style armor is placed in a flat gray environment with several cubes around it. Some images include an x-axis, y-axis, and z-axis with the 3D model of the character standing on the origin (0,0,0).
  *   **Insights:** It's likely from a game development environment like Unity or Unreal Engine. The simple environment suggests it's early-stage development or testing of the character model and movement. The character design seems potentially inspired by fantasy genres.

  **3. Audio (Speech):**

  *   **Type:** Recorded speech in Hindi
  *   **Details:** The recording says "मैं तुझे इतना मार दूंगी" which translates to "I will beat you so much." And, "भेज दिया मुझे नहीं चलना होता है भेज भेजना भेजना हैज।" which translates to "Sent me. I didn't mean to walk/move send send send send"
  *   **Insights:** There is audio recording of speech in Hindi which contains threats of physical violence.

  **4. Educational Document:**

  *   **Type:** Educational material/lesson, likely for a college-level course.
  *   **Details:** D.L.Patel Institute of Management & Technology MCA College MCA-2 INDIAN KNOWLEDGE SYSTEM. Unit-8 Astronomy
  *   **Insights:** The material covers fundamental topics in astronomy, including the nature of the universe, stars, distances, and the concept of dark matter/energy.

  **In Summary:**

  The content is quite varied:

  *   A photo related to pharmaceuticals.
  *   A set of images showing a 3D character model in a game development context.
  *   Audio of speech containing threats of physical violence
  *   Educational notes on astronomy."
  📊 Usage: 4071 → 505 tokens
```

## OUTPUT from `gemini-2.5-x`:

```md
  5️⃣ Testing Multimodal Input:
  Making real API call with image input...

  ❌ Expected error with invalid key:
    Error: Gemini completion generation failed: {"error":{"code":500,"message":"An internal error has occurred. Please retry or report in https://developers.generativeai.google/guide/troubleshooting","status":"INTERNAL"}}
    This would work with valid API key
```

## Other reports
- https://x.com/velocizapkar/status/1907470284900217191
- https://x.com/CreativeFrubser/status/1929145088078237738
- https://x.com/rogerluan_/status/1920119219053584775
- https://x.com/ClayMalott/status/1910351669289689352
- https://github.com/googleapis/js-genai/issues/650