import { Node, Edge } from "@xyflow/react";

// Group colors for node grouping
export type GroupColor = "neutral" | "blue" | "green" | "purple" | "orange" | "red";

// Node group type
export interface NodeGroup {
  id: string;
  name: string;
  color: GroupColor;
  nodeIds: string[];
  position: { x: number; y: number };
  width: number;
  height: number;
  isLocked: boolean;
}

// Node Types
export type NodeType =
  | "imageInput"
  | "videoInput"
  | "annotation"
  | "prompt"
  | "nanoBanana"
  | "llmGenerate"
  | "output"
  | "videoGenerate"
  | "elevenLabs"
  | "syllableChunker"
  | "splitGrid"
  | "videoStitch"
  | "videoUpscale"
  | "audioProcess"
  | "caption"
  | "voiceSwap"
  | "soundEffects"
  | "musicGenerate"
  | "motionCapture"
  | "remotion"
  | "videoComposer"
  | "greenScreen";

// Aspect Ratios (supported by both Nano Banana and Nano Banana Pro)
export type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9";

// Resolution Options (only supported by Nano Banana Pro)
export type Resolution = "1K" | "2K" | "4K";

// Image Generation Model Options
export type ModelType = "nano-banana" | "nano-banana-pro";

// LLM Provider Options
export type LLMProvider = "google" | "openai";

// LLM Model Options
// Keep this as a string to make it easy to add/try new models without editing this type.
export type LLMModelType = string;

// Node Status
export type NodeStatus = "idle" | "loading" | "complete" | "error";

// Base node data - using Record to satisfy React Flow's type constraints
export interface BaseNodeData extends Record<string, unknown> {
  label?: string;
}

// Image Input Node Data
export interface ImageInputNodeData extends BaseNodeData {
  image: string | null;
  imageRef?: string; // Reference for external image storage
  filename: string | null;
  dimensions: { width: number; height: number } | null;
  customTitle?: string;
  comment?: string;
}

// Video Input Node Data
export interface VideoInputNodeData extends BaseNodeData {
  video: string | null; // Base64 data URL of the video
  filename: string | null;
  duration: number | null; // Duration in seconds
  lastFrame: string | null; // Extracted last frame for chaining
  customTitle?: string;
  comment?: string;
}

// Annotation Shape Types
export type ShapeType = "rectangle" | "circle" | "arrow" | "freehand" | "text";

export interface BaseShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

export interface RectangleShape extends BaseShape {
  type: "rectangle";
  width: number;
  height: number;
  fill: string | null;
}

export interface CircleShape extends BaseShape {
  type: "circle";
  radiusX: number;
  radiusY: number;
  fill: string | null;
}

export interface ArrowShape extends BaseShape {
  type: "arrow";
  points: number[];
}

export interface FreehandShape extends BaseShape {
  type: "freehand";
  points: number[];
}

export interface TextShape extends BaseShape {
  type: "text";
  text: string;
  fontSize: number;
  fill: string;
}

export type AnnotationShape =
  | RectangleShape
  | CircleShape
  | ArrowShape
  | FreehandShape
  | TextShape;

// Annotation Node Data
export interface AnnotationNodeData extends BaseNodeData {
  sourceImage: string | null;
  sourceImageRef?: string; // Reference for external image storage
  annotations: AnnotationShape[];
  outputImage: string | null;
  outputImageRef?: string; // Reference for external image storage
  customTitle?: string;
  comment?: string;
}

// Prompt Node Data
export interface PromptNodeData extends BaseNodeData {
  prompt: string;
}

// Image History Item (for tracking generated images)
export interface ImageHistoryItem {
  id: string;
  image: string;          // Base64 data URL
  timestamp: number;      // For display & sorting
  prompt: string;         // The prompt used
  aspectRatio: AspectRatio;
  model: ModelType;
}

// Nano Banana Node Data (Image Generation)
export interface NanoBananaNodeData extends BaseNodeData {
  inputImages: string[]; // Now supports multiple images
  inputImageRefs?: string[]; // References for external image storage
  inputPrompt: string | null;
  outputImage: string | null;
  outputImageRef?: string; // Reference for external image storage
  aspectRatio: AspectRatio;
  resolution: Resolution; // Only used by Nano Banana Pro
  model: ModelType;
  useGoogleSearch: boolean; // Only available for Nano Banana Pro
  status: NodeStatus;
  error: string | null;
}

// LLM Generate Node Data (Text Generation)
export interface LLMGenerateNodeData extends BaseNodeData {
  inputPrompt: string | null;     // instruction/prompt text input
  inputContext: string | null;    // context/content text input (combined with prompt)
  inputImages: string[]; // optional multimodal context
  inputImageRefs?: string[]; // References for external image storage
  outputText: string | null;
  outputImages: string[]; // passthrough of connected images for downstream nodes
  provider: LLMProvider;
  model: LLMModelType;
  temperature: number;
  maxTokens: number;
  useGoogleSearch: boolean; // Enable Google Search grounding (Gemini 3 only)
  status: NodeStatus;
  error: string | null;
}

// Output Node Data
export interface OutputNodeData extends BaseNodeData {
  image: string | null;
  video: string | null; // Video output support
  imageRef?: string; // Reference for external image storage
  sourceImageRef?: string; // Reference for source image
  customTitle?: string;
  comment?: string;
}

// Video Generation Node Data
// Video aspect ratio options
export type VideoAspectRatio = "16:9" | "9:16";

// Video resolution options
export type VideoResolution = "720p" | "1080p" | "4k";

// Video duration options (in seconds)
export type VideoDuration = 4 | 6 | 8;

// Video model options
export type VideoModel = "veo-3.1-fast" | "veo-3.1" | "kieai-veo3-fast" | "kieai-veo3";

export interface VideoGenerateNodeData extends BaseNodeData {
  inputImage: string | null; // start frame
  inputPrompt: string | null; // motion prompt
  inputContext: string | null; // additional context (combined with prompt)
  referenceImages: string[]; // up to 3 reference images for style/content guidance
  outputVideo: string | null; // video data URL or URL
  originalVideo: string | null; // pre-trim video backup for undo
  lastFrame: string | null;   // extracted last frame for chaining
  model: VideoModel;
  duration: VideoDuration;
  aspectRatio: VideoAspectRatio;
  resolution: VideoResolution;
  chunkIndex: number; // which chunk to use when connected to a syllable chunker (1-indexed for display)
  status: NodeStatus;
  error: string | null;
}

// ElevenLabs Node Data
export interface ElevenLabsNodeData extends BaseNodeData {
  inputText: string | null;
  voiceId: string;
  outputAudio: string | null;
  status: NodeStatus;
  error: string | null;
}

// Split Grid Node Data
export interface SplitGridGenerateSettings {
  aspectRatio: AspectRatio;
  resolution: Resolution;
  model: ModelType;
  useGoogleSearch: boolean;
}

export interface SplitGridChildNodeIds {
  imageInput: string;
  prompt: string;
  nanoBanana: string;
}

export interface SplitGridNodeData extends BaseNodeData {
  sourceImage: string | null;
  sourceImageRef?: string; // Reference for external image storage
  gridRows: number;
  gridCols: number;
  targetCount: number;
  defaultPrompt: string;
  generateSettings: SplitGridGenerateSettings;
  childNodeIds: SplitGridChildNodeIds[];
  isConfigured: boolean;
  customTitle?: string;
  comment?: string;
  status: NodeStatus;
  error: string | null;
}

// Syllable Chunker Node Data
export interface SyllableChunkerNodeData extends BaseNodeData {
  inputScript: string | null;
  outputChunks: string[];
  selectedChunkIndex: number;  // which chunk to output (0-indexed)
  targetSyllables: number;     // default 58
  chunkPrefix: string;         // prefix to prepend to each chunk (default "Dialogue: ")
  status: NodeStatus;
  error: string | null;
}

// Video Stitch Node Data - combines multiple videos into one
export interface VideoStitchNodeData extends BaseNodeData {
  inputVideos: { video: string; chunkIndex: number; sourceNodeId: string }[];  // videos with ordering info
  outputVideo: string | null;  // stitched video data URL
  iterationCount: number;      // number of times to regenerate and stitch (default 1)
  currentIteration: number;    // current iteration being processed (0 = not running)
  outputFolder: string | null; // folder path to save iterations
  status: NodeStatus;
  error: string | null;
}

// Video Upscale Target Resolutions
export type UpscaleResolution = "1080p" | "1440p" | "4k";

// Video Upscale Node Data - upscale video resolution
export interface VideoUpscaleNodeData extends BaseNodeData {
  inputVideo: string | null;      // video to upscale (base64 data URL)
  outputVideo: string | null;     // upscaled video
  targetResolution: UpscaleResolution;
  sharpen: boolean;               // apply sharpening filter
  originalResolution: string | null;  // e.g., "1280x720"
  newResolution: string | null;       // e.g., "1920x1080"
  status: NodeStatus;
  error: string | null;
}

// Audio Noise Reduction Level
export type NoiseReductionLevel = "light" | "medium" | "heavy";
export type AudioProcessMethod = "ffmpeg" | "elevenlabs";

// Audio Process Node Data - noise reduction for video audio
export interface AudioProcessNodeData extends BaseNodeData {
  inputVideo: string | null;      // video to process (base64 data URL)
  outputVideo: string | null;     // processed video with clean audio
  method: AudioProcessMethod;     // ffmpeg (basic) or elevenlabs (AI)
  noiseReduction: NoiseReductionLevel; // for ffmpeg method
  status: NodeStatus;
  error: string | null;
}

// Caption Word with timing (from Whisper API)
export interface CaptionWord {
  word: string;
  start: number;  // seconds
  end: number;    // seconds
}

// Caption style options
export type CaptionPosition = "top" | "center" | "bottom";
export type CaptionAnimation = "none" | "fade" | "pop" | "karaoke";

// Highlight style for karaoke mode
export type HighlightStyle = "color" | "box";

export interface CaptionStyle {
  preset: string;              // Preset name or "custom"
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  strokeColor: string;
  strokeWidth: number;
  backgroundColor: string | null;  // null = transparent
  shadowColor: string | null;      // null = no shadow
  shadowDepth: number;
  glowColor: string | null;        // null = no glow
  bold: boolean;
  italic: boolean;
  uppercase: boolean;
  position: CaptionPosition;
  animation: CaptionAnimation;
  wordsPerLine: number;        // How many words per caption line
  highlightColor: string;      // Color for karaoke word highlight
  highlightStyle: HighlightStyle;  // "color" = text color change, "box" = background box like CapCut
}

// Caption Node Data - auto-transcription with CapCut-style captions
export interface CaptionNodeData extends BaseNodeData {
  inputVideo: string | null;
  outputVideo: string | null;
  transcription: CaptionWord[] | null;
  editedTranscript: string | null;  // User-edited text (plain text for re-timing)
  style: CaptionStyle;
  status: NodeStatus;
  error: string | null;
}

// Voice Swap Node Data - ElevenLabs Speech-to-Speech
export interface VoiceSwapNodeData extends BaseNodeData {
  inputVideo: string | null;
  outputVideo: string | null;
  voiceId: string;
  voiceName: string | null;
  status: NodeStatus;
  error: string | null;
}

// Sound Effects Node Data - ElevenLabs Sound Generation
export interface SoundEffectsNodeData extends BaseNodeData {
  prompt: string;
  duration: number | null; // seconds, null = auto
  outputAudio: string | null;
  status: NodeStatus;
  error: string | null;
}

// Music Generation Node Data - ElevenLabs Music Generation
export interface MusicGenerateNodeData extends BaseNodeData {
  prompt: string;
  duration: number;
  instrumental: boolean;
  outputAudio: string | null;
  status: NodeStatus;
  error: string | null;
}

// Motion Capture Character Orientation
export type CharacterOrientation = "image" | "video";

// Motion Capture Node Data - Kling 2.6 Motion Control
export interface MotionCaptureNodeData extends BaseNodeData {
  referenceImage: string | null;   // Character to animate (from image input)
  sourceVideo: string | null;      // Motion source (from video input)
  outputVideo: string | null;      // Result video
  lastFrame: string | null;        // Extracted last frame for chaining
  characterOrientation: CharacterOrientation; // "image" or "video"
  resolution: "720p" | "1080p";    // Output resolution
  prompt: string;                  // Optional scene description
  status: NodeStatus;
  error: string | null;
}

// Remotion Template Types
export type RemotionIntroTemplate = "none" | "logo-reveal" | "text-scale" | "slide-in" | "glitch";
export type RemotionOutroTemplate = "none" | "cta-follow" | "cta-subscribe" | "fade-out" | "slide-out";
export type RemotionOverlayAnimation = "pop" | "fade" | "slide-up" | "slide-down" | "slide-left" | "slide-right" | "bounce" | "typewriter";
export type RemotionOverlayPosition = "top" | "center" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

// Text overlay for Remotion
export interface RemotionTextOverlay {
  id: string;
  text: string;
  startTime: number;
  duration: number;
  animation: RemotionOverlayAnimation;
  position: RemotionOverlayPosition;
  fontSize?: number;
  fontColor?: string;
  fontFamily?: string;
  strokeColor?: string;
  strokeWidth?: number;
  backgroundColor?: string | null;
}

// Remotion intro config
export interface RemotionIntroConfig {
  enabled: boolean;
  template: RemotionIntroTemplate;
  duration: number;
  text?: string;
  subtext?: string;
  logoUrl?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
}

// Remotion outro config
export interface RemotionOutroConfig {
  enabled: boolean;
  template: RemotionOutroTemplate;
  duration: number;
  text?: string;
  subtext?: string;
  handle?: string;
  logoUrl?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
}

// Remotion Node Data - post-processing with intro/outro/overlays
export interface RemotionNodeData extends BaseNodeData {
  inputVideo: string | null;
  outputVideo: string | null;
  videoDuration: number | null;    // Duration of input video in seconds
  intro: RemotionIntroConfig;
  outro: RemotionOutroConfig;
  overlays: RemotionTextOverlay[];
  status: NodeStatus;
  error: string | null;
}

// Video Composer Node Data - AI-generated videos using Remotion
export interface VideoComposerNodeData extends BaseNodeData {
  // Input assets (populated from connections)
  inputVideos: string[];           // Up to 5 video data URLs
  inputImages: string[];           // Up to 10 image data URLs
  inputCode: string | null;        // Remotion TSX code from LLM

  // Settings
  duration: number;                // Target duration in seconds
  aspectRatio: "9:16" | "16:9" | "1:1";
  fps: number;

  // Output
  outputVideo: string | null;

  // Status
  status: NodeStatus;
  error: string | null;
}

// Green Screen Node Data - automated green screen workflow
export interface GreenScreenNodeData extends BaseNodeData {
  // Input
  inputVideo: string | null;       // Source video with person

  // Intermediate outputs (for debugging/preview)
  extractedFrame: string | null;   // First frame extracted from video
  greenScreenImage: string | null; // NanoBanana output (person on green screen)

  // Settings
  prompt: string;                  // Custom prompt for green screen generation
  resolution: "720p" | "1080p";    // Output resolution for motion capture
  greenColor: string;              // Green screen color (default: #00FF00)

  // Output
  outputVideo: string | null;      // Final video (person on green screen, animated)
  lastFrame: string | null;        // For chaining

  // Status
  status: NodeStatus;
  error: string | null;
  currentStep: "idle" | "extracting" | "generating" | "capturing" | "complete";
}

// Union of all node data types
export type WorkflowNodeData =
  | ImageInputNodeData
  | VideoInputNodeData
  | AnnotationNodeData
  | PromptNodeData
  | NanoBananaNodeData
  | LLMGenerateNodeData
  | OutputNodeData
  | VideoGenerateNodeData
  | ElevenLabsNodeData
  | SyllableChunkerNodeData
  | SplitGridNodeData
  | VideoStitchNodeData
  | VideoUpscaleNodeData
  | AudioProcessNodeData
  | CaptionNodeData
  | VoiceSwapNodeData
  | SoundEffectsNodeData
  | MusicGenerateNodeData
  | MotionCaptureNodeData
  | RemotionNodeData
  | VideoComposerNodeData
  | GreenScreenNodeData;

// Workflow Node with typed data and optional groupId
export type WorkflowNode = Node<WorkflowNodeData, NodeType> & {
  groupId?: string;
};

// Workflow Edge Data
export interface WorkflowEdgeData extends Record<string, unknown> {
  hasPause?: boolean;
}

// Workflow Edge
export type WorkflowEdge = Edge<WorkflowEdgeData>;

// Handle Types for connections
export type HandleType = "image" | "text" | "context";

// API Request/Response types for Image Generation
export interface GenerateRequest {
  images: string[]; // Now supports multiple images
  prompt: string;
  aspectRatio?: AspectRatio;
  resolution?: Resolution; // Only for Nano Banana Pro
  model?: ModelType;
  useGoogleSearch?: boolean; // Only for Nano Banana Pro
}

export interface GenerateResponse {
  success: boolean;
  image?: string;
  error?: string;
}

// API Request/Response types for LLM Text Generation
export interface LLMGenerateRequest {
  prompt: string;
  images?: string[]; // optional multimodal context images (data URLs)
  provider: LLMProvider;
  model: LLMModelType;
  temperature?: number;
  maxTokens?: number;
  useGoogleSearch?: boolean; // Enable Google Search grounding (Gemini 3 only)
}

export interface LLMGenerateResponse {
  success: boolean;
  text?: string;
  error?: string;
}

// Tool Types for annotation
export type ToolType = "select" | "rectangle" | "circle" | "arrow" | "freehand" | "text";

// Tool Options
export interface ToolOptions {
  strokeColor: string;
  strokeWidth: number;
  fillColor: string | null;
  fontSize: number;
  opacity: number;
}

// Workflow Metadata for sidebar
export interface WorkflowMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}
