import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

export const maxDuration = 600; // 10 minute timeout (combines image gen + motion capture)
export const dynamic = "force-dynamic";

interface GreenScreenRequest {
  inputVideo: string; // Base64 data URL
  prompt: string; // Prompt for green screen generation
  resolution?: "720p" | "1080p";
  greenColor?: string; // Hex color for green screen
}

// Parse data URL to get base64 and mime type
function parseDataUrl(dataUrl: string): { base64: string; mimeType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

// Extract first frame from video using ffmpeg
function extractFirstFrame(videoDataUrl: string): string | null {
  const tempId = `greenscreen_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const tempVideoPath = join(tmpdir(), `${tempId}.mp4`);
  const tempFramePath = join(tmpdir(), `${tempId}_frame.jpg`);

  try {
    const parsed = parseDataUrl(videoDataUrl);
    if (!parsed) {
      console.error("[Green Screen] Failed to parse video data URL");
      return null;
    }

    const videoBuffer = Buffer.from(parsed.base64, "base64");
    writeFileSync(tempVideoPath, videoBuffer);

    // Extract first frame
    execSync(
      `ffmpeg -y -i "${tempVideoPath}" -frames:v 1 -q:v 2 "${tempFramePath}"`,
      { stdio: "pipe", timeout: 30000 }
    );

    if (existsSync(tempFramePath)) {
      const frameBuffer = readFileSync(tempFramePath);
      const frameBase64 = frameBuffer.toString("base64");
      console.log(`[Green Screen] Extracted first frame (${Math.round(frameBuffer.length / 1024)}KB)`);
      return `data:image/jpeg;base64,${frameBase64}`;
    } else {
      console.error("[Green Screen] Frame file was not created");
      return null;
    }
  } catch (error) {
    console.error("[Green Screen] Failed to extract first frame:", error);
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

// Extract last frame from video using ffmpeg
function extractLastFrame(videoDataUrl: string): string | null {
  const tempId = `greenscreen_last_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const tempVideoPath = join(tmpdir(), `${tempId}.mp4`);
  const tempFramePath = join(tmpdir(), `${tempId}_frame.jpg`);

  try {
    const parsed = parseDataUrl(videoDataUrl);
    if (!parsed) {
      console.error("[Green Screen] Failed to parse video data URL for last frame");
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
      console.log("[Green Screen] sseof failed, trying alternative approach");
      execSync(
        `ffmpeg -y -ss 9999 -i "${tempVideoPath}" -frames:v 1 -q:v 2 "${tempFramePath}"`,
        { stdio: "pipe", timeout: 30000 }
      );
    }

    if (existsSync(tempFramePath)) {
      const frameBuffer = readFileSync(tempFramePath);
      const frameBase64 = frameBuffer.toString("base64");
      console.log(`[Green Screen] Extracted last frame (${Math.round(frameBuffer.length / 1024)}KB)`);
      return `data:image/jpeg;base64,${frameBase64}`;
    } else {
      console.error("[Green Screen] Last frame file was not created");
      return null;
    }
  } catch (error) {
    console.error("[Green Screen] Failed to extract last frame:", error);
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
  const requestId = Math.random().toString(36).substring(7);
  console.log(`\n[Green Screen:${requestId}] ========== NEW GREEN SCREEN REQUEST ==========`);

  try {
    const body: GreenScreenRequest = await request.json();
    const { inputVideo, prompt, resolution = "720p" } = body;

    // Get API keys
    const geminiApiKey = request.headers.get("x-gemini-api-key") || process.env.GEMINI_API_KEY;
    const kieAiApiKey = request.headers.get("x-kieai-api-key") || process.env.KIEAI_API_KEY;

    if (!geminiApiKey) {
      return NextResponse.json(
        { success: false, error: "Gemini API key not configured. Add it in Settings." },
        { status: 400 }
      );
    }

    if (!kieAiApiKey) {
      return NextResponse.json(
        { success: false, error: "Kie AI API key not configured. Add it in Settings." },
        { status: 400 }
      );
    }

    if (!inputVideo) {
      return NextResponse.json(
        { success: false, error: "Input video is required" },
        { status: 400 }
      );
    }

    // Step 1: Extract first frame from video
    console.log(`[Green Screen:${requestId}] Step 1: Extracting first frame...`);
    const firstFrame = extractFirstFrame(inputVideo);

    if (!firstFrame) {
      return NextResponse.json(
        { success: false, error: "Failed to extract first frame from video" },
        { status: 500 }
      );
    }
    console.log(`[Green Screen:${requestId}] First frame extracted successfully`);

    // Step 2: Generate green screen image using NanoBanana
    console.log(`[Green Screen:${requestId}] Step 2: Generating green screen image...`);

    const generateResponse = await fetch(new URL("/api/generate", request.url).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-gemini-api-key": geminiApiKey,
      },
      body: JSON.stringify({
        images: [firstFrame],
        prompt: prompt,
        model: "nano-banana-pro",
        aspectRatio: "9:16", // Portrait for most video content
        resolution: "1K",
      }),
    });

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();
      console.error(`[Green Screen:${requestId}] Image generation failed:`, errorText);
      return NextResponse.json(
        { success: false, error: `Image generation failed: ${errorText}` },
        { status: 500 }
      );
    }

    const generateResult = await generateResponse.json();

    if (!generateResult.success || !generateResult.image) {
      return NextResponse.json(
        { success: false, error: generateResult.error || "No image generated" },
        { status: 500 }
      );
    }

    const greenScreenImage = generateResult.image;
    console.log(`[Green Screen:${requestId}] Green screen image generated successfully`);

    // Step 3: Run motion capture with green screen image and original video
    console.log(`[Green Screen:${requestId}] Step 3: Running motion capture...`);

    const motionCaptureResponse = await fetch(new URL("/api/motion-capture", request.url).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-kieai-api-key": kieAiApiKey,
      },
      body: JSON.stringify({
        referenceImage: greenScreenImage,
        sourceVideo: inputVideo,
        characterOrientation: "image",
        mode: resolution,
      }),
    });

    if (!motionCaptureResponse.ok) {
      const errorText = await motionCaptureResponse.text();
      console.error(`[Green Screen:${requestId}] Motion capture failed:`, errorText);
      return NextResponse.json(
        { success: false, error: `Motion capture failed: ${errorText}` },
        { status: 500 }
      );
    }

    const motionCaptureResult = await motionCaptureResponse.json();

    if (!motionCaptureResult.success || !motionCaptureResult.video) {
      return NextResponse.json(
        { success: false, error: motionCaptureResult.error || "Motion capture failed" },
        { status: 500 }
      );
    }

    console.log(`[Green Screen:${requestId}] Motion capture completed successfully`);

    // Extract last frame from output video
    const lastFrame = extractLastFrame(motionCaptureResult.video);

    console.log(`[Green Screen:${requestId}] ✓ Green screen pipeline complete!`);

    return NextResponse.json({
      success: true,
      extractedFrame: firstFrame,
      greenScreenImage: greenScreenImage,
      video: motionCaptureResult.video,
      lastFrame: lastFrame || motionCaptureResult.lastFrame,
    });

  } catch (error) {
    console.error(`[Green Screen:${requestId}] Error:`, error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Green screen processing failed" },
      { status: 500 }
    );
  }
}
