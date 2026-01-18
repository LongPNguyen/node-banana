import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { spawn } from "child_process";

export const maxDuration = 300; // 5 minute timeout for upscaling

interface UpscaleRequest {
  video: string; // Base64 data URL
  targetResolution: "1080p" | "1440p" | "4k";
  sharpen: boolean;
}

const RESOLUTION_MAP = {
  "1080p": { width: 1920, height: 1080 },
  "1440p": { width: 2560, height: 1440 },
  "4k": { width: 3840, height: 2160 },
};

/**
 * Execute ffmpeg command and return result
 */
async function runFFmpeg(args: string[]): Promise<{ success: boolean; error?: string; output?: string }> {
  return new Promise((resolve) => {
    const ffmpeg = spawn("ffmpeg", args);
    let stderr = "";

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      const lastOutput = stderr.slice(-1000);
      console.log(`[FFmpeg Upscale] Exit code: ${code}`);

      if (code === 0) {
        resolve({ success: true, output: lastOutput });
      } else {
        resolve({ success: false, error: stderr.slice(-500) });
      }
    });

    ffmpeg.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Get video info using ffprobe
 */
async function getVideoInfo(inputPath: string): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height:format=duration",
      "-of", "json",
      inputPath
    ]);

    let stdout = "";
    let stderr = "";

    ffprobe.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffprobe.on("close", (code) => {
      if (code === 0) {
        try {
          const info = JSON.parse(stdout);
          const width = info.streams?.[0]?.width || 1280;
          const height = info.streams?.[0]?.height || 720;
          const duration = parseFloat(info.format?.duration || "0");
          resolve({ width, height, duration });
        } catch {
          reject(new Error(`Failed to parse ffprobe output: ${stdout}`));
        }
      } else {
        reject(new Error(`ffprobe failed: ${stderr}`));
      }
    });

    ffprobe.on("error", (err) => {
      reject(err);
    });
  });
}

export async function POST(request: NextRequest) {
  let tempDir: string | null = null;

  try {
    const body: UpscaleRequest = await request.json();
    const { video, targetResolution, sharpen } = body;

    if (!video) {
      return NextResponse.json(
        { success: false, error: "Missing video data" },
        { status: 400 }
      );
    }

    if (!RESOLUTION_MAP[targetResolution]) {
      return NextResponse.json(
        { success: false, error: "Invalid target resolution" },
        { status: 400 }
      );
    }

    // Create temp directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "video-upscale-"));
    const inputPath = path.join(tempDir, "input.mp4");
    const outputPath = path.join(tempDir, "output.mp4");

    // Decode base64 video
    const base64Match = video.match(/^data:video\/[^;]+;base64,(.+)$/);
    if (!base64Match) {
      return NextResponse.json(
        { success: false, error: "Invalid video format - expected base64 data URL" },
        { status: 400 }
      );
    }

    const videoBuffer = Buffer.from(base64Match[1], "base64");
    await fs.writeFile(inputPath, videoBuffer);

    // Get original video info
    const videoInfo = await getVideoInfo(inputPath);
    const { width: targetWidth } = RESOLUTION_MAP[targetResolution];

    console.log(`[Video Upscale] Input: ${videoInfo.width}x${videoInfo.height}, Target: ${targetResolution}, Sharpen: ${sharpen}`);

    // Check if upscaling is needed
    if (videoInfo.width >= targetWidth) {
      console.log(`[Video Upscale] Video is already ${videoInfo.width}px wide, target is ${targetWidth}px. Skipping upscale.`);
      return NextResponse.json({
        success: true,
        video: video, // Return original
        originalResolution: `${videoInfo.width}x${videoInfo.height}`,
        newResolution: `${videoInfo.width}x${videoInfo.height}`,
        message: "Video already at or above target resolution",
      });
    }

    // Build filter chain
    // Use -2 for height to maintain aspect ratio (must be even number)
    let filterChain = `scale=${targetWidth}:-2:flags=lanczos`;

    // Add unsharp mask for sharpening if requested
    // unsharp=luma_msize_x:luma_msize_y:luma_amount:chroma_msize_x:chroma_msize_y:chroma_amount
    if (sharpen) {
      filterChain += ",unsharp=5:5:0.8:5:5:0.0";
    }

    const upscaleArgs = [
      "-y",
      "-i", inputPath,
      "-vf", filterChain,
      "-c:v", "libx264",
      "-preset", "slow", // Better quality for upscaling
      "-crf", "18", // Higher quality
      "-c:a", "aac",
      "-b:a", "192k",
      "-movflags", "+faststart",
      outputPath
    ];

    console.log(`[Video Upscale] Running: ffmpeg ${upscaleArgs.join(" ")}`);
    const result = await runFFmpeg(upscaleArgs);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: `Upscale failed: ${result.error}` },
        { status: 500 }
      );
    }

    // Get output video info
    const outputInfo = await getVideoInfo(outputPath);

    // Read upscaled video
    const upscaledBuffer = await fs.readFile(outputPath);
    const upscaledBase64 = `data:video/mp4;base64,${upscaledBuffer.toString("base64")}`;

    // Get file sizes for logging
    const inputStats = await fs.stat(inputPath);
    const outputStats = await fs.stat(outputPath);

    console.log(`[Video Upscale] Complete - ${videoInfo.width}x${videoInfo.height} -> ${outputInfo.width}x${outputInfo.height}`);
    console.log(`[Video Upscale] Input size: ${(inputStats.size / 1024 / 1024).toFixed(2)}MB, Output size: ${(outputStats.size / 1024 / 1024).toFixed(2)}MB`);

    return NextResponse.json({
      success: true,
      video: upscaledBase64,
      originalResolution: `${videoInfo.width}x${videoInfo.height}`,
      newResolution: `${outputInfo.width}x${outputInfo.height}`,
    });

  } catch (error) {
    console.error("[Video Upscale] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  } finally {
    // Cleanup temp directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
