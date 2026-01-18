import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";

export const maxDuration = 300; // 5 minute timeout

interface IsolateRequest {
  video: string; // Base64 data URL
}

async function extractAudioFromVideo(videoPath: string, audioPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-i", videoPath,
      "-vn", // No video
      "-acodec", "libmp3lame",
      "-q:a", "2", // High quality
      audioPath,
    ]);

    ffmpeg.on("close", (code) => resolve(code === 0));
    ffmpeg.on("error", () => resolve(false));
  });
}

async function mergeAudioWithVideo(
  videoPath: string,
  audioPath: string,
  outputPath: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-i", videoPath,
      "-i", audioPath,
      "-c:v", "copy", // Keep video as-is
      "-map", "0:v:0", // Use video from first input
      "-map", "1:a:0", // Use audio from second input
      "-shortest",
      outputPath,
    ]);

    ffmpeg.on("close", (code) => resolve(code === 0));
    ffmpeg.on("error", () => resolve(false));
  });
}

export async function POST(request: NextRequest) {
  const tempFiles: string[] = [];

  try {
    const { video }: IsolateRequest = await request.json();
    const apiKey = request.headers.get("x-elevenlabs-api-key") || process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "ElevenLabs API key not configured. Add it in Settings." },
        { status: 401 }
      );
    }

    if (!video) {
      return NextResponse.json({ success: false, error: "No video provided" }, { status: 400 });
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
    const inputVideoPath = path.join(tempDir, `isolate_input_${timestamp}.${format}`);
    const extractedAudioPath = path.join(tempDir, `isolate_audio_${timestamp}.mp3`);
    const isolatedAudioPath = path.join(tempDir, `isolate_clean_${timestamp}.mp3`);
    const outputVideoPath = path.join(tempDir, `isolate_output_${timestamp}.mp4`);
    tempFiles.push(inputVideoPath, extractedAudioPath, isolatedAudioPath, outputVideoPath);

    // Write input video
    await fs.writeFile(inputVideoPath, videoBuffer);
    console.log(`[AudioIsolate] Input video saved: ${inputVideoPath}`);

    // Extract audio from video
    console.log("[AudioIsolate] Extracting audio from video...");
    const extractSuccess = await extractAudioFromVideo(inputVideoPath, extractedAudioPath);
    if (!extractSuccess) {
      return NextResponse.json(
        { success: false, error: "Failed to extract audio from video" },
        { status: 500 }
      );
    }

    // Read extracted audio
    const audioBuffer = await fs.readFile(extractedAudioPath);
    console.log(`[AudioIsolate] Extracted audio size: ${audioBuffer.length} bytes`);

    // Call ElevenLabs Audio Isolation API
    console.log("[AudioIsolate] Calling ElevenLabs Audio Isolation API...");
    const formData = new FormData();
    formData.append("audio", new Blob([audioBuffer], { type: "audio/mpeg" }), "audio.mp3");

    const response = await fetch("https://api.elevenlabs.io/v1/audio-isolation", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AudioIsolate] ElevenLabs API error:", errorText);
      return NextResponse.json(
        { success: false, error: `ElevenLabs API error: ${response.status} - ${errorText}` },
        { status: 500 }
      );
    }

    // Get isolated audio
    const isolatedAudioBlob = await response.blob();
    const isolatedAudioBuffer = Buffer.from(await isolatedAudioBlob.arrayBuffer());
    await fs.writeFile(isolatedAudioPath, isolatedAudioBuffer);
    console.log(`[AudioIsolate] Isolated audio saved: ${isolatedAudioPath}`);

    // Merge isolated audio back with video
    console.log("[AudioIsolate] Merging isolated audio with video...");
    const mergeSuccess = await mergeAudioWithVideo(inputVideoPath, isolatedAudioPath, outputVideoPath);
    if (!mergeSuccess) {
      return NextResponse.json(
        { success: false, error: "Failed to merge audio with video" },
        { status: 500 }
      );
    }

    // Read output video
    const outputBuffer = await fs.readFile(outputVideoPath);
    const outputBase64 = `data:video/mp4;base64,${outputBuffer.toString("base64")}`;

    console.log("[AudioIsolate] Success - AI audio isolation complete");

    return NextResponse.json({
      success: true,
      video: outputBase64,
    });
  } catch (error) {
    console.error("[AudioIsolate] Error:", error);
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
