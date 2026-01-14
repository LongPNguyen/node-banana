import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId } = await request.json();
    // Check header first, then fall back to environment variable
    const apiKey = request.headers.get("x-elevenlabs-api-key") || process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: "ElevenLabs API key not configured. Add it in Settings or set ELEVENLABS_API_KEY in .env.local" }, { status: 401 });
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail?.message || "ElevenLabs API error");
    }

    const audioBlob = await response.blob();
    const buffer = await audioBlob.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const dataUrl = `data:audio/mpeg;base64,${base64}`;

    return NextResponse.json({
      success: true,
      audio: dataUrl,
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Voice generation failed" 
    }, { status: 500 });
  }
}

