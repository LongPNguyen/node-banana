import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";

export const maxDuration = 300; // 5 minute timeout

interface DenoiseRequest {
  video: string; // Base64 data URL
  noiseReduction: "light" | "medium" | "heavy";
}

// FFmpeg filter chains by noise reduction level
// Using gentler filters that preserve voice quality while reducing noise
const NOISE_FILTERS: Record<string, string> = {
  // Light: Remove subsonic rumble only, gentle noise reduction, normalize volume
  light: "highpass=f=60,afftdn=nf=-20:nt=w,dynaudnorm=p=0.9:s=5",
  // Medium: Slightly tighter low cut, moderate noise reduction, normalize
  medium: "highpass=f=80,afftdn=nf=-25:nt=w,dynaudnorm=p=0.9:s=5",
  // Heavy: More aggressive noise reduction but preserve frequency range, normalize
  heavy: "highpass=f=80,afftdn=nf=-30:nt=w:om=o,dynaudnorm=p=0.95:s=3",
};

async function runFFmpeg(args: string[]): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    console.log("[AudioDenoise] Running FFmpeg:", args.join(" "));
    const ffmpeg = spawn("ffmpeg", args);

    let stderr = "";
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        console.error("[AudioDenoise] FFmpeg failed:", stderr);
        resolve({ success: false, error: stderr });
      }
    });

    ffmpeg.on("error", (err) => {
      console.error("[AudioDenoise] FFmpeg spawn error:", err);
      resolve({ success: false, error: err.message });
    });
  });
}

export async function POST(request: NextRequest) {
  const tempFiles: string[] = [];

  try {
    const { video, noiseReduction }: DenoiseRequest = await request.json();

    if (!video) {
      return NextResponse.json({ success: false, error: "No video provided" }, { status: 400 });
    }

    if (!NOISE_FILTERS[noiseReduction]) {
      return NextResponse.json(
        { success: false, error: "Invalid noise reduction level" },
        { status: 400 }
      );
    }

    // Extract base64 data
    const base64Match = video.match(/^data:video\/(\w+);base64,(.+)$/);
    if (!base64Match) {
      return NextResponse.json({ success: false, error: "Invalid video data URL" }, { status: 400 });
    }

    const [, format, base64Data] = base64Match;
    const videoBuffer = Buffer.from(base64Data, "base64");

    // Create temp files
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const inputPath = path.join(tempDir, `denoise_input_${timestamp}.${format}`);
    const outputPath = path.join(tempDir, `denoise_output_${timestamp}.mp4`);
    tempFiles.push(inputPath, outputPath);

    // Write input video
    await fs.writeFile(inputPath, videoBuffer);
    console.log(`[AudioDenoise] Input video saved: ${inputPath}`);

    // Get audio filter chain for the requested level
    const audioFilter = NOISE_FILTERS[noiseReduction];
    console.log(`[AudioDenoise] Applying ${noiseReduction} noise reduction: ${audioFilter}`);

    // Run FFmpeg with audio noise reduction
    const ffmpegArgs = [
      "-y",
      "-i", inputPath,
      "-vcodec", "copy", // Keep video as-is
      "-af", audioFilter,
      "-c:a", "aac",
      "-b:a", "192k",
      outputPath,
    ];

    const result = await runFFmpeg(ffmpegArgs);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: `FFmpeg failed: ${result.error}` },
        { status: 500 }
      );
    }

    // Read output file
    const outputBuffer = await fs.readFile(outputPath);
    const outputBase64 = `data:video/mp4;base64,${outputBuffer.toString("base64")}`;

    console.log(`[AudioDenoise] Success - applied ${noiseReduction} noise reduction`);

    return NextResponse.json({
      success: true,
      video: outputBase64,
      noiseReduction,
    });
  } catch (error) {
    console.error("[AudioDenoise] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  } finally {
    // Cleanup temp files
    for (const file of tempFiles) {
      try {
        await fs.unlink(file);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
