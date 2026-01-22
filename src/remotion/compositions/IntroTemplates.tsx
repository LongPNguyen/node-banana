import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { IntroConfig } from "../types";

interface IntroProps {
  config: IntroConfig;
}

// Logo Reveal - Logo fades and scales in with text below
export const LogoRevealIntro: React.FC<IntroProps> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const logoOpacity = interpolate(frame, [0, fps * 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  const textY = spring({
    frame: frame - fps * 0.3,
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  const textOpacity = interpolate(frame, [fps * 0.3, fps * 0.6], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: config.backgroundColor || "#000000",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {config.logoUrl ? (
        <img
          src={config.logoUrl}
          alt="Logo"
          style={{
            width: 200,
            height: 200,
            objectFit: "contain",
            transform: `scale(${logoScale})`,
            opacity: logoOpacity,
          }}
        />
      ) : (
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 24,
            backgroundColor: config.accentColor || "#3b82f6",
            transform: `scale(${logoScale})`,
            opacity: logoOpacity,
          }}
        />
      )}
      {config.text && (
        <div
          style={{
            position: "absolute",
            bottom: "30%",
            transform: `translateY(${(1 - textY) * 30}px)`,
            opacity: textOpacity,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: "bold",
              color: config.textColor || "#ffffff",
              fontFamily: "Arial Black, sans-serif",
            }}
          >
            {config.text}
          </div>
          {config.subtext && (
            <div
              style={{
                fontSize: 28,
                color: config.textColor || "#ffffff",
                opacity: 0.7,
                marginTop: 10,
                fontFamily: "Arial, sans-serif",
              }}
            >
              {config.subtext}
            </div>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};

// Text Scale - Big text scales in with impact
export const TextScaleIntro: React.FC<IntroProps> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 8, stiffness: 150 },
  });

  const opacity = interpolate(
    frame,
    [0, fps * 0.2, durationInFrames - fps * 0.3, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: config.backgroundColor || "#000000",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          opacity,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 96,
            fontWeight: "bold",
            color: config.textColor || "#ffffff",
            fontFamily: "Arial Black, sans-serif",
            textTransform: "uppercase",
            letterSpacing: 8,
          }}
        >
          {config.text || "INTRO"}
        </div>
        {config.subtext && (
          <div
            style={{
              fontSize: 32,
              color: config.accentColor || "#3b82f6",
              marginTop: 20,
              fontFamily: "Arial, sans-serif",
              fontWeight: "bold",
            }}
          >
            {config.subtext}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// Slide In - Text slides in from left
export const SlideInIntro: React.FC<IntroProps> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps, width, durationInFrames } = useVideoConfig();

  const slideX = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const exitX = interpolate(
    frame,
    [durationInFrames - fps * 0.5, durationInFrames],
    [0, width],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const x = frame > durationInFrames - fps * 0.5
    ? exitX
    : interpolate(slideX, [0, 1], [-width, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: config.backgroundColor || "#000000",
        justifyContent: "center",
        alignItems: "flex-start",
        paddingLeft: 80,
      }}
    >
      <div style={{ transform: `translateX(${x}px)` }}>
        <div
          style={{
            fontSize: 72,
            fontWeight: "bold",
            color: config.textColor || "#ffffff",
            fontFamily: "Arial Black, sans-serif",
          }}
        >
          {config.text || "INTRO"}
        </div>
        {config.subtext && (
          <div
            style={{
              fontSize: 32,
              color: config.textColor || "#ffffff",
              opacity: 0.7,
              marginTop: 10,
              fontFamily: "Arial, sans-serif",
            }}
          >
            {config.subtext}
          </div>
        )}
        <div
          style={{
            width: 100,
            height: 6,
            backgroundColor: config.accentColor || "#3b82f6",
            marginTop: 20,
            borderRadius: 3,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// Glitch - Text with glitch effect
export const GlitchIntro: React.FC<IntroProps> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const glitchOffset = Math.sin(frame * 0.5) * (frame < fps ? 10 : 2);
  const showGlitch = frame < fps * 0.8 && Math.random() > 0.7;

  const opacity = interpolate(
    frame,
    [0, fps * 0.1, durationInFrames - fps * 0.2, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp" }
  );

  const text = config.text || "INTRO";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: config.backgroundColor || "#000000",
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      {/* Glitch layers */}
      {showGlitch && (
        <>
          <div
            style={{
              position: "absolute",
              fontSize: 96,
              fontWeight: "bold",
              color: "#ff0000",
              fontFamily: "Arial Black, sans-serif",
              transform: `translate(${glitchOffset}px, ${-glitchOffset / 2}px)`,
              opacity: 0.7,
              mixBlendMode: "multiply",
            }}
          >
            {text}
          </div>
          <div
            style={{
              position: "absolute",
              fontSize: 96,
              fontWeight: "bold",
              color: "#00ffff",
              fontFamily: "Arial Black, sans-serif",
              transform: `translate(${-glitchOffset}px, ${glitchOffset / 2}px)`,
              opacity: 0.7,
              mixBlendMode: "multiply",
            }}
          >
            {text}
          </div>
        </>
      )}
      <div
        style={{
          fontSize: 96,
          fontWeight: "bold",
          color: config.textColor || "#ffffff",
          fontFamily: "Arial Black, sans-serif",
          textTransform: "uppercase",
        }}
      >
        {text}
      </div>
      {config.subtext && (
        <div
          style={{
            fontSize: 28,
            color: config.textColor || "#ffffff",
            opacity: 0.7,
            marginTop: 20,
            fontFamily: "monospace",
          }}
        >
          {config.subtext}
        </div>
      )}
    </AbsoluteFill>
  );
};

// Main intro component that switches between templates
export const IntroComposition: React.FC<IntroProps> = ({ config }) => {
  switch (config.template) {
    case "logo-reveal":
      return <LogoRevealIntro config={config} />;
    case "text-scale":
      return <TextScaleIntro config={config} />;
    case "slide-in":
      return <SlideInIntro config={config} />;
    case "glitch":
      return <GlitchIntro config={config} />;
    default:
      return null;
  }
};
