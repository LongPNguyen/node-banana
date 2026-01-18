import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120; // 2 minute timeout

interface SoundEffectRequest {
  text: string; // Text description of the sound effect
  duration?: number; // Duration in seconds (optional, auto if not provided)
}

export async function POST(request: NextRequest) {
  try {
    const { text, duration }: SoundEffectRequest = await request.json();
    const apiKey = request.headers.get("x-elevenlabs-api-key") || process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "ElevenLabs API key not configured. Add it in Settings." },
        { status: 401 }
      );
    }

    if (!text) {
      return NextResponse.json({ success: false, error: "No text description provided" }, { status: 400 });
    }

    console.log(`[SoundEffects] Generating sound effect: "${text}"`);

    // Call ElevenLabs Sound Effects API
    const response = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        ...(duration && { duration_seconds: duration }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[SoundEffects] ElevenLabs API error:", errorText);
      return NextResponse.json(
        { success: false, error: `ElevenLabs API error: ${response.status} - ${errorText}` },
        { status: 500 }
      );
    }

    // Get audio blob and convert to base64
    const audioBlob = await response.blob();
    const audioBuffer = Buffer.from(await audioBlob.arrayBuffer());
    const base64Audio = `data:audio/mpeg;base64,${audioBuffer.toString("base64")}`;

    console.log(`[SoundEffects] Success - generated sound effect (${audioBuffer.length} bytes)`);

    return NextResponse.json({
      success: true,
      audio: base64Audio,
      text,
    });
  } catch (error) {
    console.error("[SoundEffects] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
