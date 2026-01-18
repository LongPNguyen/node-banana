import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  preview_url: string | null;
  category: string;
  labels: Record<string, string>;
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-elevenlabs-api-key") || process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: "ElevenLabs API key not configured. Add it in Settings or set ELEVENLABS_API_KEY in .env.local",
      }, { status: 401 });
    }

    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail?.message || `ElevenLabs API error: ${response.status}`);
    }

    const data = await response.json();

    // Map to simplified format
    const voices = (data.voices as ElevenLabsVoice[]).map((voice) => ({
      id: voice.voice_id,
      name: voice.name,
      previewUrl: voice.preview_url,
      category: voice.category,
      accent: voice.labels?.accent || null,
      description: voice.labels?.description || null,
      gender: voice.labels?.gender || null,
      age: voice.labels?.age || null,
    }));

    // Sort: cloned/generated first, then premade, alphabetically within each
    voices.sort((a, b) => {
      const categoryOrder = { cloned: 0, generated: 1, premade: 2, professional: 3 };
      const aOrder = categoryOrder[a.category as keyof typeof categoryOrder] ?? 4;
      const bOrder = categoryOrder[b.category as keyof typeof categoryOrder] ?? 4;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      success: true,
      voices,
    });
  } catch (error) {
    console.error("[elevenlabs-voices] Error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch voices",
    }, { status: 500 });
  }
}
