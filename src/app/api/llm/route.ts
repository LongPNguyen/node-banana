import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { LLMGenerateRequest, LLMGenerateResponse, LLMModelType } from "@/types";

export const maxDuration = 60; // 1 minute timeout

// Map model types to actual API model IDs
const GOOGLE_MODEL_MAP: Record<string, string> = {
  "gemini-2.5-flash": "gemini-2.5-flash",
  "gemini-2.5-pro": "gemini-2.5-pro-preview-06-05",
  "gemini-3-flash": "gemini-3-flash-preview",
  "gemini-3-pro": "gemini-3-pro-preview",
  // Add more Gemini model IDs here if you want friendly aliases.
};

// Models that support Google Search grounding
const GOOGLE_SEARCH_SUPPORTED_MODELS = new Set([
  "gemini-3-flash",
  "gemini-3-pro",
  "gemini-3-flash-preview",
  "gemini-3-pro-preview",
]);

const OPENAI_MODEL_MAP: Record<string, string> = {
  "gpt-4.1-mini": "gpt-4.1-mini",
  "gpt-4.1-nano": "gpt-4.1-nano",
  // Add more OpenAI model IDs here if you want friendly aliases.
};

function extractInlineImageParts(images: string[]): Array<{ inlineData: { mimeType: string; data: string } }> {
  if (!images || images.length === 0) return [];

  return images.map((image) => {
    // Accept data URLs like: data:image/png;base64,AAAA...
    if (typeof image === "string" && image.includes("base64,")) {
      const [header, data] = image.split("base64,");
      const mimeMatch = header.match(/data:([^;]+)/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
      return { inlineData: { mimeType, data } };
    }

    // If someone passes raw base64, assume PNG
    return { inlineData: { mimeType: "image/png", data: image } };
  });
}

function extractGoogleText(response: any): string | null {
  if (typeof response?.text === "string" && response.text.trim()) {
    return response.text;
  }

  const parts = response?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const textParts = parts
      .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
      .join("");
    if (textParts.trim()) return textParts;
  }

  return null;
}

function buildGoogleNoTextError(response: any, modelId: string, imagesCount: number): string {
  const candidate = response?.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const safetyRatings = candidate?.safetyRatings;
  const parts = candidate?.content?.parts;

  let partsSummary = "";
  if (Array.isArray(parts)) {
    const keys = parts
      .map((p: any) => Object.keys(p || {}).join("+") || "unknown")
      .slice(0, 8)
      .join(", ");
    partsSummary = `, parts: ${parts.length}${keys ? ` (${keys}${parts.length > 8 ? ", …" : ""})` : ""}`;
  }

  let safetySummary = "";
  if (Array.isArray(safetyRatings) && safetyRatings.length > 0) {
    const top = safetyRatings
      .slice(0, 4)
      .map((r: any) => `${r.category ?? "unknown"}:${r.probability ?? "unknown"}`)
      .join(", ");
    safetySummary = `, safety: ${top}${safetyRatings.length > 4 ? ", …" : ""}`;
  }

  return `No text in Google AI response (model: ${modelId}, images: ${imagesCount}${
    finishReason ? `, finishReason: ${finishReason}` : ""
  }${partsSummary}${safetySummary})`;
}

function parseFiniteNumber(value: unknown): number | undefined {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  return Number.isFinite(n) ? n : undefined;
}

function sanitizeTemperature(value: unknown, fallback = 0.7): number {
  const n = parseFiniteNumber(value);
  if (n === undefined) return fallback;
  return Math.min(2, Math.max(0, n));
}

function sanitizeMaxTokens(value: unknown, fallback = 1024): number {
  const n = parseFiniteNumber(value);
  if (n === undefined) return fallback;
  const int = Math.floor(n);
  if (!Number.isFinite(int) || int < 1) return fallback;
  // Keep a sane upper bound. If you want bigger, increase this.
  return Math.min(int, 8192);
}

async function generateWithGoogle(
  prompt: string,
  images: string[],
  model: LLMModelType,
  temperature: number,
  maxTokens: number,
  useGoogleSearch: boolean = false,
  headerApiKey?: string | null
): Promise<string> {
  const apiKey = headerApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key not configured. Add it in Settings or set GEMINI_API_KEY in .env.local");
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelId = GOOGLE_MODEL_MAP[model] ?? model;

  const imageParts = extractInlineImageParts(images);
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: prompt },
    ...imageParts,
  ];

  const config: any = {
    temperature,
    maxOutputTokens: maxTokens,
    // Explicitly request text output; some safety blocks return no parts.
    responseModalities: ["TEXT"],
  };

  // Add Google Search grounding for supported Gemini 3 models
  const supportsSearch = GOOGLE_SEARCH_SUPPORTED_MODELS.has(model) || 
                         GOOGLE_SEARCH_SUPPORTED_MODELS.has(modelId);
  
  const requestParams: any = {
    model: modelId,
    contents: [
      {
        role: "user",
        parts,
      },
    ],
    config,
  };

  // Only add tools if search is requested AND model supports it
  if (useGoogleSearch && supportsSearch) {
    requestParams.tools = [{ googleSearch: {} }];
    console.log(`[LLM API] Using Google Search grounding with model: ${modelId}`);
  }

  const response = await ai.models.generateContent(requestParams);

  // Prefer the convenient .text property; fall back to candidates/parts for robustness.
  const text = extractGoogleText(response);
  if (!text) {
    throw new Error(buildGoogleNoTextError(response, modelId, images.length));
  }

  return text;
}

async function generateWithOpenAI(
  prompt: string,
  images: string[],
  model: LLMModelType,
  temperature: number,
  maxTokens: number,
  headerApiKey?: string | null
): Promise<string> {
  const apiKey = headerApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key not configured. Add it in Settings or set OPENAI_API_KEY in .env.local");
  }

  const modelId = OPENAI_MODEL_MAP[model] ?? model;

  // Best-effort multimodal support for Chat Completions (works for models that support vision).
  // If the chosen model doesn't support images, OpenAI will return an error that we surface to the client.
  const content =
    images && images.length > 0
      ? [
          { type: "text", text: prompt },
          ...images.map((url) => ({ type: "image_url", image_url: { url } })),
        ]
      : prompt;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content }],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("No text in OpenAI response");
  }

  return text;
}

export async function POST(request: NextRequest) {
  try {
    const body: LLMGenerateRequest = await request.json();
    const {
      prompt,
      images = [],
      provider,
      model,
      temperature = 0.7,
      maxTokens = 1024,
      useGoogleSearch = false
    } = body;

    if (!prompt) {
      return NextResponse.json<LLMGenerateResponse>(
        { success: false, error: "Prompt is required" },
        { status: 400 }
      );
    }

    const safeTemperature = sanitizeTemperature(temperature, 0.7);
    const safeMaxTokens = sanitizeMaxTokens(maxTokens, 1024);

    // Get API keys from headers
    const geminiApiKey = request.headers.get("x-gemini-api-key");
    const openaiApiKey = request.headers.get("x-openai-api-key");

    let text: string;

    if (provider === "google") {
      text = await generateWithGoogle(prompt, images, model, safeTemperature, safeMaxTokens, useGoogleSearch, geminiApiKey);
    } else if (provider === "openai") {
      text = await generateWithOpenAI(prompt, images, model, safeTemperature, safeMaxTokens, openaiApiKey);
    } else {
      return NextResponse.json<LLMGenerateResponse>(
        { success: false, error: `Unknown provider: ${provider}` },
        { status: 400 }
      );
    }

    return NextResponse.json<LLMGenerateResponse>({
      success: true,
      text,
    });
  } catch (error) {
    console.error("LLM generation error:", error);

    // Handle rate limiting
    if (error instanceof Error && error.message.includes("429")) {
      return NextResponse.json<LLMGenerateResponse>(
        { success: false, error: "Rate limit reached. Please wait and try again." },
        { status: 429 }
      );
    }

    return NextResponse.json<LLMGenerateResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "LLM generation failed",
      },
      { status: 500 }
    );
  }
}
