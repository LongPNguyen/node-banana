import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { spawn } from "child_process";

export const maxDuration = 120; // 2 minute timeout

interface TrimRequest {
  video: string; // Base64 data URL
  endTime: number; // End time in seconds (with millisecond precision)
}

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
      // Log the last part of ffmpeg output for debugging
      const lastOutput = stderr.slice(-1000);
      console.log(`[FFmpeg] Exit code: ${code}`);

      // Extract duration info from output
      const durationMatch = lastOutput.match(/Duration: (\d+:\d+:\d+\.\d+)/);
      const timeMatch = lastOutput.match(/time=(\d+:\d+:\d+\.\d+)/g);
      if (durationMatch) console.log(`[FFmpeg] Input duration: ${durationMatch[1]}`);
      if (timeMatch) console.log(`[FFmpeg] Output time: ${timeMatch[timeMatch.length - 1]}`);

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
 * Get video info using ffprobe (duration and fps)
 */
async function getVideoInfo(inputPath: string): Promise<{ duration: number; fps: number }> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "format=duration:stream=r_frame_rate",
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
          const duration = parseFloat(info.format?.duration || "0");
          // Parse frame rate (e.g., "24/1" or "30000/1001")
          const fpsStr = info.streams?.[0]?.r_frame_rate || "24/1";
          const [num, den] = fpsStr.split("/").map(Number);
          const fps = den ? num / den : num;
          resolve({ duration, fps: fps || 24 });
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

/**
 * Get video duration using ffprobe
 */
async function getVideoDuration(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
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
        const rawOutput = stdout.trim();
        const duration = parseFloat(rawOutput);
        console.log(`[FFprobe] Raw duration output: "${rawOutput}" -> ${duration}s`);
        resolve(duration);
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
    const body: TrimRequest = await request.json();
    const { video, endTime } = body;

    if (!video) {
      return NextResponse.json(
        { success: false, error: "Missing video data" },
        { status: 400 }
      );
    }

    if (typeof endTime !== "number" || endTime <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid end time" },
        { status: 400 }
      );
    }

    // Create temp directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "video-trim-"));
    const inputPath = path.join(tempDir, "input.mp4");
    const outputPath = path.join(tempDir, "output.mp4");
    const framePath = path.join(tempDir, "frame.png");

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

    // Get original video info (duration and fps) for validation
    const videoInfo = await getVideoInfo(inputPath);
    const originalDuration = videoInfo.duration;
    const fps = videoInfo.fps;
    const trimEndTime = Math.min(endTime, originalDuration);

    console.log(`[Video Trim] Original duration: ${originalDuration}s, FPS: ${fps}, trimming to: ${trimEndTime}s`);

    // Trim video using ffmpeg with re-encoding to ensure correct metadata
    // Re-encoding is slower but gives accurate duration in the output container

    // Key fix: Use -accurate_seek BEFORE -i, and -to for end time (not -t for duration)
    // This ensures frame-accurate trimming rather than keyframe-based

    // Calculate frame count using actual fps
    const frameCount = Math.floor(trimEndTime * fps);

    // Use video/audio trim filters - most reliable for precise trimming
    // This works at the filter level and properly sets the output duration
    const trimArgs = [
      "-y",
      "-i", inputPath,
      "-vf", `trim=start=0:end=${trimEndTime.toFixed(3)},setpts=PTS-STARTPTS`,
      "-af", `atrim=start=0:end=${trimEndTime.toFixed(3)},asetpts=PTS-STARTPTS`,
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-c:a", "aac",
      "-movflags", "+faststart",
      outputPath
    ];
    console.log(`[Video Trim] Running: ffmpeg ${trimArgs.join(" ")}`);
    let trimResult = await runFFmpeg(trimArgs);

    // Check if trim produced correct duration
    let outputDuration = 0;
    try {
      outputDuration = await getVideoDuration(outputPath);
    } catch {
      outputDuration = 0;
    }
    console.log(`[Video Trim] First attempt duration: ${outputDuration}s (target: ${trimEndTime}s), diff: ${Math.abs(outputDuration - trimEndTime).toFixed(3)}s`);

    // If off by more than 1 frame (at 24fps that's ~0.042s), try another approach
    if (!trimResult.success || Math.abs(outputDuration - trimEndTime) > 0.05) {
      console.log(`[Video Trim] First attempt resulted in ${outputDuration}s, trying frame-based trim...`);

      const reencodeArgs = [
        "-y",
        "-accurate_seek",
        "-ss", "0",
        "-i", inputPath,
        "-to", trimEndTime.toFixed(3),
        "-frames:v", frameCount.toString(),  // Also limit by frame count as safety
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-shortest",  // Make audio match video length
        "-vsync", "vfr",
        "-fflags", "+genpts",  // Regenerate timestamps
        "-movflags", "+faststart",
        outputPath
      ];
      console.log(`[Video Trim] Re-encoding with ${frameCount} frames: ffmpeg ${reencodeArgs.join(" ")}`);
      trimResult = await runFFmpeg(reencodeArgs);

      // Check second attempt duration
      try {
        outputDuration = await getVideoDuration(outputPath);
        console.log(`[Video Trim] Second attempt duration: ${outputDuration}s (target: ${trimEndTime}s), diff: ${Math.abs(outputDuration - trimEndTime).toFixed(3)}s`);
      } catch {
        outputDuration = 0;
      }
    }

    // Third attempt: Use -t with copy codec (sometimes metadata issues are codec-related)
    if (!trimResult.success || Math.abs(outputDuration - trimEndTime) > 0.05) {
      console.log(`[Video Trim] Second attempt resulted in ${outputDuration}s, trying -t based trim...`);

      // Use a slightly different encoding approach with explicit duration
      const filterArgs = [
        "-y",
        "-i", inputPath,
        "-t", trimEndTime.toFixed(3),
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-avoid_negative_ts", "make_zero",
        "-fflags", "+genpts+igndts",
        "-movflags", "+faststart",
        outputPath
      ];
      console.log(`[Video Trim] Using -t duration: ffmpeg ${filterArgs.join(" ")}`);
      trimResult = await runFFmpeg(filterArgs);

      // Check third attempt duration
      try {
        outputDuration = await getVideoDuration(outputPath);
        console.log(`[Video Trim] Third attempt duration: ${outputDuration}s (target: ${trimEndTime}s), diff: ${Math.abs(outputDuration - trimEndTime).toFixed(3)}s`);
      } catch {
        outputDuration = 0;
      }
    }

    if (!trimResult.success) {
      return NextResponse.json(
        { success: false, error: `Trim failed: ${trimResult.error}` },
        { status: 500 }
      );
    }

    // Extract last frame at the trim point
    // Seek to slightly before the end to get a clean frame
    const frameTime = Math.max(0, trimEndTime - 0.01);
    const frameResult = await runFFmpeg([
      "-y",
      "-ss", frameTime.toFixed(3),
      "-i", inputPath,
      "-vframes", "1",
      "-f", "image2",
      framePath
    ]);

    if (!frameResult.success) {
      console.warn(`[Video Trim] Frame extraction failed: ${frameResult.error}`);
    }

    // Read trimmed video
    const trimmedBuffer = await fs.readFile(outputPath);
    const trimmedBase64 = `data:video/mp4;base64,${trimmedBuffer.toString("base64")}`;

    // Read extracted frame if available
    let frameBase64: string | null = null;
    try {
      const frameBuffer = await fs.readFile(framePath);
      frameBase64 = `data:image/png;base64,${frameBuffer.toString("base64")}`;
    } catch {
      console.warn("[Video Trim] Could not read extracted frame");
    }

    // Get new duration
    const newDuration = await getVideoDuration(outputPath);

    // Get file sizes for debugging
    const inputStats = await fs.stat(inputPath);
    const outputStats = await fs.stat(outputPath);

    console.log(`[Video Trim] Complete - new duration: ${newDuration}s`);
    console.log(`[Video Trim] Input size: ${(inputStats.size / 1024 / 1024).toFixed(2)}MB, Output size: ${(outputStats.size / 1024 / 1024).toFixed(2)}MB`);

    return NextResponse.json({
      success: true,
      video: trimmedBase64,
      frame: frameBase64,
      duration: newDuration,
      originalDuration,
    });

  } catch (error) {
    console.error("[Video Trim] Error:", error);
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

// GET endpoint to get video info (duration, etc.)
export async function GET(request: NextRequest) {
  const videoUrl = request.nextUrl.searchParams.get("video");

  if (!videoUrl) {
    return NextResponse.json(
      { success: false, error: "Missing video parameter" },
      { status: 400 }
    );
  }

  // For now, just return success - client-side can get duration from video element
  return NextResponse.json({ success: true });
}
