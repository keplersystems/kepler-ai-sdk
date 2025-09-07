import { LLMError } from "../errors/LLMError";

export interface ProcessedImage {
  isBase64: boolean;
  data: string;
  mimeType?: string;
}

/**
 * Process image URL to determine if it's base64 or URL and extract relevant data
 */
export function processImageUrl(imageUrl: string): ProcessedImage {
  // Handle data URI format: data:image/jpeg;base64,/9j/...
  if (imageUrl.startsWith("data:")) {
    const [header, data] = imageUrl.split(",");
    const mimeType = header.match(/data:([^;]+)/)?.[1];
    return { isBase64: true, data, mimeType };
  }
  
  // Handle raw base64 (no http prefix) - assume JPEG
  if (!imageUrl.startsWith("http")) {
    return { isBase64: true, data: imageUrl, mimeType: "image/jpeg" };
  }
  
  // Handle HTTP/HTTPS URLs
  return { isBase64: false, data: imageUrl };
}

/**
 * Convert URL to base64 by fetching and encoding
 * Used by providers that require base64 format (like Gemini)
 */
export async function convertUrlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Convert to base64
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    return btoa(binary);
  } catch (error) {
    throw new LLMError(
      `Failed to convert URL to base64: ${error instanceof Error ? error.message : "Unknown error"}`,
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Process file data for providers that need base64
 * Converts URLs to base64, extracts base64 from data URIs
 */
export async function processFileDataForBase64(fileData: string): Promise<string> {
  const processed = processImageUrl(fileData);
  
  if (processed.isBase64) {
    return processed.data;
  }
  
  // Convert URL to base64
  return convertUrlToBase64(processed.data);
}