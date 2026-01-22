import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { TextOverlay as TextOverlayType, OverlayPosition } from "../types";

interface TextOverlayProps {
  overlay: TextOverlayType;
  startFrame: number;
  endFrame: number;
}

const getPositionStyle = (position: OverlayPosition): React.CSSProperties => {
  const base: React.CSSProperties = {
    position: "absolute",
    padding: "15px 30px",
  };

  switch (position) {
    case "top":
      return { ...base, top: "10%", left: "50%", transform: "translateX(-50%)" };
    case "center":
      return { ...base, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    case "bottom":
      return { ...base, bottom: "10%", left: "50%", transform: "translateX(-50%)" };
    case "top-left":
      return { ...base, top: "10%", left: "5%" };
    case "top-right":
      return { ...base, top: "10%", right: "5%" };
    case "bottom-left":
      return { ...base, bottom: "10%", left: "5%" };
    case "bottom-right":
      return { ...base, bottom: "10%", right: "5%" };
    default:
      return { ...base, bottom: "10%", left: "50%", transform: "translateX(-50%)" };
  }
};

export const TextOverlayComposition: React.FC<TextOverlayProps> = ({
  overlay,
  startFrame,
  endFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps, height, width } = useVideoConfig();

  const relativeFrame = frame - startFrame;
  const duration = endFrame - startFrame;
  const fadeOutStart = duration - fps * 0.2; // Start fading 0.2s before end

  // Check if we should render
  if (frame < startFrame || frame > endFrame) {
    return null;
  }

  // Calculate animation values based on animation type
  let animationStyle: React.CSSProperties = {};

  switch (overlay.animation) {
    case "pop": {
      const scale = spring({
        frame: relativeFrame,
        fps,
        config: { damping: 8, stiffness: 200 },
      });
      const fadeOut = interpolate(
        relativeFrame,
        [fadeOutStart, duration],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
      animationStyle = {
        transform: `scale(${scale})`,
        opacity: relativeFrame < fadeOutStart ? 1 : fadeOut,
      };
      break;
    }

    case "fade": {
      const fadeIn = interpolate(relativeFrame, [0, fps * 0.2], [0, 1], {
        extrapolateRight: "clamp",
      });
      const fadeOut = interpolate(
        relativeFrame,
        [fadeOutStart, duration],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
      animationStyle = {
        opacity: Math.min(fadeIn, fadeOut),
      };
      break;
    }

    case "slide-up": {
      const slideIn = spring({
        frame: relativeFrame,
        fps,
        config: { damping: 15, stiffness: 100 },
      });
      const slideOut = interpolate(
        relativeFrame,
        [fadeOutStart, duration],
        [0, -50],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
      const fadeOut = interpolate(
        relativeFrame,
        [fadeOutStart, duration],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
      const y = relativeFrame < fadeOutStart
        ? interpolate(slideIn, [0, 1], [50, 0])
        : slideOut;
      animationStyle = {
        transform: `translateY(${y}px)`,
        opacity: relativeFrame < fadeOutStart ? interpolate(slideIn, [0, 1], [0, 1]) : fadeOut,
      };
      break;
    }

    case "slide-down": {
      const slideIn = spring({
        frame: relativeFrame,
        fps,
        config: { damping: 15, stiffness: 100 },
      });
      const slideOut = interpolate(
        relativeFrame,
        [fadeOutStart, duration],
        [0, 50],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
      const fadeOut = interpolate(
        relativeFrame,
        [fadeOutStart, duration],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
      const y = relativeFrame < fadeOutStart
        ? interpolate(slideIn, [0, 1], [-50, 0])
        : slideOut;
      animationStyle = {
        transform: `translateY(${y}px)`,
        opacity: relativeFrame < fadeOutStart ? interpolate(slideIn, [0, 1], [0, 1]) : fadeOut,
      };
      break;
    }

    case "slide-left": {
      const slideIn = spring({
        frame: relativeFrame,
        fps,
        config: { damping: 15, stiffness: 100 },
      });
      const slideOut = interpolate(
        relativeFrame,
        [fadeOutStart, duration],
        [0, -100],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
      const fadeOut = interpolate(
        relativeFrame,
        [fadeOutStart, duration],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
      const x = relativeFrame < fadeOutStart
        ? interpolate(slideIn, [0, 1], [100, 0])
        : slideOut;
      animationStyle = {
        transform: `translateX(${x}px)`,
        opacity: relativeFrame < fadeOutStart ? interpolate(slideIn, [0, 1], [0, 1]) : fadeOut,
      };
      break;
    }

    case "slide-right": {
      const slideIn = spring({
        frame: relativeFrame,
        fps,
        config: { damping: 15, stiffness: 100 },
      });
      const slideOut = interpolate(
        relativeFrame,
        [fadeOutStart, duration],
        [0, 100],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
      const fadeOut = interpolate(
        relativeFrame,
        [fadeOutStart, duration],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
      const x = relativeFrame < fadeOutStart
        ? interpolate(slideIn, [0, 1], [-100, 0])
        : slideOut;
      animationStyle = {
        transform: `translateX(${x}px)`,
        opacity: relativeFrame < fadeOutStart ? interpolate(slideIn, [0, 1], [0, 1]) : fadeOut,
      };
      break;
    }

    case "bounce": {
      const bounce = spring({
        frame: relativeFrame,
        fps,
        config: { damping: 6, stiffness: 200, mass: 0.5 },
      });
      const fadeOut = interpolate(
        relativeFrame,
        [fadeOutStart, duration],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
      animationStyle = {
        transform: `scale(${bounce})`,
        opacity: relativeFrame < fadeOutStart ? 1 : fadeOut,
      };
      break;
    }

    case "typewriter": {
      const visibleChars = Math.floor(
        interpolate(relativeFrame, [0, duration * 0.6], [0, overlay.text.length], {
          extrapolateRight: "clamp",
          easing: Easing.linear,
        })
      );
      const fadeOut = interpolate(
        relativeFrame,
        [fadeOutStart, duration],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
      // For typewriter, we'll handle the text display differently
      return (
        <div style={getPositionStyle(overlay.position)}>
          <div
            style={{
              fontSize: overlay.fontSize || 56,
              fontWeight: "bold",
              color: overlay.fontColor || "#ffffff",
              fontFamily: overlay.fontFamily || "Arial Black, sans-serif",
              WebkitTextStroke: overlay.strokeWidth
                ? `${overlay.strokeWidth}px ${overlay.strokeColor || "#000000"}`
                : undefined,
              textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
              backgroundColor: overlay.backgroundColor || undefined,
              padding: overlay.backgroundColor ? "10px 20px" : undefined,
              borderRadius: overlay.backgroundColor ? 8 : undefined,
              opacity: relativeFrame < fadeOutStart ? 1 : fadeOut,
            }}
          >
            {overlay.text.slice(0, visibleChars)}
            <span style={{ opacity: 0.3 }}>|</span>
          </div>
        </div>
      );
    }

    default:
      animationStyle = { opacity: 1 };
  }

  return (
    <div style={{ ...getPositionStyle(overlay.position), ...animationStyle }}>
      <div
        style={{
          fontSize: overlay.fontSize || 56,
          fontWeight: "bold",
          color: overlay.fontColor || "#ffffff",
          fontFamily: overlay.fontFamily || "Arial Black, sans-serif",
          WebkitTextStroke: overlay.strokeWidth
            ? `${overlay.strokeWidth}px ${overlay.strokeColor || "#000000"}`
            : undefined,
          textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
          backgroundColor: overlay.backgroundColor || undefined,
          padding: overlay.backgroundColor ? "10px 20px" : undefined,
          borderRadius: overlay.backgroundColor ? 8 : undefined,
          textTransform: "uppercase",
        }}
      >
        {overlay.text}
      </div>
    </div>
  );
};
