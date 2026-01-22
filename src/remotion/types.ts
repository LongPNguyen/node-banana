// Remotion composition types for NodeMango

export type IntroTemplate = "none" | "logo-reveal" | "text-scale" | "slide-in" | "glitch";
export type OutroTemplate = "none" | "cta-follow" | "cta-subscribe" | "fade-out" | "slide-out";
export type OverlayAnimation = "pop" | "fade" | "slide-up" | "slide-down" | "slide-left" | "slide-right" | "bounce" | "typewriter";
export type OverlayPosition = "top" | "center" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface TextOverlay {
  id: string;
  text: string;
  startTime: number; // seconds
  duration: number; // seconds
  animation: OverlayAnimation;
  position: OverlayPosition;
  fontSize?: number;
  fontColor?: string;
  fontFamily?: string;
  strokeColor?: string;
  strokeWidth?: number;
  backgroundColor?: string | null;
}

export interface IntroConfig {
  enabled: boolean;
  template: IntroTemplate;
  duration: number; // seconds
  text?: string;
  subtext?: string;
  logoUrl?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
}

export interface OutroConfig {
  enabled: boolean;
  template: OutroTemplate;
  duration: number; // seconds
  text?: string;
  subtext?: string;
  handle?: string;
  logoUrl?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
}

export interface RemotionCompositionProps {
  videoSrc: string;
  videoDuration: number; // frames
  fps: number;
  width: number;
  height: number;
  intro: IntroConfig;
  outro: OutroConfig;
  overlays: TextOverlay[];
}
