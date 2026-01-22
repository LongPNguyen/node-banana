import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Kie AI API endpoints
const JOBS_URL = "https://api.kie.ai/api/v1/jobs";
const FILE_UPLOAD_URL = "https://kieai.redpandaai.co/api/file-base64-upload";

interface MotionCaptureRequest {
  referenceImage: string; // Base64 data URL - character to animate
  sourceVideo: string; // Base64 data URL - motion source
  characterOrientation?: "image" | "video"; // Match image or video orientation
  mode?: "720p" | "1080p"; // Output resolution
  prompt?: string; // Optional scene description
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
  apiKey: string,
  prefix: string = "image"
): Promise<string> {
  const response = await fetch(FILE_UPLOAD_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      base64Data: dataUrl,
      uploadPath: "motion-capture",
      fileName: `${prefix}-${Date.now()}.png`,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload ${prefix} to Kie AI: ${error}`);
  }

  const result = await response.json();
  const fileUrl = result.data?.downloadUrl || result.data?.url || result.url || result.data?.fileUrl || result.fileUrl;

  if (!fileUrl) {
    console.error(`Kie AI ${prefix} upload response:`, result);
    throw new Error(`No URL returned from Kie AI ${prefix} upload`);
  }

  return fileUrl;
}

// Upload video to Kie AI file service
async function uploadVideoToKieAi(
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
      base64Data: dataUrl,
      uploadPath: "motion-capture",
      fileName: `video-${Date.now()}.mp4`,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload video to Kie AI: ${error}`);
  }

  const result = await response.json();
  const fileUrl = result.data?.downloadUrl || result.data?.url || result.url || result.data?.fileUrl || result.fileUrl;

  if (!fileUrl) {
    console.error("Kie AI video upload response:", result);
    throw new Error("No URL returned from Kie AI video upload");
  }

  return fileUrl;
}

// Poll for task completion
// state: "waiting" = in progress, "success" = done, "fail" = failed
async function pollTaskStatus(
  taskId: string,
  apiKey: string,
  maxAttempts = 180, // Motion capture can take longer
  intervalMs = 5000
): Promise<{ success: boolean; resultUrls?: string[]; error?: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${JOBS_URL}/recordInfo?taskId=${taskId}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to poll task status: ${error}`);
    }

    const result = await response.json();
    const state = result.data?.state;

    console.log(`[Motion Capture] Poll attempt ${i + 1}: state=${state}`);

    if (state === "success") {
      // resultJson is a JSON string that needs to be parsed
      let resultUrls: string[] = [];
      try {
        const resultJson = JSON.parse(result.data?.resultJson || "{}");
        resultUrls = resultJson.resultUrls || [];
      } catch {
        console.error("[Motion Capture] Failed to parse resultJson:", result.data?.resultJson);
      }
      console.log("[Motion Capture] Task completed, URLs:", resultUrls);
      return {
        success: true,
        resultUrls,
      };
    }

    if (state === "fail") {
      const errorMsg = result.data?.failMsg || result.data?.failCode || "Motion capture failed";
      console.error("[Motion Capture] Generation failed:", JSON.stringify(result.data, null, 2));
      return {
        success: false,
        error: errorMsg,
      };
    }

    // state === "waiting" - continue polling
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
  const tempId = `motion_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const tempVideoPath = join(tmpdir(), `${tempId}.mp4`);
  const tempFramePath = join(tmpdir(), `${tempId}_frame.jpg`);

  try {
    const parsed = parseDataUrl(videoDataUrl);
    if (!parsed) {
      console.error("[Motion Capture] Failed to parse video data URL for frame extraction");
      return null;
    }

    const videoBuffer = Buffer.from(parsed.base64, "base64");
    writeFileSync(tempVideoPath, videoBuffer);

    try {
      execSync(
        `ffmpeg -y -sseof -0.1 -i "${tempVideoPath}" -frames:v 1 -q:v 2 "${tempFramePath}"`,
        { stdio: "pipe", timeout: 30000 }
      );
    } catch {
      console.log("[Motion Capture] sseof failed, trying alternative approach");
      execSync(
        `ffmpeg -y -ss 9999 -i "${tempVideoPath}" -frames:v 1 -q:v 2 "${tempFramePath}"`,
        { stdio: "pipe", timeout: 30000 }
      );
    }

    if (existsSync(tempFramePath)) {
      const frameBuffer = readFileSync(tempFramePath);
      const frameBase64 = frameBuffer.toString("base64");
      console.log(`[Motion Capture] Successfully extracted last frame (${Math.round(frameBuffer.length / 1024)}KB)`);
      return `data:image/jpeg;base64,${frameBase64}`;
    } else {
      console.error("[Motion Capture] Frame file was not created");
      return null;
    }
  } catch (error) {
    console.error("[Motion Capture] Failed to extract last frame:", error);
    return null;
  } finally {
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
    const body: MotionCaptureRequest = await request.json();
    const { referenceImage, sourceVideo, characterOrientation = "image", mode = "720p", prompt } = body;

    // Get API key from header first, then fallback to env
    const apiKey = request.headers.get("x-kieai-api-key") || process.env.KIEAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Kie AI API key not configured. Add it in Settings." },
        { status: 400 }
      );
    }

    if (!referenceImage) {
      return NextResponse.json(
        { success: false, error: "Reference image is required" },
        { status: 400 }
      );
    }

    if (!sourceVideo) {
      return NextResponse.json(
        { success: false, error: "Source video is required" },
        { status: 400 }
      );
    }

    // Upload the reference image
    console.log("[Motion Capture] Uploading reference image...");
    const imageUrl = await uploadImageToKieAi(referenceImage, apiKey, "reference");
    console.log("[Motion Capture] Reference image uploaded:", imageUrl);

    // Upload the source video
    console.log("[Motion Capture] Uploading source video...");
    const videoUrl = await uploadVideoToKieAi(sourceVideo, apiKey);
    console.log("[Motion Capture] Source video uploaded:", videoUrl);

    // Build the motion capture request
    // Kling 2.6 Motion Control API parameters - wrapped in 'input' object
    const inputParams: Record<string, unknown> = {
      input_urls: [imageUrl], // Character image(s)
      video_urls: [videoUrl], // Motion source video
      character_orientation: characterOrientation, // "image" or "video"
      mode: mode, // "720p" or "1080p"
    };

    // Add optional prompt if provided
    if (prompt && prompt.trim()) {
      inputParams.prompt = prompt.trim();
    }

    const requestBody = {
      model: "kling-2.6/motion-control", // Kling 2.6 Motion Control model
      input: inputParams,
    };

    console.log("[Motion Capture] Starting generation with request:", JSON.stringify(requestBody, null, 2));

    // Start the motion capture generation using createTask endpoint
    const generateResponse = await fetch(`${JOBS_URL}/createTask`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!generateResponse.ok) {
      const error = await generateResponse.text();
      console.error("[Motion Capture] API error:", error);
      return NextResponse.json(
        { success: false, error: `Kie AI API error: ${error}` },
        { status: generateResponse.status }
      );
    }

    const generateResult = await generateResponse.json();
    const taskId = generateResult.data?.taskId || generateResult.taskId;

    if (!taskId) {
      console.error("[Motion Capture] Response:", generateResult);
      return NextResponse.json(
        { success: false, error: "No task ID returned from Kie AI" },
        { status: 500 }
      );
    }

    console.log("[Motion Capture] Task started, ID:", taskId);

    // Poll for completion (motion capture can take longer - up to 15 min)
    const completedTask = await pollTaskStatus(taskId, apiKey, 180, 5000);

    if (!completedTask.success) {
      return NextResponse.json(
        { success: false, error: completedTask.error || "Motion capture failed" },
        { status: 500 }
      );
    }

    const resultVideoUrl = completedTask.resultUrls?.[0];
    if (!resultVideoUrl) {
      return NextResponse.json(
        { success: false, error: "No video URL in response" },
        { status: 500 }
      );
    }

    // Download the video and convert to base64
    console.log("[Motion Capture] Downloading result video...");
    const videoDataUrl = await downloadVideo(resultVideoUrl);

    // Extract last frame for potential chaining
    const lastFrame = extractLastFrame(videoDataUrl);
    console.log(`[Motion Capture] Complete! Last frame extracted: ${lastFrame ? "yes" : "no"}`);

    return NextResponse.json({
      success: true,
      video: videoDataUrl,
      lastFrame,
    });
  } catch (error) {
    console.error("[Motion Capture] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Motion capture failed" },
      { status: 500 }
    );
  }
}
