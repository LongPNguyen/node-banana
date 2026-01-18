import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const BASE_URL = "https://api.kie.ai/api/v1/veo";
const FILE_UPLOAD_URL = "https://kieai.redpandaai.co/api/file-base64-upload";

// Model ID mapping for Kie AI
const MODEL_IDS: Record<string, string> = {
  "kieai-veo3-fast": "veo3_fast",
  "kieai-veo3": "veo3",
};

interface KieAiRequest {
  prompt: string;
  model?: "kieai-veo3-fast" | "kieai-veo3";
  image?: string; // Base64 data URL - first frame
  referenceImages?: string[]; // Up to 3 reference images for style/content guidance
  aspectRatio?: "16:9" | "9:16";
  duration?: number; // 4, 6, or 8 seconds
}

// Extract base64 data and mime type from data URL
function parseDataUrl(dataUrl: string): { base64: string; mimeType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

// Upload base64 image to Kie AI and get a URL back
async function uploadImageToKieAi(
  dataUrl: string,
  apiKey: string
): Promise<string> {
  const response = await fetch(FILE_UPLOAD_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      base64Data: dataUrl,  // Accepts full data URL format
      uploadPath: "video-frames",
      fileName: `frame-${Date.now()}.png`,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload image to Kie AI: ${error}`);
  }

  const result = await response.json();
  const fileUrl = result.data?.downloadUrl || result.data?.url || result.url || result.data?.fileUrl || result.fileUrl;

  if (!fileUrl) {
    console.error("Kie AI file upload response:", result);
    throw new Error("No URL returned from Kie AI file upload");
  }

  return fileUrl;
}

// Poll for task completion
// successFlag: 0 = Generating, 1 = Success, 2 = Failed, 3 = Generation Failed
async function pollTaskStatus(
  taskId: string,
  apiKey: string,
  maxAttempts = 120,
  intervalMs = 5000
): Promise<{ success: boolean; resultUrls?: string[]; error?: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${BASE_URL}/record-info?taskId=${taskId}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to poll task status: ${error}`);
    }

    const result = await response.json();
    const successFlag = result.data?.successFlag;

    console.log(`[Kie AI] Poll attempt ${i + 1}: successFlag=${successFlag}`);

    // Check if task is complete (successFlag = 1)
    if (successFlag === 1) {
      const resultUrls = result.data?.response?.resultUrls || result.data?.resultUrls || [];
      console.log("[Kie AI] Task completed, URLs:", resultUrls);
      return {
        success: true,
        resultUrls,
      };
    }

    // Check if task failed (successFlag = 2 or 3)
    if (successFlag === 2 || successFlag === 3) {
      const errorMsg = result.data?.errorMessage || result.data?.error || result.data?.message || "Video generation failed";
      console.error("[Kie AI] Generation failed:", JSON.stringify(result.data, null, 2));
      return {
        success: false,
        error: errorMsg,
      };
    }

    // successFlag = 0 means still generating, wait and poll again
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Task timed out");
}

// Download video from URL and convert to base64
async function downloadVideo(url: string): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:video/mp4;base64,${base64}`;
}

// Extract last frame from video using ffmpeg
function extractLastFrame(videoDataUrl: string): string | null {
  const tempId = `kieai_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const tempVideoPath = join(tmpdir(), `${tempId}.mp4`);
  const tempFramePath = join(tmpdir(), `${tempId}_frame.jpg`);

  try {
    // Parse the data URL to get raw video data
    const parsed = parseDataUrl(videoDataUrl);
    if (!parsed) {
      console.error("[Kie AI] Failed to parse video data URL for frame extraction");
      return null;
    }

    // Write video to temp file
    const videoBuffer = Buffer.from(parsed.base64, "base64");
    writeFileSync(tempVideoPath, videoBuffer);

    // Use ffmpeg to extract the last frame
    // -sseof -0.1 seeks to 0.1 seconds before the end
    // -frames:v 1 extracts only 1 frame
    try {
      execSync(
        `ffmpeg -y -sseof -0.1 -i "${tempVideoPath}" -frames:v 1 -q:v 2 "${tempFramePath}"`,
        { stdio: "pipe", timeout: 30000 }
      );
    } catch (ffmpegError) {
      // If sseof fails, try seeking to a high timestamp (will clamp to end)
      console.log("[Kie AI] sseof failed, trying alternative approach");
      execSync(
        `ffmpeg -y -ss 9999 -i "${tempVideoPath}" -frames:v 1 -q:v 2 "${tempFramePath}"`,
        { stdio: "pipe", timeout: 30000 }
      );
    }

    // Read the extracted frame
    if (existsSync(tempFramePath)) {
      const frameBuffer = readFileSync(tempFramePath);
      const frameBase64 = frameBuffer.toString("base64");
      console.log(`[Kie AI] Successfully extracted last frame (${Math.round(frameBuffer.length / 1024)}KB)`);
      return `data:image/jpeg;base64,${frameBase64}`;
    } else {
      console.error("[Kie AI] Frame file was not created");
      return null;
    }
  } catch (error) {
    console.error("[Kie AI] Failed to extract last frame:", error);
    return null;
  } finally {
    // Clean up temp files
    try {
      if (existsSync(tempVideoPath)) unlinkSync(tempVideoPath);
      if (existsSync(tempFramePath)) unlinkSync(tempFramePath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: KieAiRequest = await request.json();
    const { prompt, model, image, referenceImages, aspectRatio, duration } = body;

    // Get the Kie AI model ID (default to fast)
    const modelId = MODEL_IDS[model || "kieai-veo3-fast"];

    // Get API key from header
    const apiKey = request.headers.get("x-kieai-api-key");

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Kie AI API key not configured. Add it in Settings." },
        { status: 400 }
      );
    }

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Build the request body for Kie AI
    const requestBody: Record<string, unknown> = {
      prompt,
      model: modelId,
      aspect_ratio: aspectRatio || "9:16",
      duration: duration || 8,
    };

    // Collect all images to upload (first frame + reference images)
    const imageUrls: string[] = [];

    // Upload first frame if provided
    if (image) {
      console.log("[Kie AI] Uploading start frame image...");
      const imageUrl = await uploadImageToKieAi(image, apiKey);
      console.log("[Kie AI] Start frame uploaded, URL:", imageUrl);
      imageUrls.push(imageUrl);
    }

    // Upload reference images if provided (up to 3)
    if (referenceImages && referenceImages.length > 0) {
      console.log(`[Kie AI] Uploading ${Math.min(referenceImages.length, 3)} reference images...`);
      for (const refImg of referenceImages.slice(0, 3)) {
        try {
          const refUrl = await uploadImageToKieAi(refImg, apiKey);
          console.log("[Kie AI] Reference image uploaded, URL:", refUrl);
          imageUrls.push(refUrl);
        } catch (err) {
          console.error("[Kie AI] Failed to upload reference image:", err);
        }
      }
    }

    // Add all image URLs to the request
    if (imageUrls.length > 0) {
      requestBody.imageUrls = imageUrls;
      console.log(`[Kie AI] Total images for request: ${imageUrls.length}`);
    }

    // Start the video generation
    const generateResponse = await fetch(`${BASE_URL}/generate`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!generateResponse.ok) {
      const error = await generateResponse.text();
      console.error("Kie AI API error:", error);
      return NextResponse.json(
        { success: false, error: `Kie AI API error: ${error}` },
        { status: generateResponse.status }
      );
    }

    const generateResult = await generateResponse.json();
    const taskId = generateResult.data?.taskId || generateResult.taskId;

    if (!taskId) {
      console.error("Kie AI response:", generateResult);
      return NextResponse.json(
        { success: false, error: "No task ID returned from Kie AI" },
        { status: 500 }
      );
    }

    // Poll for completion (Kie AI can take a while)
    const completedTask = await pollTaskStatus(taskId, apiKey, 120, 5000); // 10 min max

    if (!completedTask.success) {
      return NextResponse.json(
        { success: false, error: completedTask.error || "Video generation failed" },
        { status: 500 }
      );
    }

    const videoUrl = completedTask.resultUrls?.[0];
    if (!videoUrl) {
      return NextResponse.json(
        { success: false, error: "No video URL in response" },
        { status: 500 }
      );
    }

    // Download the video and convert to base64
    const videoDataUrl = await downloadVideo(videoUrl);

    // Extract last frame using ffmpeg for video chaining
    const lastFrame = extractLastFrame(videoDataUrl);
    console.log(`[Kie AI] Last frame extracted: ${lastFrame ? "yes" : "no"}`);

    return NextResponse.json({
      success: true,
      video: videoDataUrl,
      lastFrame,
    });
  } catch (error) {
    console.error("Kie AI video generation error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Video generation failed" },
      { status: 500 }
    );
  }
}
