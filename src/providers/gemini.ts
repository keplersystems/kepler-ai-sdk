import { GoogleGenAI } from "@google/genai";
import type {
  ProviderAdapter,
  CompletionRequest,
  CompletionResponse,
  CompletionChunk,
  ModelInfo,
  TokenUsage,
  Message,
  ToolDefinition,
  ToolCall,
  ResponseFormat,
  EmbeddingRequest,
  EmbeddingResponse,
  ImageRequest,
  ImageResponse,
  AudioRequest,
  AudioResponse,
} from "../core/interfaces";
import { LLMError } from "../errors/LLMError";
import { litellmModelManager } from "../utils/litellm-models";

/**
 * WAV conversion options interface
 * Used for converting raw audio to WAV format
 */
interface WavConversionOptions {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
}

/**
 * Provider adapter for Google Gemini API
 * Supports Gemini models with large context windows, video processing, and thinking budgets
 */
export class GeminiProvider implements ProviderAdapter {
  readonly name = "gemini";

  /** Google GenAI client instance */
  private client: GoogleGenAI;

  /**
   * Create a new Gemini provider instance
   * @param config - Configuration options for the Gemini client
   */
  constructor(config: {
    /** Google AI Studio API key */
    apiKey?: string;

    /** Vertex AI configuration */
    vertexAI?: {
      project: string;
      location: string;
    };

    /** Custom base URL (for proxies) */
    baseURL?: string;
  }) {
    if (config.vertexAI) {
      this.client = new GoogleGenAI({
        vertexai: true,
        project: config.vertexAI.project,
        location: config.vertexAI.location,
      });
    } else if (config.apiKey) {
      this.client = new GoogleGenAI({
        apiKey: config.apiKey,
      });
    } else {
      throw new LLMError(
        "Either apiKey or vertexAI configuration must be provided"
      );
    }
  }

  /**
   * Generate a completion using Gemini's generateContent API
   */
  async generateCompletion(
    request: CompletionRequest
  ): Promise<CompletionResponse> {
    try {
      const { contents, systemInstruction } = this.convertMessages(
        request.messages
      );

      const requestConfig: any = {
        model: request.model,
        contents,
        systemInstruction,
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
          stopSequences: Array.isArray(request.stop)
            ? request.stop
            : request.stop
              ? [request.stop]
              : undefined,
        },
      };

      // Add tools if provided
      if (request.tools && request.tools.length > 0) {
        requestConfig.tools = [
          {
            functionDeclarations: this.convertTools(request.tools),
          },
        ];

        // Configure tool choice
        if (request.toolChoice) {
          requestConfig.toolConfig = this.convertToolChoice(request.toolChoice);
        }
      }

      // Add response format if specified
      if (request.responseFormat?.type === "json_object") {
        requestConfig.generationConfig.responseMimeType = "application/json";
      } else if (request.responseFormat?.type === "json_schema") {
        requestConfig.generationConfig.responseMimeType = "application/json";
        requestConfig.generationConfig.responseSchema =
          request.responseFormat.jsonSchema;
      }

      const response = await this.client.models.generateContent(requestConfig);

      return this.convertResponse(response, request.model);
    } catch (error) {
      throw this.handleError(error, "completion generation");
    }
  }

  /**
   * Generate a streaming completion using Gemini's streaming API
   */
  async *streamCompletion(
    request: CompletionRequest
  ): AsyncIterable<CompletionChunk> {
    try {
      const { contents, systemInstruction } = this.convertMessages(
        request.messages
      );

      const requestConfig: any = {
        model: request.model,
        contents,
        systemInstruction,
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
          stopSequences: Array.isArray(request.stop)
            ? request.stop
            : request.stop
              ? [request.stop]
              : undefined,
        },
      };

      // Add tools if provided
      if (request.tools && request.tools.length > 0) {
        requestConfig.tools = [
          {
            functionDeclarations: this.convertTools(request.tools),
          },
        ];

        if (request.toolChoice) {
          requestConfig.toolConfig = this.convertToolChoice(request.toolChoice);
        }
      }

      const stream = await this.client.models.generateContentStream(
        requestConfig
      );

      for await (const chunk of stream) {
        yield this.convertChunk(chunk);
      }
    } catch (error) {
      throw this.handleError(error, "streaming completion");
    }
  }

  /**
   * List all available Gemini models using LiteLLM data
   */
  async listModels(): Promise<ModelInfo[]> {
    try {
      return await litellmModelManager.getModelsByProvider("gemini");
    } catch (error) {
      throw new LLMError(
        `Failed to fetch Gemini models from LiteLLM: ${error instanceof Error ? error.message : "Unknown error"
        }`,
        error instanceof Error ? error : undefined,
        { provider: "gemini" }
      );
    }
  }

  /**
   * Get information about a specific Gemini model using LiteLLM data
   */
  async getModel(modelId: string): Promise<ModelInfo | null> {
    try {
      return await litellmModelManager.getModelInfo(modelId, "gemini");
    } catch (error) {
      throw new LLMError(
        `Failed to get Gemini model '${modelId}' from LiteLLM: ${error instanceof Error ? error.message : "Unknown error"
        }`,
        error instanceof Error ? error : undefined,
        { provider: "gemini" }
      );
    }
  }

  /**
   * Generate images using Gemini's Imagen integration
   * Uses official generateImages API with Imagen models
   */
  async generateImage(request: ImageRequest): Promise<ImageResponse> {
    try {
      // Use Imagen model for image generation
      const imageModel =
        request.model || "models/imagen-4.0-generate-preview-06-06";

      const response = await this.client.models.generateImages({
        model: imageModel,
        prompt: request.prompt,
        config: {
          numberOfImages: request.n || 1,
          outputMimeType: "image/jpeg", // Default to JPEG for Imagen
          aspectRatio: this.convertSizeToAspectRatio(request.size),
        },
      });

      if (!response?.generatedImages) {
        throw new LLMError("No images generated in response");
      }

      const images = response.generatedImages.map((generatedImage, index) => {
        if (!generatedImage?.image?.imageBytes) {
          throw new LLMError(`No image data for generated image ${index}`);
        }

        const mimeType = "image/jpeg"; // Imagen uses JPEG by default
        const base64Data = generatedImage.image.imageBytes;

        return {
          url: `data:${mimeType};base64,${base64Data}`,
          revisedPrompt: request.prompt, // Imagen doesn't provide revised prompts
        };
      });

      return { images };
    } catch (error) {
      throw this.handleError(error, "image generation");
    }
  }

  /**
   * Generate audio using Gemini's text-to-speech capabilities
   * Uses generateContentStream with audio output configuration
   */
  async generateAudio(request: AudioRequest): Promise<AudioResponse> {
    try {
      // Use TTS-capable model
      const audioModel = request.model || "gemini-2.5-pro-preview-tts";

      const config = {
        temperature: 0.8,
        responseModalities: ["audio"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName:
                this.convertVoiceToGeminiVoice(request.voice) || "Zephyr",
            },
          },
        },
      };

      const contents = [
        {
          role: "user",
          parts: [
            {
              text: request.text,
            },
          ],
        },
      ];

      const response = await this.client.models.generateContentStream({
        model: audioModel,
        config,
        contents,
      });

      // Collect audio chunks
      const audioChunks: Buffer[] = [];
      let detectedMimeType = "audio/wav";

      for await (const chunk of response) {
        if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
          const inlineData = chunk.candidates[0].content.parts[0].inlineData;
          if (inlineData.data && inlineData.mimeType?.startsWith("audio/")) {
            detectedMimeType = inlineData.mimeType;
            const buffer = Buffer.from(inlineData.data, "base64");
            audioChunks.push(buffer);
          }
        }
      }

      if (audioChunks.length === 0) {
        throw new LLMError("No audio data generated in response");
      }

      // Combine all audio chunks
      let combinedAudio = Buffer.concat(audioChunks) as Buffer;

      // Convert raw audio to WAV if the detected format is raw audio (contains 'L' prefix)
      if (detectedMimeType.includes("L")) {
        // Convert raw audio to WAV format
        combinedAudio = this.convertToWav(combinedAudio, detectedMimeType);
      }

      // Convert Buffer to ArrayBuffer
      const arrayBuffer = combinedAudio.buffer.slice(
        combinedAudio.byteOffset,
        combinedAudio.byteOffset + combinedAudio.byteLength
      ) as ArrayBuffer;

      return { audio: arrayBuffer };
    } catch (error) {
      throw this.handleError(error, "audio generation");
    }
  }

  /**
   * Generate embeddings using Gemini's embedding models
   * Uses text-embedding-004 or other Gemini embedding models
   */
  async generateEmbedding(
    request: EmbeddingRequest
  ): Promise<EmbeddingResponse> {
    try {
      // Use Gemini embedding model
      const embeddingModel = request.model || "text-embedding-004";

      // Handle both single text and array inputs
      const inputs = Array.isArray(request.input)
        ? request.input
        : [request.input];
      const embeddings: number[][] = [];
      let totalTokens = 0;

      // Process each input text
      for (const text of inputs) {
        const response = await this.client.models.embedContent({
          model: embeddingModel,
          contents: [
            {
              parts: [{ text }],
            },
          ],
        });

        if (response.embeddings && response.embeddings.length > 0) {
          const embedding = response.embeddings[0];
          if (embedding.values) {
            embeddings.push(embedding.values);
            // Estimate tokens (rough approximation)
            totalTokens += Math.ceil(text.length / 4);
          } else {
            throw new LLMError(
              `No embedding values returned for text: ${text.substring(
                0,
                50
              )}...`
            );
          }
        } else {
          throw new LLMError(
            `Failed to generate embedding for text: ${text.substring(0, 50)}...`
          );
        }
      }

      return {
        embeddings,
        usage: {
          promptTokens: totalTokens,
          completionTokens: 0,
          totalTokens,
        },
      };
    } catch (error) {
      throw this.handleError(error, "embedding generation");
    }
  }

  /**
   * Convert unified messages to Gemini format
   */
  private convertMessages(messages: Message[]): {
    contents: any[];
    systemInstruction?: string;
  } {
    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    // Combine system messages
    const systemInstruction =
      systemMessages.length > 0
        ? systemMessages.map((m) => m.content as string).join("\n")
        : undefined;

    const contents = nonSystemMessages.map((msg) => {
      // Handle tool result messages
      if (msg.role === "tool") {
        return {
          role: "function",
          parts: [
            {
              functionResponse: {
                name: "tool_result", // We'll need to track tool names
                response: { result: msg.content },
              },
            },
          ],
        };
      }

      // Handle simple text messages
      if (typeof msg.content === "string") {
        return {
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        };
      }

      // Handle multimodal content with comprehensive MIME type support
      const parts = msg.content.map((part) => {
        switch (part.type) {
          case "text":
            return { text: part.text! };
          case "image":
            return {
              inlineData: {
                mimeType:
                  this.validateImageMimeType(part.mimeType) || "image/jpeg",
                data: part.imageUrl,
              },
            };
          case "video":
            return {
              inlineData: {
                mimeType:
                  this.validateVideoMimeType(part.mimeType) || "video/mp4",
                data: part.videoUrl,
              },
            };
          case "audio":
            return {
              inlineData: {
                mimeType:
                  this.validateAudioMimeType(part.mimeType) || "audio/mpeg",
                data: part.audioUrl,
              },
            };
          case "document":
            return {
              inlineData: {
                mimeType:
                  this.validateDocumentMimeType(part.mimeType) ||
                  "application/pdf",
                data: part.documentUrl,
              },
            };
          default:
            throw new LLMError(
              `Gemini does not support content type: ${part.type}`
            );
        }
      });

      return {
        role: msg.role === "assistant" ? "model" : "user",
        parts,
      };
    });

    return { contents, systemInstruction };
  }

  /**
   * Convert unified tool definitions to Gemini format
   */
  private convertTools(tools: ToolDefinition[]): any[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  /**
   * Convert unified tool choice to Gemini format
   */
  private convertToolChoice(choice: CompletionRequest["toolChoice"]): any {
    if (!choice || choice === "auto") {
      return { functionCallingConfig: { mode: "AUTO" } };
    }
    if (choice === "none") {
      return { functionCallingConfig: { mode: "NONE" } };
    }
    if (choice === "required") {
      return { functionCallingConfig: { mode: "ANY" } };
    }
    if (typeof choice === "object") {
      return {
        functionCallingConfig: {
          mode: "ANY",
          allowedFunctionNames: [choice.function.name],
        },
      };
    }
    return { functionCallingConfig: { mode: "AUTO" } };
  }

  /**
   * Convert Gemini response to unified format
   */
  private convertResponse(response: any, modelId: string): CompletionResponse {
    const candidate = response.candidates[0];
    const content = candidate.content;

    // Extract text content
    const textContent = content.parts
      .filter((part: any) => part.text)
      .map((part: any) => part.text)
      .join("");

    // Extract tool calls
    const toolCalls = content.parts
      .filter((part: any) => part.functionCall)
      .map((part: any, index: number) => ({
        id: `call_${index}`,
        name: part.functionCall.name,
        arguments: part.functionCall.args || {},
      }));

    // Get usage information
    const usage: TokenUsage = {
      promptTokens: response.usageMetadata?.promptTokenCount || 0,
      completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: response.usageMetadata?.totalTokenCount || 0,
      cachedTokens:
        response.usageMetadata?.cachedContentTokenCount || undefined,
    };

    // Extract reasoning traces if available (for thinking models)
    const reasoning =
      candidate.groundingMetadata?.retrievalQueries?.join("\n") || undefined;

    return {
      id: `gemini_${Date.now()}`,
      content: textContent,
      model: modelId,
      usage,
      finishReason: this.convertFinishReason(candidate.finishReason),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      reasoning,
      metadata: {
        safetyRatings: candidate.safetyRatings,
        citationMetadata: candidate.citationMetadata,
      },
    };
  }

  /**
   * Convert Gemini streaming chunk to unified format
   */
  private convertChunk(chunk: any): CompletionChunk {
    if (!chunk.candidates || chunk.candidates.length === 0) {
      return {
        id: `gemini_stream_${Date.now()}`,
        delta: "",
        finished: false,
      };
    }

    const candidate = chunk.candidates[0];
    const content = candidate.content;

    if (!content || !content.parts) {
      return {
        id: `gemini_stream_${Date.now()}`,
        delta: "",
        finished: candidate.finishReason !== undefined,
      };
    }

    // Extract text delta
    const textDelta = content.parts
      .filter((part: any) => part.text)
      .map((part: any) => part.text)
      .join("");

    // Extract partial tool calls
    const toolCalls = content.parts
      .filter((part: any) => part.functionCall)
      .map((part: any, index: number) => ({
        id: `call_${index}`,
        name: part.functionCall.name,
        arguments: part.functionCall.args || {},
      }));

    const usage = chunk.usageMetadata
      ? {
        promptTokens: chunk.usageMetadata.promptTokenCount || 0,
        completionTokens: chunk.usageMetadata.candidatesTokenCount || 0,
        totalTokens: chunk.usageMetadata.totalTokenCount || 0,
        cachedTokens:
          chunk.usageMetadata.cachedContentTokenCount || undefined,
      }
      : undefined;

    return {
      id: `gemini_stream_${Date.now()}`,
      delta: textDelta,
      finished: candidate.finishReason !== undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage,
    };
  }

  /**
   * Convert Gemini finish reason to unified format
   */
  private convertFinishReason(
    reason: string | undefined
  ): CompletionResponse["finishReason"] {
    switch (reason) {
      case "STOP":
        return "stop";
      case "MAX_TOKENS":
        return "length";
      case "SAFETY":
        return "content_filter";
      case "RECITATION":
        return "content_filter";
      default:
        return "stop";
    }
  }

  /**
   * Convert size string to aspect ratio format for Imagen
   */
  private convertSizeToAspectRatio(size?: string): string {
    if (!size) return "1:1";

    // Parse size like "1024x1024", "512x768", etc.
    const [width, height] = size.split("x").map(Number);

    if (!width || !height) return "1:1";

    // Calculate GCD to simplify ratio
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(width, height);

    const ratioWidth = width / divisor;
    const ratioHeight = height / divisor;

    return `${ratioWidth}:${ratioHeight}`;
  }

  /**
   * Convert standard voice names to Gemini voice names
   */
  private convertVoiceToGeminiVoice(voice?: string): string | undefined {
    if (!voice) return undefined;

    // Map common voice names to Gemini voices
    const voiceMap: Record<string, string> = {
      alloy: "Zephyr",
      echo: "Puck",
      fable: "Sage",
      onyx: "Sterling",
      nova: "Luna",
      shimmer: "Coral",
      // Standard voices
      "en-US-Standard-A": "Zephyr",
      "en-US-Standard-B": "Puck",
      "en-US-Standard-C": "Sage",
      "en-US-Standard-D": "Sterling",
    };

    return voiceMap[voice] || "Zephyr";
  }

  /**
   * Convert raw audio data to WAV format
   * Based on the official Google sample code
   */
  private convertToWav(rawData: Buffer, mimeType: string): Buffer {
    const options = this.parseMimeType(mimeType);
    const wavHeader = this.createWavHeader(rawData.length, options);

    return Buffer.concat([wavHeader, rawData]) as Buffer;
  }

  /**
   * Parse MIME type to extract audio options
   */
  private parseMimeType(mimeType: string): WavConversionOptions {
    const [fileType, ...params] = mimeType.split(";").map((s) => s.trim());
    const [_, format] = fileType.split("/");

    const options: Partial<WavConversionOptions> = {
      numChannels: 1,
      sampleRate: 24000, // Default sample rate
      bitsPerSample: 16, // Default bit depth
    };

    if (format && format.startsWith("L")) {
      const bits = parseInt(format.slice(1), 10);
      if (!isNaN(bits)) {
        options.bitsPerSample = bits;
      }
    }

    for (const param of params) {
      const [key, value] = param.split("=").map((s) => s.trim());
      if (key === "rate") {
        options.sampleRate = parseInt(value, 10);
      }
    }

    return options as WavConversionOptions;
  }

  /**
   * Create WAV header for audio data
   * Based on the official Google sample code
   */
  private createWavHeader(
    dataLength: number,
    options: WavConversionOptions
  ): Buffer {
    const { numChannels, sampleRate, bitsPerSample } = options;

    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const buffer = Buffer.alloc(44);

    buffer.write("RIFF", 0); // ChunkID
    buffer.writeUInt32LE(36 + dataLength, 4); // ChunkSize
    buffer.write("WAVE", 8); // Format
    buffer.write("fmt ", 12); // Subchunk1ID
    buffer.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
    buffer.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
    buffer.writeUInt16LE(numChannels, 22); // NumChannels
    buffer.writeUInt32LE(sampleRate, 24); // SampleRate
    buffer.writeUInt32LE(byteRate, 28); // ByteRate
    buffer.writeUInt16LE(blockAlign, 32); // BlockAlign
    buffer.writeUInt16LE(bitsPerSample, 34); // BitsPerSample
    buffer.write("data", 36); // Subchunk2ID
    buffer.writeUInt32LE(dataLength, 40); // Subchunk2Size

    return buffer;
  }

  /**
   * Validate image MIME type against Gemini's supported formats
   */
  private validateImageMimeType(mimeType?: string): string | null {
    if (!mimeType) return null;

    const supportedImageTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/heic",
      "image/heif",
    ];

    return supportedImageTypes.includes(mimeType.toLowerCase())
      ? mimeType
      : null;
  }

  /**
   * Validate audio MIME type against Gemini's supported formats
   */
  private validateAudioMimeType(mimeType?: string): string | null {
    if (!mimeType) return null;

    const supportedAudioTypes = [
      "audio/wav",
      "audio/mp3",
      "audio/aiff",
      "audio/aac",
      "audio/ogg",
      "audio/flac",
    ];

    return supportedAudioTypes.includes(mimeType.toLowerCase())
      ? mimeType
      : null;
  }

  /**
   * Validate video MIME type against Gemini's supported formats
   */
  private validateVideoMimeType(mimeType?: string): string | null {
    if (!mimeType) return null;

    const supportedVideoTypes = [
      "video/mp4",
      "video/mpeg",
      "video/mov",
      "video/avi",
      "video/x-flv",
      "video/mpg",
      "video/webm",
      "video/wmv",
      "video/3gpp",
    ];

    return supportedVideoTypes.includes(mimeType.toLowerCase())
      ? mimeType
      : null;
  }

  /**
   * Validate document MIME type against Gemini's supported formats
   */
  private validateDocumentMimeType(mimeType?: string): string | null {
    if (!mimeType) return null;

    const supportedDocumentTypes = [
      "application/pdf",
      "application/x-javascript",
      "text/javascript",
      "application/x-python",
      "text/x-python",
      "text/plain",
      "text/html",
      "text/css",
      "text/md",
      "text/csv",
      "text/xml",
      "text/rtf",
    ];

    return supportedDocumentTypes.includes(mimeType.toLowerCase())
      ? mimeType
      : null;
  }

  /**
   * Handle Gemini API errors and convert to LLMError
   */
  private handleError(error: unknown, operation: string): never {
    if (error && typeof error === "object" && "message" in error) {
      const errorObj = error as any;
      throw new LLMError(
        `Gemini ${operation} failed: ${errorObj.message}`,
        error as Error,
        {
          provider: "gemini",
          statusCode: errorObj.status || errorObj.code,
          type: errorObj.name || "GEMINI_ERROR",
        }
      );
    }

    if (error instanceof Error) {
      throw new LLMError(`Gemini ${operation} failed: ${error.message}`, error);
    }

    throw new LLMError(`Gemini ${operation} failed with unknown error`);
  }
}
