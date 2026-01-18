import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink, mkdir, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { spawn } from "child_process";
import { existsSync } from "fs";

interface VideoInput {
  video: string; // Base64 data URL
  chunkIndex: number;
}

interface StitchRequest {
  videos: VideoInput[];
}

// Extract base64 data from data URL
function extractBase64(dataUrl: string): { data: Buffer; mimeType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    data: Buffer.from(match[2], "base64"),
  };
}

// Run ffmpeg command
function runFFmpeg(args: string[]): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const ffmpeg = spawn("ffmpeg", args);
    let stderr = "";

    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        console.error("FFmpeg stderr:", stderr);
        resolve({ success: false, error: `FFmpeg exited with code ${code}` });
      }
    });

    ffmpeg.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

export async function POST(request: NextRequest) {
  const tempDir = join(tmpdir(), `video-stitch-${Date.now()}`);
  const inputFiles: string[] = [];

  try {
    const body: StitchRequest = await request.json();
    const { videos } = body;

    if (!videos || videos.length === 0) {
      return NextResponse.json(
        { success: false, error: "No videos provided" },
        { status: 400 }
      );
    }

    if (videos.length === 1) {
      // Only one video, just return it as-is
      return NextResponse.json({
        success: true,
        video: videos[0].video,
      });
    }

    // Sort videos by chunkIndex
    const sortedVideos = [...videos].sort((a, b) => a.chunkIndex - b.chunkIndex);

    // Create temp directory
    await mkdir(tempDir, { recursive: true });

    // Write videos to temp files
    for (let i = 0; i < sortedVideos.length; i++) {
      const video = sortedVideos[i];
      const extracted = extractBase64(video.video);

      if (!extracted) {
        throw new Error(`Invalid video data URL at index ${i}`);
      }

      const inputPath = join(tempDir, `input_${i}.mp4`);
      await writeFile(inputPath, extracted.data);
      inputFiles.push(inputPath);
    }

    // Create concat file for ffmpeg
    const concatFilePath = join(tempDir, "concat.txt");
    const concatContent = inputFiles.map((f) => `file '${f}'`).join("\n");
    await writeFile(concatFilePath, concatContent);

    // Output path
    const outputPath = join(tempDir, "output.mp4");

    // Run ffmpeg to concatenate
    console.log(`[Video Stitch] Concatenating ${inputFiles.length} videos...`);

    const result = await runFFmpeg([
      "-f", "concat",
      "-safe", "0",
      "-i", concatFilePath,
      "-c", "copy", // Copy without re-encoding for speed
      "-y", // Overwrite output
      outputPath,
    ]);

    if (!result.success) {
      // Try with re-encoding if copy failed (different codecs)
      console.log("[Video Stitch] Copy failed, trying with re-encoding...");
      const reencodeResult = await runFFmpeg([
        "-f", "concat",
        "-safe", "0",
        "-i", concatFilePath,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        "-y",
        outputPath,
      ]);

      if (!reencodeResult.success) {
        throw new Error(reencodeResult.error || "FFmpeg concatenation failed");
      }
    }

    // Read output file and convert to base64
    if (!existsSync(outputPath)) {
      throw new Error("Output file was not created");
    }

    const outputBuffer = await readFile(outputPath);
    const outputBase64 = `data:video/mp4;base64,${outputBuffer.toString("base64")}`;

    console.log(`[Video Stitch] Successfully stitched ${inputFiles.length} videos`);

    return NextResponse.json({
      success: true,
      video: outputBase64,
    });
  } catch (error) {
    console.error("Video stitch error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Video stitching failed" },
      { status: 500 }
    );
  } finally {
    // Cleanup temp files
    try {
      for (const file of inputFiles) {
        if (existsSync(file)) {
          await unlink(file);
        }
      }
      const concatFile = join(tempDir, "concat.txt");
      if (existsSync(concatFile)) {
        await unlink(concatFile);
      }
      const outputFile = join(tempDir, "output.mp4");
      if (existsSync(outputFile)) {
        await unlink(outputFile);
      }
      // Remove temp directory
      if (existsSync(tempDir)) {
        const { rmdir } = await import("fs/promises");
        await rmdir(tempDir);
      }
    } catch (cleanupError) {
      console.error("Cleanup error:", cleanupError);
    }
  }
}
