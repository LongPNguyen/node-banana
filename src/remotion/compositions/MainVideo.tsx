import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Video,
  OffthreadVideo,
  useVideoConfig,
  staticFile,
} from "remotion";
import { RemotionCompositionProps } from "../types";
import { IntroComposition } from "./IntroTemplates";
import { OutroComposition } from "./OutroTemplates";
import { TextOverlayComposition } from "./TextOverlay";

export const MainVideoComposition: React.FC<RemotionCompositionProps> = ({
  videoSrc,
  videoDuration,
  fps,
  intro,
  outro,
  overlays,
}) => {
  const { width, height } = useVideoConfig();

  // Calculate frame positions
  const introDuration = intro.enabled ? Math.round(intro.duration * fps) : 0;
  const outroDuration = outro.enabled ? Math.round(outro.duration * fps) : 0;
  const mainVideoStart = introDuration;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {/* Intro Sequence */}
      {intro.enabled && intro.template !== "none" && (
        <Sequence from={0} durationInFrames={introDuration}>
          <IntroComposition config={intro} />
        </Sequence>
      )}

      {/* Main Video Sequence */}
      <Sequence from={mainVideoStart} durationInFrames={videoDuration}>
        <AbsoluteFill>
          {/* The source video */}
          {videoSrc.startsWith("data:") ? (
            // For base64 videos, we need to use a regular video element
            <video
              src={videoSrc}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          ) : (
            <OffthreadVideo
              src={videoSrc}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          )}

          {/* Text Overlays on top of video */}
          {overlays.map((overlay) => {
            const startFrame = Math.round(overlay.startTime * fps);
            const endFrame = Math.round((overlay.startTime + overlay.duration) * fps);

            return (
              <TextOverlayComposition
                key={overlay.id}
                overlay={overlay}
                startFrame={startFrame}
                endFrame={endFrame}
              />
            );
          })}
        </AbsoluteFill>
      </Sequence>

      {/* Outro Sequence */}
      {outro.enabled && outro.template !== "none" && (
        <Sequence
          from={mainVideoStart + videoDuration}
          durationInFrames={outroDuration}
        >
          <OutroComposition config={outro} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};

// Calculate total duration in frames
export const calculateTotalDuration = (
  videoDurationFrames: number,
  fps: number,
  intro: { enabled: boolean; duration: number },
  outro: { enabled: boolean; duration: number }
): number => {
  const introDuration = intro.enabled ? Math.round(intro.duration * fps) : 0;
  const outroDuration = outro.enabled ? Math.round(outro.duration * fps) : 0;
  return introDuration + videoDurationFrames + outroDuration;
};
