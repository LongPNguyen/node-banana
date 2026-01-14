import { Node, Edge } from "@xyflow/react";

// Node Types
export type NodeType =
  | "imageInput"
  | "annotation"
  | "prompt"
  | "nanoBanana"
  | "llmGenerate"
  | "output"
  | "videoGenerate"
  | "elevenLabs";

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
  filename: string | null;
  dimensions: { width: number; height: number } | null;
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
  annotations: AnnotationShape[];
  outputImage: string | null;
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
  inputPrompt: string | null;
  outputImage: string | null;
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
}

// Video Generation Node Data
export interface VideoGenerateNodeData extends BaseNodeData {
  inputImage: string | null; // start frame
  inputPrompt: string | null;
  outputVideo: string | null; // video data URL or URL
  lastFrame: string | null;   // extracted last frame for chaining
  duration: number;
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

// Union of all node data types
export type WorkflowNodeData =
  | ImageInputNodeData
  | AnnotationNodeData
  | PromptNodeData
  | NanoBananaNodeData
  | LLMGenerateNodeData
  | OutputNodeData
  | VideoGenerateNodeData
  | ElevenLabsNodeData;

// Workflow Node with typed data
export type WorkflowNode = Node<WorkflowNodeData, NodeType>;

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
