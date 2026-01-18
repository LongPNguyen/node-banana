import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";

export const maxDuration = 300; // 5 minute timeout

interface CaptionWord {
  word: string;
  start: number;
  end: number;
}

interface CaptionStyle {
  preset: string;
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  strokeColor: string;
  strokeWidth: number;
  backgroundColor: string | null;
  shadowColor: string | null;
  shadowDepth: number;
  glowColor: string | null;
  bold: boolean;
  italic: boolean;
  uppercase: boolean;
  position: "top" | "center" | "bottom";
  animation: "none" | "fade" | "pop" | "karaoke";
  wordsPerLine: number;
  highlightColor: string;
  highlightStyle: "color" | "box";
}

interface CaptionBurnRequest {
  video: string;
  words: CaptionWord[];
  style: CaptionStyle;
}

// Convert hex color to ASS format (&HAABBGGRR)
function hexToASS(hex: string, alpha: number = 0): string {
  const clean = hex.replace("#", "");
  const r = clean.substring(0, 2);
  const g = clean.substring(2, 4);
  const b = clean.substring(4, 6);
  const a = alpha.toString(16).padStart(2, "0");
  return `&H${a}${b}${g}${r}`.toUpperCase();
}

// Convert seconds to ASS time format (h:mm:ss.cc)
function secondsToASS(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

// Get vertical margin based on position
function getVerticalMargin(position: string): number {
  switch (position) {
    case "top":
      return 50;
    case "center":
      return 0;
    case "bottom":
    default:
      return 40;
  }
}

// Get alignment for ASS (1-9 numpad style)
function getAlignment(position: string): number {
  switch (position) {
    case "top":
      return 8;
    case "center":
      return 5;
    case "bottom":
    default:
      return 2;
  }
}

// Generate ASS subtitle file content with enhanced styles
function generateASS(words: CaptionWord[], style: CaptionStyle, videoWidth: number, videoHeight: number): string {
  const fontColor = hexToASS(style.fontColor);
  const strokeColor = hexToASS(style.strokeColor);
  const highlightColor = hexToASS(style.highlightColor);
  const alignment = getAlignment(style.position);
  const marginV = getVerticalMargin(style.position);

  const hasBgColor = !!style.backgroundColor;
  const boldFlag = style.bold ? 1 : 0;
  const italicFlag = style.italic ? 1 : 0;
  const shadowDepth = style.shadowColor ? style.shadowDepth : 0;
  const shadowColor = style.shadowColor ? hexToASS(style.shadowColor, 0) : "&H80000000";

  // DUAL-LAYER approach (required because ASS can't do stroke + background in one style):
  // - BgBox: BorderStyle=3, OutlineColour=bgColor (yellow box), TRANSPARENT text
  // - Default: BorderStyle=1, OutlineColour=strokeColor (pink stroke), visible text
  //
  // Layer 0: BgBox shows ONLY the yellow background box (text is invisible)
  // Layer 1: Default shows text with pink stroke and karaoke colors

  const bgColor = hasBgColor ? hexToASS(style.backgroundColor!, 0) : "&H80000000";
  // Fully transparent text for BgBox - we only want to see the box, not the text
  const transparentText = "&HFF000000";

  // ASS header with styles
  // IMPORTANT: Both styles must have SAME Outline value for proper alignment
  let ass = `[Script Info]
Title: Generated Captions
ScriptType: v4.00+
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontFamily},${style.fontSize},${fontColor},${fontColor},${strokeColor},${shadowColor},${boldFlag},${italicFlag},0,0,100,100,0,0,1,${style.strokeWidth},${shadowDepth},${alignment},20,20,${marginV},1
Style: BgBox,${style.fontFamily},${style.fontSize},${transparentText},${transparentText},${bgColor},${bgColor},${boldFlag},${italicFlag},0,0,100,100,0,0,3,${style.strokeWidth},0,${alignment},20,20,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const wordsPerLine = style.wordsPerLine || 4;

  // Group words into lines
  for (let i = 0; i < words.length; i += wordsPerLine) {
    const lineWords = words.slice(i, i + wordsPerLine);
    if (lineWords.length === 0) continue;

    const lineStart = lineWords[0].start;
    const lineEnd = lineWords[lineWords.length - 1].end;

    // Karaoke mode: CapCut style - current word shows Fill color, other words are white
    // DUAL-LAYER with identical timing to ensure alignment
    if (style.animation === "karaoke") {
      const whiteColor = hexToASS("#FFFFFF");

      // Extend line to next line start to prevent gaps between lines
      const nextLineStart = i + wordsPerLine < words.length ? words[i + wordsPerLine].start : null;
      let lineEndTime = lineEnd + 0.15;
      if (nextLineStart !== null) {
        lineEndTime = nextLineStart;
      }

      const plainText = lineWords.map(lw => style.uppercase ? lw.word.toUpperCase() : lw.word).join(" ");

      // HYBRID TIMING with pause detection
      const minDuration = 0.20; // 200ms minimum per word
      const zeroDurationBuffer = 0.35; // Give 0-duration words 350ms before their Whisper start
      const pauseThreshold = 0.40; // 400ms gap = pause (laughter, silence)
      const naturalFadeOff = 0.15; // 150ms fade-off after last word before pause
      // pauseHighlightIndex: which word to keep highlighted during pause (-1 = none/all white)
      const timings: { start: number; end: number; isPause?: boolean; pauseHighlightIndex?: number }[] = [];

      console.log(`[Karaoke] Line ${Math.floor(i / wordsPerLine) + 1}: "${plainText}"`);
      console.log(`[Karaoke]   lineStart=${lineStart.toFixed(2)}s, lineEnd=${lineEndTime.toFixed(2)}s`);

      let currentTime = lineStart;

      for (let j = 0; j < lineWords.length; j++) {
        const word = lineWords[j];
        const wordText = style.uppercase ? word.word.toUpperCase() : word.word;
        const nextWord = lineWords[j + 1];

        // Check if this word has 0 or near-0 duration from Whisper
        const whisperDuration = word.end - word.start;
        const isZeroDuration = whisperDuration < 0.05; // Less than 50ms = effectively 0

        let wordStart: number;
        let wordEnd: number;

        if (j === 0) {
          // First word: use Whisper start
          wordStart = word.start;
        } else if (isZeroDuration) {
          // Zero-duration word - needs to borrow time
          const gapAvailable = word.start - currentTime;

          if (gapAvailable > zeroDurationBuffer) {
            // Gap before word - borrow from gap
            const takeFromGap = zeroDurationBuffer;
            wordStart = word.start - takeFromGap;

            // Check if remaining gap is large (pause/laughter)
            const remainingGap = gapAvailable - takeFromGap;
            if (remainingGap > pauseThreshold && timings.length > 0) {
              const prevEnd = timings[timings.length - 1].end;
              const pauseStart = prevEnd + naturalFadeOff;
              if (pauseStart < wordStart) {
                timings[timings.length - 1].end = pauseStart;
                timings.push({ start: pauseStart, end: wordStart, isPause: true, pauseHighlightIndex: j - 1 });
                console.log(`[Karaoke]   PAUSE: ${pauseStart.toFixed(2)}s - ${wordStart.toFixed(2)}s (${((wordStart - pauseStart) * 1000).toFixed(0)}ms) [keep word ${j - 1} highlighted]`);
              }
              console.log(`[Karaoke]   "${wordText}": 0-duration word after pause, borrowing ${(takeFromGap * 1000).toFixed(0)}ms from gap`);
            } else if (remainingGap > 0 && timings.length > 0) {
              timings[timings.length - 1].end = wordStart;
              console.log(`[Karaoke]   "${wordText}": 0-duration word, borrowing ${(takeFromGap * 1000).toFixed(0)}ms, extending prev word by ${(remainingGap * 1000).toFixed(0)}ms`);
            } else {
              console.log(`[Karaoke]   "${wordText}": 0-duration word, borrowing ${(takeFromGap * 1000).toFixed(0)}ms from gap`);
            }
          } else if (timings.length > 0) {
            // No gap or small gap - borrow time from PREVIOUS word
            const prevTiming = timings[timings.length - 1];
            const prevDuration = prevTiming.end - prevTiming.start;
            // Borrow up to 30% of prev word or 200ms, whichever is smaller
            const borrowAmount = Math.min(prevDuration * 0.3, 0.20, prevDuration - 0.10);
            if (borrowAmount > 0.05) {
              prevTiming.end -= borrowAmount;
              wordStart = prevTiming.end;
              // If there was a small gap, extend prev word to fill it
              if (gapAvailable > 0) {
                // The borrowed time already accounts for where we start
                console.log(`[Karaoke]   "${wordText}": 0-duration word, borrowed ${(borrowAmount * 1000).toFixed(0)}ms from prev word`);
              } else {
                console.log(`[Karaoke]   "${wordText}": 0-duration word, borrowed ${(borrowAmount * 1000).toFixed(0)}ms from prev word`);
              }
            } else {
              // Previous word too short, just chain
              wordStart = currentTime;
              console.log(`[Karaoke]   "${wordText}": 0-duration word, prev too short to borrow`);
            }
          } else {
            wordStart = word.start;
          }
        } else {
          // Normal word - check for gaps
          const gapFromPrev = word.start - currentTime;
          if (gapFromPrev > pauseThreshold && timings.length > 0) {
            // Large gap - insert pause entry
            const pauseStart = currentTime + naturalFadeOff;
            if (pauseStart < word.start) {
              timings[timings.length - 1].end = pauseStart;
              timings.push({ start: pauseStart, end: word.start, isPause: true, pauseHighlightIndex: j - 1 });
              console.log(`[Karaoke]   PAUSE: ${pauseStart.toFixed(2)}s - ${word.start.toFixed(2)}s (${((word.start - pauseStart) * 1000).toFixed(0)}ms) [keep word ${j - 1} highlighted]`);
            }
            wordStart = word.start;
          } else if (gapFromPrev > 0.05 && timings.length > 0) {
            // Small gap - extend prev word to fill gap, use Whisper start time
            timings[timings.length - 1].end = word.start;
            wordStart = word.start;
            console.log(`[Karaoke]   Filling ${(gapFromPrev * 1000).toFixed(0)}ms gap before "${wordText}"`);
          } else {
            // No meaningful gap - chain from previous
            wordStart = currentTime;
          }
        }

        // Calculate end time
        if (isZeroDuration) {
          // Zero-duration word: end at next word's start, or add minDuration
          if (nextWord) {
            wordEnd = nextWord.start;
          } else {
            wordEnd = wordStart + minDuration;
          }
        } else {
          // Normal word: use Whisper duration with minimum
          wordEnd = wordStart + Math.max(whisperDuration, minDuration);
        }

        // Last word handling - cap at lineEndTime to prevent overlap with next line
        if (j === lineWords.length - 1) {
          // If there's a next line, strictly cap at lineEndTime (which is nextLineStart)
          // Only extend past lineEndTime if there's NO next line
          const hasNextLine = i + wordsPerLine < words.length;
          if (hasNextLine) {
            // Cap at lineEndTime to prevent overlap - NO exceptions
            wordEnd = Math.min(wordEnd, lineEndTime);
            // If squeezed to nothing, the word already borrowed time from prev word above
          } else {
            // No next line - can extend for natural ending
            const minEndTime = wordStart + minDuration;
            wordEnd = Math.max(lineEndTime, minEndTime);
          }
        } else {
          // Non-last words: cap at line end
          if (wordEnd > lineEndTime) {
            wordEnd = lineEndTime;
          }
        }

        console.log(`[Karaoke]   "${wordText}": ${wordStart.toFixed(2)}s - ${wordEnd.toFixed(2)}s (Whisper: ${word.start.toFixed(2)}-${word.end.toFixed(2)}${isZeroDuration ? " [0-dur]" : ""})`);

        timings.push({ start: wordStart, end: wordEnd });
        currentTime = wordEnd;
      }

      // Now emit entries using calculated timings
      // Track which word index we're on (pause entries don't increment this)
      let wordIndex = 0;
      for (let t = 0; t < timings.length; t++) {
        const timing = timings[t];
        const { start: entryStart, end: entryEnd, isPause } = timing;

        // Skip if entry would have zero or negative duration
        if (entryEnd <= entryStart) {
          if (!isPause) wordIndex++;
          continue;
        }

        const startTime = secondsToASS(entryStart);
        const endTime = secondsToASS(entryEnd);

        // Layer 0: BgBox (yellow background, transparent text)
        // The text is invisible but defines the box size
        if (hasBgColor) {
          ass += `Dialogue: 0,${startTime},${endTime},BgBox,,0,0,0,,${plainText}\n`;
        }

        // Layer 1: Default (visible text with stroke and karaoke colors)
        // NO inline \bord or \3c overrides - just \c for text colors
        let lineText = "";
        for (let k = 0; k < lineWords.length; k++) {
          const lw = lineWords[k];
          const lwText = style.uppercase ? lw.word.toUpperCase() : lw.word;

          if (isPause) {
            // During pause: keep the last spoken word highlighted
            const highlightIdx = timing.pauseHighlightIndex ?? -1;
            if (k === highlightIdx) {
              lineText += `{\\c${fontColor}}${lwText}`;
            } else {
              lineText += `{\\c${whiteColor}}${lwText}`;
            }
          } else if (k === wordIndex) {
            // Normal word entry: highlight current word
            lineText += `{\\c${fontColor}}${lwText}`;
          } else {
            lineText += `{\\c${whiteColor}}${lwText}`;
          }
          if (k < lineWords.length - 1) lineText += " ";
        }

        ass += `Dialogue: 1,${startTime},${endTime},Default,,0,0,0,,${lineText}\n`;

        // Only increment word index for non-pause entries
        if (!isPause) wordIndex++;
      }
    } else {
      // Non-karaoke modes
      const startTime = secondsToASS(lineStart);
      const endTime = secondsToASS(lineEnd);

      let text = "";

      // Apply animation/effects
      if (style.animation === "fade") {
        text += "{\\fad(200,200)}";
      } else if (style.animation === "pop") {
        text += "{\\t(0,80,\\fscx115\\fscy115)\\t(80,160,\\fscx100\\fscy100)}";
      }

      // Add glow effect if enabled
      if (style.glowColor) {
        const glowASS = hexToASS(style.glowColor);
        text += `{\\blur3\\3c${glowASS}}`;
      }

      // Regular text
      const lineText = lineWords.map(w => style.uppercase ? w.word.toUpperCase() : w.word).join(" ");
      text += lineText;

      // If background enabled, emit background box on layer 0 first
      if (hasBgColor) {
        ass += `Dialogue: 0,${startTime},${endTime},BgBox,,0,0,0,,${lineText}\n`;
      }

      // Text with stroke on layer 1 (above background)
      ass += `Dialogue: 1,${startTime},${endTime},Default,,0,0,0,,${text}\n`;
    }
  }

  return ass;
}

async function getVideoInfo(videoPath: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const ffprobe = spawn("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height",
      "-of", "json",
      videoPath,
    ]);

    let output = "";
    ffprobe.stdout.on("data", (data) => {
      output += data.toString();
    });

    ffprobe.on("close", () => {
      try {
        const info = JSON.parse(output);
        const stream = info.streams?.[0];
        resolve({
          width: stream?.width || 1920,
          height: stream?.height || 1080,
        });
      } catch {
        resolve({ width: 1920, height: 1080 });
      }
    });

    ffprobe.on("error", () => {
      resolve({ width: 1920, height: 1080 });
    });
  });
}

async function runFFmpeg(args: string[]): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    console.log("[CaptionBurn] Running FFmpeg:", args.join(" "));
    const ffmpeg = spawn("ffmpeg", args);

    let stderr = "";
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        console.error("[CaptionBurn] FFmpeg failed:", stderr);
        resolve({ success: false, error: stderr });
      }
    });

    ffmpeg.on("error", (err) => {
      console.error("[CaptionBurn] FFmpeg spawn error:", err);
      resolve({ success: false, error: err.message });
    });
  });
}

export async function POST(request: NextRequest) {
  const tempFiles: string[] = [];

  try {
    const { video, words, style }: CaptionBurnRequest = await request.json();

    if (!video) {
      return NextResponse.json({ success: false, error: "No video provided" }, { status: 400 });
    }

    if (!words || words.length === 0) {
      return NextResponse.json({ success: false, error: "No caption words provided" }, { status: 400 });
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
    const videoPath = path.join(tempDir, `caption_video_${timestamp}.${format}`);
    const assPath = path.join(tempDir, `caption_subs_${timestamp}.ass`);
    const outputPath = path.join(tempDir, `caption_output_${timestamp}.mp4`);
    tempFiles.push(videoPath, assPath, outputPath);

    // Write video to temp file
    await fs.writeFile(videoPath, videoBuffer);
    console.log(`[CaptionBurn] Video saved: ${videoPath}`);

    // Get video dimensions
    const videoInfo = await getVideoInfo(videoPath);
    console.log(`[CaptionBurn] Video dimensions: ${videoInfo.width}x${videoInfo.height}`);

    // Generate ASS subtitle file
    const assContent = generateASS(words, style, videoInfo.width, videoInfo.height);
    await fs.writeFile(assPath, assContent);
    console.log(`[CaptionBurn] ASS file generated: ${assPath}`);

    // Burn subtitles into video using FFmpeg
    const ffmpegArgs = [
      "-y",
      "-i", videoPath,
      "-vf", `ass='${assPath.replace(/'/g, "'\\''")}'`,
      "-c:a", "copy",
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      outputPath,
    ];

    const result = await runFFmpeg(ffmpegArgs);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: `FFmpeg failed: ${result.error}` },
        { status: 500 }
      );
    }

    // Read output file
    const outputBuffer = await fs.readFile(outputPath);
    const outputBase64 = `data:video/mp4;base64,${outputBuffer.toString("base64")}`;

    console.log(`[CaptionBurn] Success - captions burned into video`);

    return NextResponse.json({
      success: true,
      video: outputBase64,
    });
  } catch (error) {
    console.error("[CaptionBurn] Error:", error);
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
