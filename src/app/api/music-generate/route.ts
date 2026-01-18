import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 180; // 3 minute timeout

interface MusicGenerateRequest {
  prompt: string; // Text description of the music
  duration?: number; // Duration in seconds (default: 30)
  instrumental?: boolean; // Instrumental only (no vocals)
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, duration = 30, instrumental = true }: MusicGenerateRequest = await request.json();
    const apiKey = request.headers.get("x-elevenlabs-api-key") || process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "ElevenLabs API key not configured. Add it in Settings." },
        { status: 401 }
      );
    }

    if (!prompt) {
      return NextResponse.json({ success: false, error: "No prompt provided" }, { status: 400 });
    }

    console.log(`[MusicGenerate] Generating music: "${prompt}" (${duration}s)`);

    // Call ElevenLabs Music Generation API
    // Note: Using the text-to-sound API with music-specific prompting
    const response = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: instrumental ? `${prompt} (instrumental music, no vocals)` : prompt,
        duration_seconds: Math.min(duration, 60), // Cap at 60 seconds
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[MusicGenerate] ElevenLabs API error:", errorText);
      return NextResponse.json(
        { success: false, error: `ElevenLabs API error: ${response.status} - ${errorText}` },
        { status: 500 }
      );
    }

    // Get audio blob and convert to base64
    const audioBlob = await response.blob();
    const audioBuffer = Buffer.from(await audioBlob.arrayBuffer());
    const base64Audio = `data:audio/mpeg;base64,${audioBuffer.toString("base64")}`;

    console.log(`[MusicGenerate] Success - generated music (${audioBuffer.length} bytes)`);

    return NextResponse.json({
      success: true,
      audio: base64Audio,
      prompt,
      duration,
    });
  } catch (error) {
    console.error("[MusicGenerate] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
