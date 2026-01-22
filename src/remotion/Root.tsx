import React from "react";
import { Composition } from "remotion";
import { MainVideoComposition, calculateTotalDuration } from "./compositions/MainVideo";
import { RemotionCompositionProps, IntroConfig, OutroConfig, TextOverlay } from "./types";

// Type assertion helper for Remotion Composition
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MainVideo = MainVideoComposition as React.ComponentType<any>;

// Default props for the Remotion Studio preview
const defaultIntro: IntroConfig = {
  enabled: true,
  template: "text-scale",
  duration: 2,
  text: "MY VIDEO",
  subtext: "Subtitle here",
  backgroundColor: "#000000",
  textColor: "#ffffff",
  accentColor: "#3b82f6",
};

const defaultOutro: OutroConfig = {
  enabled: true,
  template: "cta-follow",
  duration: 3,
  text: "FOLLOW FOR MORE",
  handle: "@myhandle",
  subtext: "New content daily",
  backgroundColor: "#000000",
  textColor: "#ffffff",
  accentColor: "#3b82f6",
};

const defaultOverlays: TextOverlay[] = [
  {
    id: "1",
    text: "SAMPLE TEXT",
    startTime: 1,
    duration: 2,
    animation: "pop",
    position: "center",
    fontSize: 64,
    fontColor: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 3,
  },
];

export const RemotionRoot: React.FC = () => {
  const fps = 30;
  const videoDurationSeconds = 10; // Default preview duration
  const videoDurationFrames = videoDurationSeconds * fps;

  const totalDuration = calculateTotalDuration(
    videoDurationFrames,
    fps,
    defaultIntro,
    defaultOutro
  );

  return (
    <>
      {/* Main composition for full video with intro/outro */}
      <Composition
        id="MainVideo"
        component={MainVideo}
        durationInFrames={totalDuration}
        fps={fps}
        width={1080}
        height={1920}
        defaultProps={{
          videoSrc: "", // Will be provided at render time
          videoDuration: videoDurationFrames,
          fps,
          width: 1080,
          height: 1920,
          intro: defaultIntro,
          outro: defaultOutro,
          overlays: defaultOverlays,
        }}
      />

      {/* 16:9 version */}
      <Composition
        id="MainVideo16x9"
        component={MainVideo}
        durationInFrames={totalDuration}
        fps={fps}
        width={1920}
        height={1080}
        defaultProps={{
          videoSrc: "",
          videoDuration: videoDurationFrames,
          fps,
          width: 1920,
          height: 1080,
          intro: defaultIntro,
          outro: defaultOutro,
          overlays: defaultOverlays,
        }}
      />
    </>
  );
};
