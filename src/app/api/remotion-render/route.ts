import { NextRequest, NextResponse } from "next/server";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import * as http from "http";

export const maxDuration = 300; // 5 minute timeout for rendering

interface RenderRequest {
  video: string; // Base64 data URL of the source video
  videoDuration: number; // Duration in seconds
  width: number;
  height: number;
  fps: number;
  intro: {
    enabled: boolean;
    template: string;
    duration: number;
    text?: string;
    subtext?: string;
    logoUrl?: string;
    backgroundColor?: string;
    textColor?: string;
    accentColor?: string;
  };
  outro: {
    enabled: boolean;
    template: string;
    duration: number;
    text?: string;
    subtext?: string;
    handle?: string;
    logoUrl?: string;
    backgroundColor?: string;
    textColor?: string;
    accentColor?: string;
  };
  overlays: Array<{
    id: string;
    text: string;
    startTime: number;
    duration: number;
    animation: string;
    position: string;
    fontSize?: number;
    fontColor?: string;
    fontFamily?: string;
    strokeColor?: string;
    strokeWidth?: number;
    backgroundColor?: string | null;
  }>;
}

// Create a simple HTTP server to serve the video file
function createVideoServer(videoPath: string): Promise<{ server: http.Server; url: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const videoBuffer = await fs.readFile(videoPath);
        res.writeHead(200, {
          "Content-Type": "video/mp4",
          "Content-Length": videoBuffer.length,
          "Access-Control-Allow-Origin": "*",
        });
        res.end(videoBuffer);
      } catch (error) {
        res.writeHead(500);
        res.end("Error reading video");
      }
    });

    // Find an available port
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") {
        const url = `http://127.0.0.1:${address.port}/video.mp4`;
        resolve({ server, url });
      } else {
        reject(new Error("Failed to get server address"));
      }
    });

    server.on("error", reject);
  });
}

export async function POST(request: NextRequest) {
  let tempDir: string | null = null;
  let bundleLocation: string | null = null;
  let videoServer: http.Server | null = null;

  try {
    const body: RenderRequest = await request.json();
    const {
      video,
      videoDuration,
      width,
      height,
      fps,
      intro,
      outro,
      overlays,
    } = body;

    if (!video) {
      return NextResponse.json(
        { success: false, error: "Missing video data" },
        { status: 400 }
      );
    }

    // Create temp directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "remotion-render-"));
    const inputPath = path.join(tempDir, "input.mp4");
    const outputPath = path.join(tempDir, "output.mp4");

    // Decode base64 video and save to temp file
    const base64Match = video.match(/^data:video\/[^;]+;base64,(.+)$/);
    if (!base64Match) {
      return NextResponse.json(
        { success: false, error: "Invalid video format - expected base64 data URL" },
        { status: 400 }
      );
    }

    const videoBuffer = Buffer.from(base64Match[1], "base64");
    await fs.writeFile(inputPath, videoBuffer);

    // Start a local HTTP server to serve the video
    const { server, url: videoUrl } = await createVideoServer(inputPath);
    videoServer = server;

    console.log(`[Remotion] Starting render - Video duration: ${videoDuration}s, Size: ${width}x${height}`);
    console.log(`[Remotion] Video served at: ${videoUrl}`);
    console.log(`[Remotion] Intro: ${intro.enabled ? intro.template : 'disabled'}, Outro: ${outro.enabled ? outro.template : 'disabled'}`);
    console.log(`[Remotion] Overlays: ${overlays.length}`);

    // Calculate total duration in frames
    const videoDurationFrames = Math.round(videoDuration * fps);
    const introDurationFrames = intro.enabled ? Math.round(intro.duration * fps) : 0;
    const outroDurationFrames = outro.enabled ? Math.round(outro.duration * fps) : 0;
    const totalDurationFrames = introDurationFrames + videoDurationFrames + outroDurationFrames;

    console.log(`[Remotion] Total frames: ${totalDurationFrames} (intro: ${introDurationFrames}, video: ${videoDurationFrames}, outro: ${outroDurationFrames})`);

    // Bundle the Remotion project
    const entryPoint = path.join(process.cwd(), "src/remotion/index.ts");

    console.log(`[Remotion] Bundling...`);
    bundleLocation = await bundle({
      entryPoint,
      webpackOverride: (config) => config,
    });
    console.log(`[Remotion] Bundle created at ${bundleLocation}`);

    // Select the composition
    const compositionId = width > height ? "MainVideo16x9" : "MainVideo";
    const inputProps = {
      videoSrc: videoUrl,
      videoDuration: videoDurationFrames,
      fps,
      width,
      height,
      intro,
      outro,
      overlays,
    };

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps,
    });

    // Override composition settings
    const compositionWithOverrides = {
      ...composition,
      width,
      height,
      fps,
      durationInFrames: totalDurationFrames,
    };

    console.log(`[Remotion] Rendering ${compositionId}...`);

    // Render the video
    await renderMedia({
      composition: compositionWithOverrides,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation: outputPath,
      inputProps,
    });

    console.log(`[Remotion] Render complete`);

    // Read the rendered video
    const outputBuffer = await fs.readFile(outputPath);
    const outputBase64 = `data:video/mp4;base64,${outputBuffer.toString("base64")}`;

    // Get file sizes for logging
    const inputStats = await fs.stat(inputPath);
    const outputStats = await fs.stat(outputPath);

    console.log(`[Remotion] Input size: ${(inputStats.size / 1024 / 1024).toFixed(2)}MB, Output size: ${(outputStats.size / 1024 / 1024).toFixed(2)}MB`);

    return NextResponse.json({
      success: true,
      video: outputBase64,
      duration: totalDurationFrames / fps,
    });

  } catch (error) {
    console.error("[Remotion] Render error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Render failed" },
      { status: 500 }
    );
  } finally {
    // Close the video server
    if (videoServer) {
      videoServer.close();
    }
    // Cleanup temp directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
    // Cleanup bundle
    if (bundleLocation) {
      try {
        await fs.rm(bundleLocation, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
