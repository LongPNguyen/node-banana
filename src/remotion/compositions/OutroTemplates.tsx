import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { OutroConfig } from "../types";

interface OutroProps {
  config: OutroConfig;
}

// CTA Follow - Social media follow call-to-action
export const CTAFollowOutro: React.FC<OutroProps> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const handleY = spring({
    frame: frame - fps * 0.3,
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  const handleOpacity = interpolate(frame, [fps * 0.3, fps * 0.6], [0, 1], {
    extrapolateRight: "clamp",
  });

  const arrowBounce = Math.sin(frame * 0.2) * 5;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: config.backgroundColor || "#000000",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ textAlign: "center" }}>
        {/* Arrow pointing down */}
        <div
          style={{
            transform: `scale(${scale}) translateY(${arrowBounce}px)`,
            marginBottom: 30,
          }}
        >
          <svg
            width="60"
            height="60"
            viewBox="0 0 24 24"
            fill={config.accentColor || "#3b82f6"}
          >
            <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
          </svg>
        </div>

        {/* Main text */}
        <div
          style={{
            fontSize: 56,
            fontWeight: "bold",
            color: config.textColor || "#ffffff",
            fontFamily: "Arial Black, sans-serif",
            transform: `scale(${scale})`,
          }}
        >
          {config.text || "FOLLOW FOR MORE"}
        </div>

        {/* Handle */}
        {config.handle && (
          <div
            style={{
              fontSize: 48,
              fontWeight: "bold",
              color: config.accentColor || "#3b82f6",
              fontFamily: "Arial, sans-serif",
              marginTop: 20,
              transform: `translateY(${(1 - handleY) * 20}px)`,
              opacity: handleOpacity,
            }}
          >
            {config.handle}
          </div>
        )}

        {/* Subtext */}
        {config.subtext && (
          <div
            style={{
              fontSize: 24,
              color: config.textColor || "#ffffff",
              marginTop: 15,
              fontFamily: "Arial, sans-serif",
              transform: `translateY(${(1 - handleY) * 20}px)`,
              opacity: handleOpacity * 0.7,
            }}
          >
            {config.subtext}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// CTA Subscribe - Subscribe button animation
export const CTASubscribeOutro: React.FC<OutroProps> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const buttonScale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 150 },
  });

  const pulse = Math.sin(frame * 0.15) * 0.05 + 1;

  const textOpacity = interpolate(frame, [fps * 0.4, fps * 0.7], [0, 1], {
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
      <div style={{ textAlign: "center" }}>
        {/* Subscribe button */}
        <div
          style={{
            backgroundColor: config.accentColor || "#ff0000",
            padding: "20px 60px",
            borderRadius: 8,
            transform: `scale(${buttonScale * pulse})`,
            boxShadow: `0 0 ${20 * pulse}px ${config.accentColor || "#ff0000"}40`,
          }}
        >
          <div
            style={{
              fontSize: 36,
              fontWeight: "bold",
              color: "#ffffff",
              fontFamily: "Arial Black, sans-serif",
              textTransform: "uppercase",
            }}
          >
            {config.text || "SUBSCRIBE"}
          </div>
        </div>

        {/* Bell icon and text */}
        <div
          style={{
            marginTop: 30,
            opacity: textOpacity,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill={config.textColor || "#ffffff"}
          >
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
          </svg>
          <span
            style={{
              fontSize: 24,
              color: config.textColor || "#ffffff",
              fontFamily: "Arial, sans-serif",
            }}
          >
            {config.subtext || "Turn on notifications"}
          </span>
        </div>

        {/* Handle */}
        {config.handle && (
          <div
            style={{
              fontSize: 28,
              color: config.textColor || "#ffffff",
              opacity: 0.6,
              marginTop: 20,
              fontFamily: "Arial, sans-serif",
            }}
          >
            {config.handle}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// Fade Out - Simple fade to black with text
export const FadeOutOutro: React.FC<OutroProps> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(
    frame,
    [durationInFrames - fps * 0.5, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: config.backgroundColor || "#000000",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ textAlign: "center", opacity }}>
        <div
          style={{
            fontSize: 48,
            fontWeight: "bold",
            color: config.textColor || "#ffffff",
            fontFamily: "Arial, sans-serif",
          }}
        >
          {config.text || "Thanks for watching"}
        </div>
        {config.subtext && (
          <div
            style={{
              fontSize: 24,
              color: config.textColor || "#ffffff",
              opacity: 0.7,
              marginTop: 15,
              fontFamily: "Arial, sans-serif",
            }}
          >
            {config.subtext}
          </div>
        )}
        {config.handle && (
          <div
            style={{
              fontSize: 32,
              color: config.accentColor || "#3b82f6",
              marginTop: 25,
              fontFamily: "Arial, sans-serif",
              fontWeight: "bold",
            }}
          >
            {config.handle}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// Slide Out - Content slides out
export const SlideOutOutro: React.FC<OutroProps> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps, height, durationInFrames } = useVideoConfig();

  const slideIn = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const slideOut = interpolate(
    frame,
    [durationInFrames - fps * 0.5, durationInFrames],
    [0, -height],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const y = frame > durationInFrames - fps * 0.5
    ? slideOut
    : interpolate(slideIn, [0, 1], [height, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: config.backgroundColor || "#000000",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ transform: `translateY(${y}px)`, textAlign: "center" }}>
        <div
          style={{
            fontSize: 56,
            fontWeight: "bold",
            color: config.textColor || "#ffffff",
            fontFamily: "Arial Black, sans-serif",
          }}
        >
          {config.text || "SEE YOU NEXT TIME"}
        </div>
        <div
          style={{
            width: 80,
            height: 6,
            backgroundColor: config.accentColor || "#3b82f6",
            margin: "25px auto",
            borderRadius: 3,
          }}
        />
        {config.handle && (
          <div
            style={{
              fontSize: 36,
              color: config.accentColor || "#3b82f6",
              fontFamily: "Arial, sans-serif",
              fontWeight: "bold",
            }}
          >
            {config.handle}
          </div>
        )}
        {config.subtext && (
          <div
            style={{
              fontSize: 22,
              color: config.textColor || "#ffffff",
              opacity: 0.6,
              marginTop: 15,
              fontFamily: "Arial, sans-serif",
            }}
          >
            {config.subtext}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// Main outro component that switches between templates
export const OutroComposition: React.FC<OutroProps> = ({ config }) => {
  switch (config.template) {
    case "cta-follow":
      return <CTAFollowOutro config={config} />;
    case "cta-subscribe":
      return <CTASubscribeOutro config={config} />;
    case "fade-out":
      return <FadeOutOutro config={config} />;
    case "slide-out":
      return <SlideOutOutro config={config} />;
    default:
      return null;
  }
};
