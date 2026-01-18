import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

interface SaveVideoRequest {
  video: string; // Base64 data URL
  folder: string; // Folder path
  filename?: string; // Optional custom filename
}

// Extract base64 data from data URL
function extractBase64(dataUrl: string): Buffer | null {
  const match = dataUrl.match(/^data:video\/[^;]+;base64,(.+)$/);
  if (!match) return null;
  return Buffer.from(match[1], "base64");
}

export async function POST(request: NextRequest) {
  try {
    const body: SaveVideoRequest = await request.json();
    const { video, folder, filename } = body;

    if (!video) {
      return NextResponse.json(
        { success: false, error: "No video data provided" },
        { status: 400 }
      );
    }

    if (!folder) {
      return NextResponse.json(
        { success: false, error: "No folder path provided" },
        { status: 400 }
      );
    }

    // Extract video data
    const videoBuffer = extractBase64(video);
    if (!videoBuffer) {
      return NextResponse.json(
        { success: false, error: "Invalid video data URL format" },
        { status: 400 }
      );
    }

    // Ensure folder exists
    if (!existsSync(folder)) {
      await mkdir(folder, { recursive: true });
    }

    // Generate filename with timestamp if not provided
    const finalFilename = filename || `stitched_${new Date().toISOString().replace(/[:.]/g, "-")}.mp4`;
    const filePath = join(folder, finalFilename);

    // Write the video file
    await writeFile(filePath, videoBuffer);

    console.log(`[Save Video] Saved to: ${filePath}`);

    return NextResponse.json({
      success: true,
      path: filePath,
      filename: finalFilename,
    });
  } catch (error) {
    console.error("Save video error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to save video" },
      { status: 500 }
    );
  }
}
