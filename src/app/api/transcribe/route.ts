import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";

export const maxDuration = 120; // 2 minute timeout

interface TranscribeRequest {
  video: string; // Base64 data URL
}

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

interface WhisperResponse {
  text: string;
  words?: WhisperWord[];
}

async function extractAudio(videoPath: string, audioPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-i", videoPath,
      "-vn",
      "-acodec", "pcm_s16le",
      "-ar", "16000",
      "-ac", "1",
      audioPath,
    ]);

    ffmpeg.on("close", (code) => {
      resolve(code === 0);
    });

    ffmpeg.on("error", () => {
      resolve(false);
    });
  });
}

export async function POST(request: NextRequest) {
  const tempFiles: string[] = [];

  try {
    const { video }: TranscribeRequest = await request.json();

    if (!video) {
      return NextResponse.json({ success: false, error: "No video provided" }, { status: 400 });
    }

    const openaiKey = request.headers.get("x-openai-api-key") || process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json(
        { success: false, error: "OpenAI API key not configured. Add it in Settings." },
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
    const videoPath = path.join(tempDir, `transcribe_video_${timestamp}.${format}`);
    const audioPath = path.join(tempDir, `transcribe_audio_${timestamp}.wav`);
    tempFiles.push(videoPath, audioPath);

    // Write video to temp file
    await fs.writeFile(videoPath, videoBuffer);
    console.log(`[Transcribe] Video saved: ${videoPath}`);

    // Extract audio
    const audioExtracted = await extractAudio(videoPath, audioPath);
    if (!audioExtracted) {
      return NextResponse.json(
        { success: false, error: "Failed to extract audio from video" },
        { status: 500 }
      );
    }
    console.log(`[Transcribe] Audio extracted: ${audioPath}`);

    // Read audio file
    const audioBuffer = await fs.readFile(audioPath);
    const audioBlob = new Blob([audioBuffer], { type: "audio/wav" });

    // Call OpenAI Whisper API with word-level timestamps
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.wav");
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");
    formData.append("timestamp_granularities[]", "word");

    console.log("[Transcribe] Calling OpenAI Whisper API...");
    const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error("[Transcribe] Whisper API error:", errorText);
      return NextResponse.json(
        { success: false, error: `Whisper API error: ${whisperResponse.status}` },
        { status: 500 }
      );
    }

    const whisperData: WhisperResponse = await whisperResponse.json();
    console.log(`[Transcribe] Transcription complete: ${whisperData.words?.length || 0} words`);

    // Format words for our caption system
    const words = (whisperData.words || []).map((w) => ({
      word: w.word.trim(),
      start: w.start,
      end: w.end,
    }));

    return NextResponse.json({
      success: true,
      text: whisperData.text,
      words,
    });
  } catch (error) {
    console.error("[Transcribe] Error:", error);
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
