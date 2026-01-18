import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// Model ID mapping
const MODEL_IDS: Record<string, string> = {
  "veo-3.1-fast": "veo-3.1-fast-generate-preview",
  "veo-3.1": "veo-3.1-generate-preview",
};

interface VeoRequest {
  prompt: string;
  model?: "veo-3.1-fast" | "veo-3.1";
  image?: string; // Base64 data URL - first frame
  lastFrame?: string; // Base64 data URL - last frame (for interpolation)
  referenceImages?: string[]; // Up to 3 reference images for style/content guidance
  aspectRatio?: "16:9" | "9:16";
  resolution?: "720p" | "1080p" | "4k";
  durationSeconds?: number; // 4, 6, or 8
  negativePrompt?: string;
}

interface VeoImage {
  bytesBase64Encoded: string;
  mimeType: string;
}

interface VeoInstance {
  prompt: string;
  image?: VeoImage;
  lastFrame?: VeoImage;
  referenceImages?: VeoImage[];
}

interface VeoParameters {
  aspectRatio?: string;
  resolution?: string;
  durationSeconds?: number;
  negativePrompt?: string;
}

// Extract base64 data and mime type from data URL
function parseDataUrl(dataUrl: string): { base64: string; mimeType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

// Poll for operation completion
async function pollOperation(
  operationName: string,
  apiKey: string,
  maxAttempts = 60,
  intervalMs = 5000
): Promise<{ done: boolean; response?: unknown; error?: unknown }> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${BASE_URL}/${operationName}`, {
      headers: {
        "x-goog-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to poll operation: ${error}`);
    }

    const result = await response.json();

    if (result.done) {
      return result;
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Operation timed out");
}

// Download video from Google's file URI
async function downloadVideo(fileUri: string, apiKey: string): Promise<string> {
  // The URI format is like: https://generativelanguage.googleapis.com/v1beta/files/xxx
  // We need to add the API key
  const url = fileUri.includes("?") ? `${fileUri}&key=${apiKey}` : `${fileUri}?key=${apiKey}`;

  const response = await fetch(url, {
    headers: {
      "x-goog-api-key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.statusText}`);
  }

  // Convert to base64 data URL
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:video/mp4;base64,${base64}`;
}

// Extract last frame from video (simplified - returns placeholder for now)
// In production, you'd use ffmpeg or a video processing library
async function extractLastFrame(videoDataUrl: string): Promise<string> {
  // For now, return a placeholder - in production use ffmpeg
  // The video itself contains the last frame which can be extracted
  // This is a limitation that could be addressed with server-side ffmpeg
  return videoDataUrl; // Return video URL as placeholder - UI can extract frame
}

export async function POST(request: NextRequest) {
  try {
    const body: VeoRequest = await request.json();
    const { prompt, model, image, lastFrame, referenceImages, aspectRatio, resolution, durationSeconds, negativePrompt } = body;

    // Get the API model ID (default to fast)
    const modelId = MODEL_IDS[model || "veo-3.1-fast"];

    // Get API key from header or environment
    const apiKey = request.headers.get("x-gemini-api-key") || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "GEMINI_API_KEY not configured" },
        { status: 500 }
      );
    }

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Build the instance object
    const instance: VeoInstance = { prompt };

    // Add first frame if provided
    if (image) {
      const parsed = parseDataUrl(image);
      if (parsed) {
        instance.image = {
          bytesBase64Encoded: parsed.base64,
          mimeType: parsed.mimeType,
        };
      }
    }

    // Add reference images if provided (up to 3)
    if (referenceImages && referenceImages.length > 0) {
      const parsedRefs: VeoImage[] = [];
      for (const refImg of referenceImages.slice(0, 3)) {
        const parsed = parseDataUrl(refImg);
        if (parsed) {
          parsedRefs.push({
            bytesBase64Encoded: parsed.base64,
            mimeType: parsed.mimeType,
          });
        }
      }
      if (parsedRefs.length > 0) {
        instance.referenceImages = parsedRefs;
      }
    }

    // Add last frame if provided (for interpolation between frames)
    if (lastFrame) {
      const parsed = parseDataUrl(lastFrame);
      if (parsed) {
        instance.lastFrame = {
          bytesBase64Encoded: parsed.base64,
          mimeType: parsed.mimeType,
        };
      }
    }

    // Build parameters
    const parameters: VeoParameters = {};
    if (aspectRatio) parameters.aspectRatio = aspectRatio;
    if (resolution) parameters.resolution = resolution;
    if (durationSeconds) parameters.durationSeconds = durationSeconds;
    if (negativePrompt) parameters.negativePrompt = negativePrompt;

    // Start the video generation
    const generateResponse = await fetch(
      `${BASE_URL}/models/${modelId}:predictLongRunning`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instances: [instance],
          parameters: Object.keys(parameters).length > 0 ? parameters : undefined,
        }),
      }
    );

    if (!generateResponse.ok) {
      const error = await generateResponse.text();
      console.error("Veo API error:", error);
      return NextResponse.json(
        { success: false, error: `Veo API error: ${error}` },
        { status: generateResponse.status }
      );
    }

    const generateResult = await generateResponse.json();
    const operationName = generateResult.name;

    if (!operationName) {
      return NextResponse.json(
        { success: false, error: "No operation name returned" },
        { status: 500 }
      );
    }

    // Poll for completion (Veo can take 11 seconds to 6 minutes)
    const completedOperation = await pollOperation(operationName, apiKey, 72, 5000); // 6 min max

    if (completedOperation.error) {
      return NextResponse.json(
        { success: false, error: `Video generation failed: ${JSON.stringify(completedOperation.error)}` },
        { status: 500 }
      );
    }

    // Extract video URI from response
    // Response structure: response.generateVideoResponse.generatedSamples[0].video.uri
    const response = completedOperation.response as {
      generateVideoResponse?: {
        generatedSamples?: Array<{
          video?: { uri?: string };
        }>;
      };
      // Alternative structure
      generatedVideos?: Array<{
        video?: { uri?: string };
      }>;
    };

    let videoUri: string | undefined;

    // Try different response structures
    if (response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri) {
      videoUri = response.generateVideoResponse.generatedSamples[0].video.uri;
    } else if (response?.generatedVideos?.[0]?.video?.uri) {
      videoUri = response.generatedVideos[0].video.uri;
    }

    if (!videoUri) {
      console.error("Unexpected response structure:", JSON.stringify(completedOperation));
      return NextResponse.json(
        { success: false, error: "No video URI in response" },
        { status: 500 }
      );
    }

    // Download the video
    const videoDataUrl = await downloadVideo(videoUri, apiKey);

    // Extract last frame for chaining (placeholder for now)
    const extractedLastFrame = await extractLastFrame(videoDataUrl);

    return NextResponse.json({
      success: true,
      video: videoDataUrl,
      lastFrame: extractedLastFrame,
    });
  } catch (error) {
    console.error("Video generation error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Video generation failed" },
      { status: 500 }
    );
  }
}
