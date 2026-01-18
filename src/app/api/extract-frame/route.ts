import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

interface ExtractFrameRequest {
  video: string; // Base64 data URL
}

// Parse data URL to get base64 and mime type
function parseDataUrl(dataUrl: string): { base64: string; mimeType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

export async function POST(request: NextRequest) {
  const tempId = `frame_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const tempVideoPath = join(tmpdir(), `${tempId}.mp4`);
  const tempFramePath = join(tmpdir(), `${tempId}_frame.jpg`);

  try {
    const body: ExtractFrameRequest = await request.json();
    const { video } = body;

    if (!video) {
      return NextResponse.json(
        { success: false, error: "No video data provided" },
        { status: 400 }
      );
    }

    // Parse the data URL to get raw video data
    const parsed = parseDataUrl(video);
    if (!parsed) {
      return NextResponse.json(
        { success: false, error: "Invalid video data URL format" },
        { status: 400 }
      );
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
    } catch {
      // If sseof fails, try seeking to a high timestamp (will clamp to end)
      console.log("[Extract Frame] sseof failed, trying alternative approach");
      execSync(
        `ffmpeg -y -ss 9999 -i "${tempVideoPath}" -frames:v 1 -q:v 2 "${tempFramePath}"`,
        { stdio: "pipe", timeout: 30000 }
      );
    }

    // Read the extracted frame
    if (existsSync(tempFramePath)) {
      const frameBuffer = readFileSync(tempFramePath);
      const frameBase64 = frameBuffer.toString("base64");
      console.log(`[Extract Frame] Successfully extracted last frame (${Math.round(frameBuffer.length / 1024)}KB)`);

      return NextResponse.json({
        success: true,
        frame: `data:image/jpeg;base64,${frameBase64}`,
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Frame file was not created" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Extract Frame] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to extract frame" },
      { status: 500 }
    );
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
