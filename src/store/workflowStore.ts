import { create } from "zustand";
import {
  Connection,
  EdgeChange,
  NodeChange,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  XYPosition,
} from "@xyflow/react";
import {
  WorkflowNode,
  WorkflowEdge,
  NodeType,
  ImageInputNodeData,
  VideoInputNodeData,
  AnnotationNodeData,
  PromptNodeData,
  NanoBananaNodeData,
  LLMGenerateNodeData,
  OutputNodeData,
  VideoGenerateNodeData,
  ElevenLabsNodeData,
  SyllableChunkerNodeData,
  SplitGridNodeData,
  VideoStitchNodeData,
  VideoUpscaleNodeData,
  AudioProcessNodeData,
  CaptionNodeData,
  VoiceSwapNodeData,
  SoundEffectsNodeData,
  MusicGenerateNodeData,
  MotionCaptureNodeData,
  RemotionNodeData,
  VideoComposerNodeData,
  GreenScreenNodeData,
  WorkflowNodeData,
  ImageHistoryItem,
  WorkflowMetadata,
  GroupColor,
} from "@/types";

import { useToast } from "@/components/Toast";
import { useSettingsStore } from "@/store/settingsStore";

// Group colors for visual styling
export const GROUP_COLORS: Record<GroupColor, string> = {
  neutral: "#404040",
  blue: "#1e40af",
  green: "#166534",
  purple: "#6b21a8",
  orange: "#c2410c",
  red: "#b91c1c",
};

// Group data structure
export interface GroupData {
  name: string;
  color: GroupColor;
  position: { x: number; y: number };
  size: { width: number; height: number };
  locked: boolean;
  nodeIds: string[];
}

export type EdgeStyle = "angular" | "curved";

// Workflow file format
export interface WorkflowFile {
  version: 1;
  id?: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  edgeStyle: EdgeStyle;
}

// Clipboard data structure for copy/paste
interface ClipboardData {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

interface WorkflowSnapshot {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  edgeStyle: EdgeStyle;
}

interface WorkflowStore {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  edgeStyle: EdgeStyle;
  clipboard: ClipboardData | null;

  // Multi-workflow support
  currentWorkflowId: string | null;
  workflowId: string | null; // alias for currentWorkflowId
  workflowName: string | null;
  workflowList: WorkflowMetadata[];
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // External storage settings
  saveDirectoryPath: string | null;
  useExternalImageStorage: boolean;
  setUseExternalImageStorage: (value: boolean) => void;
  setSaveDirectoryPath: (path: string | null) => void;
  setWorkflowName: (name: string | null) => void;
  createNewWorkflow: (name?: string) => string;
  switchWorkflow: (id: string) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  renameWorkflow: (id: string, name: string) => void;
  loadWorkflowList: () => Promise<void>;

  // Undo/Redo
  historyPast: WorkflowSnapshot[];
  historyFuture: WorkflowSnapshot[];
  historyGroupDepth: number;
  historyGroupSnapshot: WorkflowSnapshot | null;
  beginHistoryGroup: () => void;
  endHistoryGroup: () => void;
  undo: () => void;
  redo: () => void;

  // Settings
  setEdgeStyle: (style: EdgeStyle) => void;

  // Node operations
  addNode: (type: NodeType, position: XYPosition) => string;
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
  removeNode: (nodeId: string) => void;
  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void;

  // Edge operations
  onEdgesChange: (changes: EdgeChange<WorkflowEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  addEdgeWithType: (connection: Connection, edgeType: string) => void;
  removeEdge: (edgeId: string) => void;
  toggleEdgePause: (edgeId: string) => void;

  // Copy/Paste operations
  copySelectedNodes: () => void;
  pasteNodes: (offset?: XYPosition) => void;
  clearClipboard: () => void;

  // Execution
  isRunning: boolean;
  currentNodeId: string | null;
  pausedAtNodeId: string | null;
  abortController: AbortController | null;
  executeWorkflow: (startFromNodeId?: string) => Promise<void>;
  regenerateNode: (nodeId: string) => Promise<void>;
  stopWorkflow: () => void;

  // Save/Load
  saveWorkflow: (name?: string) => void;
  saveToProjectDirectory: () => Promise<{ success: boolean; filePath?: string; error?: string }>;
  loadWorkflow: (workflow: WorkflowFile) => void;
  clearWorkflow: () => void;

  // Cost tracking
  incurredCost: number;
  resetIncurredCost: () => void;

  // Groups (stub - not fully implemented)
  groups: Record<string, GroupData>;
  createGroup: (nodeIds: string[], name?: string) => string;
  updateGroup: (groupId: string, updates: Partial<GroupData>) => void;
  deleteGroup: (groupId: string) => void;
  moveGroupNodes: (groupId: string, delta: { x: number; y: number }) => void;
  toggleGroupLock: (groupId: string) => void;
  removeNodesFromGroup: (nodeIds: string[]) => void;

  // Helpers
  getNodeById: (id: string) => WorkflowNode | undefined;
  getConnectedInputs: (nodeId: string) => {
    images: string[];
    referenceImages: string[];
    text: string | null;
    context: string | null;
    video: string | null;
    audio: string | null;
  };
  validateWorkflow: () => { valid: boolean; errors: string[] };

  // Global Image History
  globalImageHistory: ImageHistoryItem[];
  addToGlobalHistory: (item: Omit<ImageHistoryItem, "id">) => void;
  clearGlobalHistory: () => void;

  // Manual autosave
  autoSave: () => void;
}

const createDefaultNodeData = (type: NodeType): WorkflowNodeData => {
  switch (type) {
    case "imageInput":
      return {
        image: null,
        filename: null,
        dimensions: null,
      } as ImageInputNodeData;
    case "videoInput":
      return {
        video: null,
        filename: null,
        duration: null,
        lastFrame: null,
      } as VideoInputNodeData;
    case "annotation":
      return {
        sourceImage: null,
        annotations: [],
        outputImage: null,
      } as AnnotationNodeData;
    case "prompt":
      return {
        prompt: "",
      } as PromptNodeData;
    case "nanoBanana":
      return {
        inputImages: [],
        inputPrompt: null,
        outputImage: null,
        aspectRatio: "1:1",
        resolution: "1K",
        model: "nano-banana-pro",
        useGoogleSearch: false,
        status: "idle",
        error: null,
      } as NanoBananaNodeData;
    case "llmGenerate":
      return {
        inputPrompt: null,
        inputContext: null,
        inputImages: [],
        outputText: null,
        outputImages: [],
        provider: "google",
        model: "gemini-3-flash", // Default to Gemini 3 Flash for best speed + search
        temperature: 0.7,
        maxTokens: 1024,
        useGoogleSearch: true, // Enable web search by default for ad research
        status: "idle",
        error: null,
      } as LLMGenerateNodeData;
    case "output":
      return {
        image: null,
        video: null,
      } as OutputNodeData;
    case "videoGenerate":
      return {
        inputImage: null,
        inputPrompt: null,
        inputContext: null,
        referenceImages: [],
        outputVideo: null,
        originalVideo: null, // Pre-trim backup for undo
        lastFrame: null,
        model: "veo-3.1-fast",
        duration: 8,
        aspectRatio: "9:16", // Default to vertical for UGC/social content
        resolution: "720p",
        chunkIndex: 1, // 1-indexed for display (chunk 1, 2, 3...)
        status: "idle",
        error: null,
      } as VideoGenerateNodeData;
    case "elevenLabs":
      return {
        inputText: null,
        voiceId: "pNInz6obpg8nEByWQX7X", // Adam
        outputAudio: null,
        status: "idle",
        error: null,
      } as ElevenLabsNodeData;
    case "syllableChunker":
      return {
        inputScript: null,
        outputChunks: [],
        selectedChunkIndex: 0,
        targetSyllables: 40, // ~40 syllables for comfortable 8-sec video narration
        chunkPrefix: "Dialogue: ", // prefix prepended to each chunk
        status: "idle",
        error: null,
      } as SyllableChunkerNodeData;
    case "splitGrid":
      return {
        sourceImage: null,
        gridRows: 2,
        gridCols: 3,
        targetCount: 6,
        defaultPrompt: "",
        generateSettings: {
          aspectRatio: "1:1",
          resolution: "1K",
          model: "nano-banana-pro",
          useGoogleSearch: false,
        },
        childNodeIds: [],
        isConfigured: false,
        status: "idle",
        error: null,
      } as SplitGridNodeData;
    case "videoStitch":
      return {
        inputVideos: [],
        outputVideo: null,
        iterationCount: 1,
        currentIteration: 0,
        outputFolder: null,
        status: "idle",
        error: null,
      } as VideoStitchNodeData;
    case "videoUpscale":
      return {
        inputVideo: null,
        outputVideo: null,
        targetResolution: "1080p",
        sharpen: true,
        originalResolution: null,
        newResolution: null,
        status: "idle",
        error: null,
      } as VideoUpscaleNodeData;
    case "audioProcess":
      return {
        inputVideo: null,
        outputVideo: null,
        method: "elevenlabs", // Default to AI for better quality
        noiseReduction: "medium",
        status: "idle",
        error: null,
      } as AudioProcessNodeData;
    case "caption":
      return {
        inputVideo: null,
        outputVideo: null,
        transcription: null,
        editedTranscript: null,
        style: {
          preset: "classic",
          fontFamily: "Arial",
          fontSize: 48,
          fontColor: "#FFFFFF",
          strokeColor: "#000000",
          strokeWidth: 3,
          backgroundColor: null,
          shadowColor: "#000000",
          shadowDepth: 2,
          glowColor: null,
          bold: true,
          italic: false,
          uppercase: false,
          position: "bottom",
          animation: "none",
          wordsPerLine: 4,
          highlightColor: "#FFFF00",
          highlightStyle: "box",
        },
        status: "idle",
        error: null,
      } as CaptionNodeData;
    case "voiceSwap":
      return {
        inputVideo: null,
        outputVideo: null,
        voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel voice as default
        voiceName: "Rachel",
        status: "idle",
        error: null,
      } as VoiceSwapNodeData;
    case "soundEffects":
      return {
        prompt: "",
        duration: null,
        outputAudio: null,
        status: "idle",
        error: null,
      } as SoundEffectsNodeData;
    case "musicGenerate":
      return {
        prompt: "",
        duration: 30,
        instrumental: true,
        outputAudio: null,
        status: "idle",
        error: null,
      } as MusicGenerateNodeData;
    case "motionCapture":
      return {
        referenceImage: null,
        sourceVideo: null,
        outputVideo: null,
        lastFrame: null,
        characterOrientation: "image",
        resolution: "720p",
        prompt: "",
        status: "idle",
        error: null,
      } as MotionCaptureNodeData;
    case "remotion":
      return {
        inputVideo: null,
        outputVideo: null,
        videoDuration: null,
        intro: {
          enabled: false,
          template: "none",
          duration: 3,
          text: "",
          subtext: "",
          logoUrl: "",
          backgroundColor: "#000000",
          textColor: "#FFFFFF",
          accentColor: "#3B82F6",
        },
        outro: {
          enabled: false,
          template: "none",
          duration: 3,
          text: "",
          subtext: "",
          handle: "",
          logoUrl: "",
          backgroundColor: "#000000",
          textColor: "#FFFFFF",
          accentColor: "#3B82F6",
        },
        overlays: [],
        status: "idle",
        error: null,
      } as RemotionNodeData;
    case "videoComposer":
      return {
        inputVideos: [],
        inputImages: [],
        inputCode: null,
        duration: 10,
        aspectRatio: "9:16",
        fps: 30,
        outputVideo: null,
        status: "idle",
        error: null,
      } as VideoComposerNodeData;
    case "greenScreen":
      return {
        inputVideo: null,
        extractedFrame: null,
        greenScreenImage: null,
        prompt: "same person standing on solid bright green screen background, full body visible, same pose, same clothing, same appearance, studio lighting",
        resolution: "720p",
        greenColor: "#00FF00",
        outputVideo: null,
        lastFrame: null,
        status: "idle",
        error: null,
        currentStep: "idle",
      } as GreenScreenNodeData;
  }
};

let nodeIdCounter = 0;

const HISTORY_LIMIT = 100;

// Syllable counting helper - heuristic approach for English
const countSyllables = (text: string): number => {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  let total = 0;

  for (const word of words) {
    // Remove non-alpha characters
    const clean = word.replace(/[^a-z]/g, '');
    if (clean.length === 0) continue;

    // Count vowel groups
    const vowelGroups = clean.match(/[aeiouy]+/g) || [];
    let count = vowelGroups.length;

    // Silent e at end
    if (clean.endsWith('e') && count > 1) count--;

    // Handle -le endings (bottle, apple)
    if (clean.match(/[^aeiou]le$/)) count++;

    // Minimum 1 syllable per word
    total += Math.max(1, count);
  }

  return total;
};

// Chunk text by syllables without cutting mid-sentence
// Strict mode: never exceed target syllables per chunk
const chunkBySyllables = (text: string, targetSyllables: number, prefix: string = ""): string[] => {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = '';
  let currentSyllables = 0;

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    const sentenceSyllables = countSyllables(trimmedSentence);

    // Strict: only add if it won't exceed target
    if (currentSyllables + sentenceSyllables <= targetSyllables) {
      currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
      currentSyllables += sentenceSyllables;
    } else {
      // Push current chunk if it has content
      if (currentChunk) chunks.push(currentChunk);
      // Start new chunk with this sentence
      currentChunk = trimmedSentence;
      currentSyllables = sentenceSyllables;
    }
  }

  if (currentChunk) chunks.push(currentChunk);

  // Prepend prefix to each chunk if provided
  if (prefix) {
    return chunks.map(chunk => prefix + chunk);
  }

  return chunks;
};

// IndexedDB helper for multi-workflow storage
const DB_NAME = "nodemango-db";
const DB_VERSION = 2; // Upgraded for multi-workflow support
const STORE_NAME = "states"; // Legacy store
const WORKFLOWS_STORE = "workflows"; // New: individual workflow data
const META_STORE = "meta"; // New: app-level metadata
const STATE_KEY = "nodemango-workflow"; // Legacy key

// Stored workflow structure
interface StoredWorkflow {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  edgeStyle: EdgeStyle;
}

let dbPromise: Promise<IDBDatabase> | null = null;

const getDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      // Create legacy store if needed
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }

      // Create new stores for v2
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(WORKFLOWS_STORE)) {
          db.createObjectStore(WORKFLOWS_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE);
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
};

// Save workflow to IndexedDB - legacy format (for backward compatibility)
// Now saves as structured data directly instead of JSON string to avoid size limits
const saveToIndexedDB = async (state: {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  edgeStyle: EdgeStyle;
  globalImageHistory: ImageHistoryItem[];
}) => {
  try {
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    // Save as structured object directly - IndexedDB handles this natively
    // This avoids JSON.stringify size limits with large base64 images
    const data = {
      state: {
        nodes: state.nodes,
        edges: state.edges,
        edgeStyle: state.edgeStyle,
        globalImageHistory: state.globalImageHistory,
      },
    };
    await new Promise<void>((resolve, reject) => {
      const request = store.put(data, STATE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    console.log("[Autosave] Workflow saved to IndexedDB");
  } catch (error) {
    console.error("[Autosave] Failed to save:", error);
  }
};

// Load workflow from IndexedDB - called once on app startup (legacy)
const loadFromIndexedDB = async (): Promise<{
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  edgeStyle: EdgeStyle;
  globalImageHistory: ImageHistoryItem[];
} | null> => {
  try {
    // Cleanup old localStorage version if it exists
    if (typeof window !== "undefined") {
      localStorage.removeItem("nodemango-workflow");
    }

    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    return new Promise((resolve) => {
      const request = store.get(STATE_KEY);
      request.onsuccess = () => {
        if (request.result) {
          // Handle both old JSON string format and new object format
          if (typeof request.result === "string") {
            try {
              const parsed = JSON.parse(request.result);
              resolve(parsed.state || null);
            } catch {
              resolve(null);
            }
          } else if (request.result && typeof request.result === "object") {
            // New structured object format
            resolve(request.result.state || null);
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

// Multi-workflow IndexedDB helpers
export const generateWorkflowId = () => `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const saveWorkflowToIDB = async (workflow: StoredWorkflow): Promise<void> => {
  try {
    const db = await getDB();
    const transaction = db.transaction(WORKFLOWS_STORE, "readwrite");
    const store = transaction.objectStore(WORKFLOWS_STORE);
    await new Promise<void>((resolve, reject) => {
      const request = store.put(workflow);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("[IDB] Failed to save workflow:", error);
  }
};

const loadWorkflowFromIDB = async (id: string): Promise<StoredWorkflow | null> => {
  try {
    const db = await getDB();
    const transaction = db.transaction(WORKFLOWS_STORE, "readonly");
    const store = transaction.objectStore(WORKFLOWS_STORE);
    return new Promise((resolve) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

const deleteWorkflowFromIDB = async (id: string): Promise<void> => {
  try {
    const db = await getDB();
    const transaction = db.transaction(WORKFLOWS_STORE, "readwrite");
    const store = transaction.objectStore(WORKFLOWS_STORE);
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("[IDB] Failed to delete workflow:", error);
  }
};

const loadAllWorkflowsFromIDB = async (): Promise<StoredWorkflow[]> => {
  try {
    const db = await getDB();
    const transaction = db.transaction(WORKFLOWS_STORE, "readonly");
    const store = transaction.objectStore(WORKFLOWS_STORE);
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
};

const saveMetaToIDB = async (key: string, value: unknown): Promise<void> => {
  try {
    const db = await getDB();
    const transaction = db.transaction(META_STORE, "readwrite");
    const store = transaction.objectStore(META_STORE);
    await new Promise<void>((resolve, reject) => {
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("[IDB] Failed to save meta:", error);
  }
};

const loadMetaFromIDB = async <T>(key: string): Promise<T | null> => {
  try {
    const db = await getDB();
    const transaction = db.transaction(META_STORE, "readonly");
    const store = transaction.objectStore(META_STORE);
    return new Promise((resolve) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

export const useWorkflowStore = create<WorkflowStore>()((set, get) => {
      const getSnapshot = (): WorkflowSnapshot => {
        const { nodes, edges, edgeStyle } = get();
        return { nodes, edges, edgeStyle };
      };

      const recordHistory = () => {
        const { isRunning, historyGroupDepth, historyGroupSnapshot } = get();
        if (isRunning) return;

        // If we're in a grouped transaction, only capture the "before" snapshot once.
        if (historyGroupDepth > 0) {
          if (!historyGroupSnapshot) {
            set({ historyGroupSnapshot: getSnapshot() });
          }
          return;
        }

        const snapshot = getSnapshot();
        set((state) => {
          const last = state.historyPast[state.historyPast.length - 1];
          if (
            last &&
            last.nodes === snapshot.nodes &&
            last.edges === snapshot.edges &&
            last.edgeStyle === snapshot.edgeStyle
          ) {
            return state;
          }

          const nextPast = [...state.historyPast, snapshot].slice(-HISTORY_LIMIT);
          return {
            ...state,
            historyPast: nextPast,
            historyFuture: [],
          };
        });
      };

      const beginHistoryGroup = () => {
        if (get().isRunning) return;
        set((state) => ({
          ...state,
          historyGroupDepth: state.historyGroupDepth + 1,
          historyGroupSnapshot:
            state.historyGroupDepth === 0 ? getSnapshot() : state.historyGroupSnapshot,
        }));
      };

      const endHistoryGroup = () => {
        if (get().isRunning) return;
        const { historyGroupDepth, historyGroupSnapshot } = get();
        if (historyGroupDepth <= 0) return;

        if (historyGroupDepth > 1) {
          set((state) => ({
            ...state,
            historyGroupDepth: Math.max(0, state.historyGroupDepth - 1),
          }));
          return;
        }

        // Closing the outermost group: commit one history entry if anything changed.
        const before = historyGroupSnapshot;
        const after = getSnapshot();

        set((state) => {
          const nextState: Partial<WorkflowStore> = {
            historyGroupDepth: 0,
            historyGroupSnapshot: null,
          };

          if (
            before &&
            (before.nodes !== after.nodes ||
              before.edges !== after.edges ||
              before.edgeStyle !== after.edgeStyle)
          ) {
            const last = state.historyPast[state.historyPast.length - 1];
            if (
              !last ||
              last.nodes !== before.nodes ||
              last.edges !== before.edges ||
              last.edgeStyle !== before.edgeStyle
            ) {
              (nextState as WorkflowStore).historyPast = [...state.historyPast, before].slice(
                -HISTORY_LIMIT
              );
            } else {
              (nextState as WorkflowStore).historyPast = state.historyPast;
            }
            (nextState as WorkflowStore).historyFuture = [];
          }

          return { ...state, ...nextState };
        });
      };

      const undo = () => {
        const { historyPast, isRunning } = get();
        if (isRunning) return;
        if (historyPast.length === 0) return;

        const current = getSnapshot();
        const previous = historyPast[historyPast.length - 1];

        set((state) => ({
          ...state,
          nodes: previous.nodes,
          edges: previous.edges,
          edgeStyle: previous.edgeStyle,
          historyPast: state.historyPast.slice(0, -1),
          historyFuture: [...state.historyFuture, current].slice(-HISTORY_LIMIT),
          // Cancel any execution state when time-traveling.
          isRunning: false,
          currentNodeId: null,
          pausedAtNodeId: null,
          historyGroupDepth: 0,
          historyGroupSnapshot: null,
        }));
      };

      const redo = () => {
        const { historyFuture, isRunning } = get();
        if (isRunning) return;
        if (historyFuture.length === 0) return;

        const current = getSnapshot();
        const next = historyFuture[historyFuture.length - 1];

        set((state) => ({
          ...state,
          nodes: next.nodes,
          edges: next.edges,
          edgeStyle: next.edgeStyle,
          historyPast: [...state.historyPast, current].slice(-HISTORY_LIMIT),
          historyFuture: state.historyFuture.slice(0, -1),
          // Cancel any execution state when time-traveling.
          isRunning: false,
          currentNodeId: null,
          pausedAtNodeId: null,
          historyGroupDepth: 0,
          historyGroupSnapshot: null,
        }));
      };

      return {
  nodes: [],
  edges: [],
  edgeStyle: "curved" as EdgeStyle,
  clipboard: null,

  // Multi-workflow state
  currentWorkflowId: null,
  workflowId: null, // alias
  workflowName: null,
  workflowList: [],
  sidebarOpen: false,

  // External storage settings
  saveDirectoryPath: null,
  useExternalImageStorage: false,

        historyPast: [],
        historyFuture: [],
        historyGroupDepth: 0,
        historyGroupSnapshot: null,
        beginHistoryGroup,
        endHistoryGroup,
        undo,
        redo,
  isRunning: false,
  currentNodeId: null,
  pausedAtNodeId: null,
  incurredCost: 0,
  groups: {},
        abortController: null,
  globalImageHistory: [],

  // Multi-workflow methods
  setSidebarOpen: (open: boolean) => {
    set({ sidebarOpen: open });
  },

  // External storage setters
  setUseExternalImageStorage: (value: boolean) => {
    set({ useExternalImageStorage: value });
  },
  setSaveDirectoryPath: (path: string | null) => {
    set({ saveDirectoryPath: path });
  },
  setWorkflowName: (name: string | null) => {
    set({ workflowName: name });
  },

  createNewWorkflow: (name?: string) => {
    const { nodes, edges, edgeStyle, currentWorkflowId, workflowList } = get();
    const now = Date.now();

    // Save current workflow before creating new one
    if (currentWorkflowId) {
      const currentWorkflow = workflowList.find((w) => w.id === currentWorkflowId);
      if (currentWorkflow) {
        saveWorkflowToIDB({
          id: currentWorkflowId,
          name: currentWorkflow.name,
          createdAt: currentWorkflow.createdAt,
          updatedAt: now,
          nodes,
          edges,
          edgeStyle,
        });
        // Update the updatedAt in the list
        set({
          workflowList: workflowList.map((w) =>
            w.id === currentWorkflowId ? { ...w, updatedAt: now } : w
          ),
        });
      }
    }

    // Create new workflow
    const newId = generateWorkflowId();
    const newName = name || `Workflow ${workflowList.length + 1}`;
    const newWorkflow: StoredWorkflow = {
      id: newId,
      name: newName,
      createdAt: now,
      updatedAt: now,
      nodes: [],
      edges: [],
      edgeStyle: "curved",
    };

    // Save and switch to new workflow
    saveWorkflowToIDB(newWorkflow);
    saveMetaToIDB("currentWorkflowId", newId);

    const newMeta: WorkflowMetadata = {
      id: newId,
      name: newName,
      createdAt: now,
      updatedAt: now,
    };

    set({
      nodes: [],
      edges: [],
      edgeStyle: "curved",
      currentWorkflowId: newId,
      workflowList: [...get().workflowList, newMeta],
      historyPast: [],
      historyFuture: [],
    });

    return newId;
  },

  switchWorkflow: async (id: string) => {
    const { nodes, edges, edgeStyle, currentWorkflowId, workflowList, isRunning } = get();

    if (isRunning || id === currentWorkflowId) return;

    const now = Date.now();

    // Save current workflow before switching
    if (currentWorkflowId) {
      const currentMeta = workflowList.find((w) => w.id === currentWorkflowId);
      if (currentMeta) {
        await saveWorkflowToIDB({
          id: currentWorkflowId,
          name: currentMeta.name,
          createdAt: currentMeta.createdAt,
          updatedAt: now,
          nodes,
          edges,
          edgeStyle,
        });
      }
    }

    // Load the target workflow
    const workflow = await loadWorkflowFromIDB(id);
    if (!workflow) return;

    // Update nodeIdCounter
    const maxId = workflow.nodes.reduce((max, node) => {
      const match = node.id.match(/-(\d+)$/);
      if (match) {
        return Math.max(max, parseInt(match[1], 10));
      }
      return max;
    }, 0);
    nodeIdCounter = maxId;

    // Save current workflow ID to meta
    await saveMetaToIDB("currentWorkflowId", id);

    set({
      nodes: workflow.nodes,
      edges: workflow.edges,
      edgeStyle: workflow.edgeStyle || "curved",
      currentWorkflowId: id,
      workflowList: workflowList.map((w) =>
        w.id === currentWorkflowId ? { ...w, updatedAt: now } : w
      ),
      historyPast: [],
      historyFuture: [],
      isRunning: false,
      currentNodeId: null,
      pausedAtNodeId: null,
    });
  },

  deleteWorkflow: async (id: string) => {
    const { workflowList, currentWorkflowId } = get();

    if (workflowList.length <= 1) return; // Don't delete last workflow

    await deleteWorkflowFromIDB(id);

    const newList = workflowList.filter((w) => w.id !== id);

    // If deleting current workflow, switch to another
    if (id === currentWorkflowId) {
      const nextWorkflow = newList[0];
      if (nextWorkflow) {
        const workflow = await loadWorkflowFromIDB(nextWorkflow.id);
        if (workflow) {
          const maxId = workflow.nodes.reduce((max, node) => {
            const match = node.id.match(/-(\d+)$/);
            if (match) {
              return Math.max(max, parseInt(match[1], 10));
            }
            return max;
          }, 0);
          nodeIdCounter = maxId;

          await saveMetaToIDB("currentWorkflowId", nextWorkflow.id);

          set({
            nodes: workflow.nodes,
            edges: workflow.edges,
            edgeStyle: workflow.edgeStyle || "curved",
            currentWorkflowId: nextWorkflow.id,
            workflowList: newList,
            historyPast: [],
            historyFuture: [],
          });
          return;
        }
      }
    }

    set({ workflowList: newList });
  },

  renameWorkflow: (id: string, name: string) => {
    const { workflowList, nodes, edges, edgeStyle } = get();
    const workflow = workflowList.find((w) => w.id === id);
    if (!workflow) return;

    const now = Date.now();
    const updatedMeta = { ...workflow, name, updatedAt: now };

    // Update in IDB
    saveWorkflowToIDB({
      id,
      name,
      createdAt: workflow.createdAt,
      updatedAt: now,
      nodes: id === get().currentWorkflowId ? nodes : [],
      edges: id === get().currentWorkflowId ? edges : [],
      edgeStyle: id === get().currentWorkflowId ? edgeStyle : "curved",
    });

    set({
      workflowList: workflowList.map((w) => (w.id === id ? updatedMeta : w)),
    });
  },

  loadWorkflowList: async () => {
    const workflows = await loadAllWorkflowsFromIDB();
    const currentId = await loadMetaFromIDB<string>("currentWorkflowId");

    if (workflows.length === 0) {
      // No workflows exist, check for legacy data to migrate
      const legacyData = await loadFromIndexedDB();
      const now = Date.now();
      const newId = generateWorkflowId();

      const newWorkflow: StoredWorkflow = {
        id: newId,
        name: "Workflow 1",
        createdAt: now,
        updatedAt: now,
        nodes: legacyData?.nodes || [],
        edges: legacyData?.edges || [],
        edgeStyle: legacyData?.edgeStyle || "curved",
      };

      await saveWorkflowToIDB(newWorkflow);
      await saveMetaToIDB("currentWorkflowId", newId);
      await saveMetaToIDB("globalImageHistory", legacyData?.globalImageHistory || []);

      const maxId = newWorkflow.nodes.reduce((max, node) => {
        const match = node.id.match(/-(\d+)$/);
        if (match) {
          return Math.max(max, parseInt(match[1], 10));
        }
        return max;
      }, 0);
      nodeIdCounter = maxId;

      set({
        nodes: newWorkflow.nodes,
        edges: newWorkflow.edges,
        edgeStyle: newWorkflow.edgeStyle,
        currentWorkflowId: newId,
        workflowList: [
          {
            id: newId,
            name: "Workflow 1",
            createdAt: now,
            updatedAt: now,
          },
        ],
        globalImageHistory: legacyData?.globalImageHistory || [],
      });

      console.log("[Workflows] Migrated legacy workflow to multi-workflow system");
      return;
    }

    // Build metadata list from stored workflows
    const metaList: WorkflowMetadata[] = workflows.map((w) => ({
      id: w.id,
      name: w.name,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));

    // Sort by updatedAt descending
    metaList.sort((a, b) => b.updatedAt - a.updatedAt);

    // Load current workflow or first one
    const targetId = currentId && workflows.find((w) => w.id === currentId) ? currentId : metaList[0].id;
    const workflow = workflows.find((w) => w.id === targetId);

    if (workflow) {
      const maxId = workflow.nodes.reduce((max, node) => {
        const match = node.id.match(/-(\d+)$/);
        if (match) {
          return Math.max(max, parseInt(match[1], 10));
        }
        return max;
      }, 0);
      nodeIdCounter = maxId;

      // Load global history
      const history = await loadMetaFromIDB<ImageHistoryItem[]>("globalImageHistory");

      set({
        nodes: workflow.nodes,
        edges: workflow.edges,
        edgeStyle: workflow.edgeStyle || "curved",
        currentWorkflowId: targetId,
        workflowList: metaList,
        globalImageHistory: history || [],
      });

      console.log(`[Workflows] Loaded ${metaList.length} workflows, current: ${workflow.name}`);
    }
  },

  setEdgeStyle: (style: EdgeStyle) => {
          recordHistory();
    set({ edgeStyle: style });
  },

  addNode: (type: NodeType, position: XYPosition) => {
      recordHistory();
    const id = `${type}-${++nodeIdCounter}`;

    // Default dimensions based on node type
    const defaultDimensions: Record<NodeType, { width: number; height: number }> = {
      imageInput: { width: 300, height: 280 },
      videoInput: { width: 320, height: 320 },
      annotation: { width: 300, height: 280 },
      prompt: { width: 320, height: 220 },
      nanoBanana: { width: 300, height: 300 },
      llmGenerate: { width: 320, height: 360 },
      output: { width: 320, height: 320 },
      videoGenerate: { width: 340, height: 580 },
      elevenLabs: { width: 300, height: 200 },
      syllableChunker: { width: 340, height: 320 },
      splitGrid: { width: 300, height: 320 },
      videoStitch: { width: 340, height: 380 },
      videoUpscale: { width: 320, height: 340 },
      audioProcess: { width: 320, height: 360 },
      caption: { width: 360, height: 620 },
      voiceSwap: { width: 340, height: 400 },
      soundEffects: { width: 320, height: 320 },
      musicGenerate: { width: 320, height: 380 },
      motionCapture: { width: 380, height: 520 },
      remotion: { width: 380, height: 600 },
      videoComposer: { width: 380, height: 520 },
      greenScreen: { width: 380, height: 580 },
    };

    const { width, height } = defaultDimensions[type];

    const newNode: WorkflowNode = {
      id,
      type,
      position,
      data: createDefaultNodeData(type),
      style: { width, height },
    };

    set((state) => ({
      nodes: [...state.nodes, newNode],
    }));

    return id;
  },

  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } as WorkflowNodeData }
          : node
      ) as WorkflowNode[],
    }));
  },

  removeNode: (nodeId: string) => {
      recordHistory();
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== nodeId),
      edges: state.edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      ),
    }));
  },

  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => {
      const shouldRecord = changes.some((change: any) => {
        if (change.type === "remove") return true;
        if (change.type === "add") return true;
        if (change.type === "position") {
          // record only on drag end to avoid a history entry per mouse move
          return change.dragging === false || change.dragging === undefined;
        }
        return false;
      });

      if (shouldRecord) recordHistory();

    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    }));
  },

  onEdgesChange: (changes: EdgeChange<WorkflowEdge>[]) => {
      const shouldRecord = changes.some((change: any) => {
        if (change.type === "remove") return true;
        if (change.type === "add") return true;
        return false;
      });

      if (shouldRecord) recordHistory();

    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }));
  },

  onConnect: (connection: Connection) => {
      recordHistory();
    set((state) => ({
      edges: addEdge(
        {
          ...connection,
          id: `edge-${connection.source}-${connection.target}-${connection.sourceHandle || "default"}-${connection.targetHandle || "default"}`,
        },
        state.edges
      ),
    }));
  },

  addEdgeWithType: (connection: Connection, edgeType: string) => {
    recordHistory();
    set((state) => ({
      edges: addEdge(
        {
          ...connection,
          id: `edge-${connection.source}-${connection.target}-${connection.sourceHandle || "default"}-${connection.targetHandle || "default"}`,
          type: edgeType,
        },
        state.edges
      ),
    }));
  },

  removeEdge: (edgeId: string) => {
      recordHistory();
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== edgeId),
    }));
  },

  toggleEdgePause: (edgeId: string) => {
      recordHistory();
    set((state) => ({
      edges: state.edges.map((edge) =>
        edge.id === edgeId
          ? { ...edge, data: { ...edge.data, hasPause: !edge.data?.hasPause } }
          : edge
      ),
    }));
  },

  copySelectedNodes: () => {
    const { nodes, edges } = get();
    const selectedNodes = nodes.filter((node) => node.selected);

    if (selectedNodes.length === 0) return;

    const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));

    // Copy edges that connect selected nodes to each other
    const connectedEdges = edges.filter(
      (edge) => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
    );

    // Deep clone the nodes and edges to avoid reference issues
    const clonedNodes = JSON.parse(JSON.stringify(selectedNodes)) as WorkflowNode[];
    const clonedEdges = JSON.parse(JSON.stringify(connectedEdges)) as WorkflowEdge[];

    set({ clipboard: { nodes: clonedNodes, edges: clonedEdges } });
  },

  pasteNodes: (offset: XYPosition = { x: 50, y: 50 }) => {
    const { clipboard, nodes, edges } = get();

    if (!clipboard || clipboard.nodes.length === 0) return;

      recordHistory();

    // Create a mapping from old node IDs to new node IDs
    const idMapping = new Map<string, string>();

    // Generate new IDs for all pasted nodes
    clipboard.nodes.forEach((node) => {
      const newId = `${node.type}-${++nodeIdCounter}`;
      idMapping.set(node.id, newId);
    });

    // Create new nodes with updated IDs and offset positions
    const newNodes: WorkflowNode[] = clipboard.nodes.map((node) => ({
      ...node,
      id: idMapping.get(node.id)!,
      position: {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y,
      },
      selected: true, // Select newly pasted nodes
      data: { ...node.data }, // Deep copy data
    }));

    // Create new edges with updated source/target IDs
    const newEdges: WorkflowEdge[] = clipboard.edges.map((edge) => ({
      ...edge,
      id: `edge-${idMapping.get(edge.source)}-${idMapping.get(edge.target)}-${edge.sourceHandle || "default"}-${edge.targetHandle || "default"}`,
      source: idMapping.get(edge.source)!,
      target: idMapping.get(edge.target)!,
    }));

    // Deselect existing nodes and add new ones
    const updatedNodes = nodes.map((node) => ({
      ...node,
      selected: false,
    }));

    set({
      nodes: [...updatedNodes, ...newNodes] as WorkflowNode[],
      edges: [...edges, ...newEdges],
    });
  },

  clearClipboard: () => {
    set({ clipboard: null });
  },

  getNodeById: (id: string) => {
    return get().nodes.find((node) => node.id === id);
  },

  getConnectedInputs: (nodeId: string) => {
    const { edges, nodes } = get();
    const images: string[] = [];
    const referenceImages: string[] = [];
    let text: string | null = null;
    let context: string | null = null;
    let video: string | null = null;
    let audio: string | null = null;

    // Helper to extract image from a source node
    const getImageFromNode = (sourceNode: WorkflowNode): string | null => {
      if (sourceNode.type === "imageInput") {
        return (sourceNode.data as ImageInputNodeData).image;
      } else if (sourceNode.type === "annotation") {
        return (sourceNode.data as AnnotationNodeData).outputImage;
      } else if (sourceNode.type === "nanoBanana") {
        return (sourceNode.data as NanoBananaNodeData).outputImage;
      } else if (sourceNode.type === "llmGenerate") {
        const sourceImages = (sourceNode.data as LLMGenerateNodeData).outputImages;
        return sourceImages && sourceImages.length > 0 ? sourceImages[0] : null;
      } else if (sourceNode.type === "videoGenerate") {
        // Passthrough last frame for chaining
        return (sourceNode.data as VideoGenerateNodeData).lastFrame;
      } else if (sourceNode.type === "videoInput") {
        // Output last frame from uploaded video
        return (sourceNode.data as VideoInputNodeData).lastFrame;
      }
      return null;
    };

    edges
      .filter((edge) => edge.target === nodeId)
      .forEach((edge) => {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        if (!sourceNode) return;

        const handleId = edge.targetHandle;

        if (handleId === "image" || !handleId) {
          // Get image from source node - collect all connected images
          const img = getImageFromNode(sourceNode);
          if (img) images.push(img);
          // Also handle LLM multiple images
          if (sourceNode.type === "llmGenerate") {
            const sourceImages = (sourceNode.data as LLMGenerateNodeData).outputImages;
            if (sourceImages && sourceImages.length > 1) {
              images.push(...sourceImages.slice(1));
            }
          }
        }

        // Reference handle - for style/content reference images (separate from start frame)
        if (handleId === "reference") {
          const sourceHandle = edge.sourceHandle;

          // If source is a videoGenerate's reference output, passthrough its reference images
          if (sourceNode.type === "videoGenerate" && sourceHandle === "reference") {
            // Always recursively get the source node's actual connected references
            // Don't rely on stored data as it may be stale after connections are removed
            const sourceNodeRefs = get().getConnectedInputs(sourceNode.id).referenceImages;
            if (sourceNodeRefs.length > 0) {
              referenceImages.push(...sourceNodeRefs);
            }
          } else {
            // Normal image source
            const img = getImageFromNode(sourceNode);
            if (img) referenceImages.push(img);
            // Also handle LLM multiple images for reference
            if (sourceNode.type === "llmGenerate") {
              const sourceImages = (sourceNode.data as LLMGenerateNodeData).outputImages;
              if (sourceImages && sourceImages.length > 1) {
                referenceImages.push(...sourceImages.slice(1));
              }
            }
          }
        }

        if (handleId === "text") {
          if (sourceNode.type === "prompt") {
            text = (sourceNode.data as PromptNodeData).prompt;
          } else if (sourceNode.type === "llmGenerate") {
            text = (sourceNode.data as LLMGenerateNodeData).outputText;
          } else if (sourceNode.type === "syllableChunker") {
            // Output the selected chunk
            const chunkerData = sourceNode.data as SyllableChunkerNodeData;
            const chunks = chunkerData.outputChunks || [];
            const idx = chunkerData.selectedChunkIndex || 0;
            text = chunks[idx] || null;
          }
        }

        // Context handle - same sources as text, but stored separately
        if (handleId === "context") {
          if (sourceNode.type === "prompt") {
            context = (sourceNode.data as PromptNodeData).prompt;
          } else if (sourceNode.type === "llmGenerate") {
            context = (sourceNode.data as LLMGenerateNodeData).outputText;
          }
        }

        if (handleId === "video") {
          if (sourceNode.type === "videoGenerate") {
            video = (sourceNode.data as VideoGenerateNodeData).outputVideo;
          } else if (sourceNode.type === "videoInput") {
            video = (sourceNode.data as VideoInputNodeData).video;
          } else if (sourceNode.type === "videoStitch") {
            video = (sourceNode.data as VideoStitchNodeData).outputVideo;
          } else if (sourceNode.type === "videoUpscale") {
            video = (sourceNode.data as VideoUpscaleNodeData).outputVideo;
          } else if (sourceNode.type === "audioProcess") {
            video = (sourceNode.data as AudioProcessNodeData).outputVideo;
          } else if (sourceNode.type === "caption") {
            video = (sourceNode.data as CaptionNodeData).outputVideo;
          } else if (sourceNode.type === "voiceSwap") {
            video = (sourceNode.data as VoiceSwapNodeData).outputVideo;
          } else if (sourceNode.type === "motionCapture") {
            video = (sourceNode.data as MotionCaptureNodeData).outputVideo;
          } else if (sourceNode.type === "remotion") {
            video = (sourceNode.data as RemotionNodeData).outputVideo;
          }
        }

        if (handleId === "audio") {
          if (sourceNode.type === "elevenLabs") {
            audio = (sourceNode.data as ElevenLabsNodeData).outputAudio;
          }
        }
      });

    return { images, referenceImages, text, context, video, audio };
  },

  validateWorkflow: () => {
    const { nodes, edges } = get();
    const errors: string[] = [];

    // Check if there are any nodes
    if (nodes.length === 0) {
      errors.push("Workflow is empty");
      return { valid: false, errors };
    }

    // Check each Nano Banana node has required inputs (only text is required, image is optional)
    nodes
      .filter((n) => n.type === "nanoBanana")
      .forEach((node) => {
        const textConnected = edges.some(
          (e) => e.target === node.id && e.targetHandle === "text"
        );

        if (!textConnected) {
          errors.push(`Generate node "${node.id}" missing text input`);
        }
      });

    // Check annotation nodes have image input (either connected or manually loaded)
    nodes
      .filter((n) => n.type === "annotation")
      .forEach((node) => {
        const imageConnected = edges.some((e) => e.target === node.id);
        const hasManualImage = (node.data as AnnotationNodeData).sourceImage !== null;
        if (!imageConnected && !hasManualImage) {
          errors.push(`Annotation node "${node.id}" missing image input`);
        }
      });

    // Check output nodes have image input
    nodes
      .filter((n) => n.type === "output")
      .forEach((node) => {
        const imageConnected = edges.some((e) => e.target === node.id);
        if (!imageConnected) {
          errors.push(`Output node "${node.id}" missing image input`);
        }
      });

    return { valid: errors.length === 0, errors };
  },

  executeWorkflow: async (startFromNodeId?: string) => {
    const { nodes, edges, updateNodeData, getConnectedInputs, isRunning } = get();

    if (isRunning) {
      return;
    }

    const isResuming = startFromNodeId === get().pausedAtNodeId;
    const abortController = new AbortController();
    set({ isRunning: true, pausedAtNodeId: null, abortController });

    // Topological sort
    const sorted: WorkflowNode[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      if (visiting.has(nodeId)) {
        throw new Error("Cycle detected in workflow");
      }

      visiting.add(nodeId);

      // Visit all nodes that this node depends on
      edges
        .filter((e) => e.target === nodeId)
        .forEach((e) => visit(e.source));

      visiting.delete(nodeId);
      visited.add(nodeId);

      const node = nodes.find((n) => n.id === nodeId);
      if (node) sorted.push(node);
    };

    try {
      nodes.forEach((node) => visit(node.id));

      // If starting from a specific node, find its index and skip earlier nodes
      let startIndex = 0;
      if (startFromNodeId) {
        const nodeIndex = sorted.findIndex((n) => n.id === startFromNodeId);
        if (nodeIndex !== -1) {
          startIndex = nodeIndex;
        }
      }

      // Execute nodes in order, starting from startIndex
      for (let i = startIndex; i < sorted.length; i++) {
        const node = sorted[i];
        if (!get().isRunning) break;

        // Check for pause edges on incoming connections (skip if resuming from this exact node)
        const isResumingThisNode = isResuming && node.id === startFromNodeId;
        if (!isResumingThisNode) {
          const incomingEdges = edges.filter((e) => e.target === node.id);
          const pauseEdge = incomingEdges.find((e) => e.data?.hasPause);
          if (pauseEdge) {
            set({ pausedAtNodeId: node.id, isRunning: false, currentNodeId: null });
            useToast.getState().show("Workflow paused - click Run to continue", "warning");
            return;
          }
        }

        set({ currentNodeId: node.id });

        switch (node.type) {
          case "imageInput":
            // Nothing to execute, data is already set
            break;

          case "annotation": {
            // Get connected image and set as source (use first image)
            const { images } = getConnectedInputs(node.id);
            const image = images[0] || null;
            if (image) {
              updateNodeData(node.id, { sourceImage: image });
              // If no annotations, pass through the image
              const nodeData = node.data as AnnotationNodeData;
              if (!nodeData.outputImage) {
                updateNodeData(node.id, { outputImage: image });
              }
            }
            break;
          }

          case "prompt":
            // Nothing to execute, data is already set
            break;

          case "nanoBanana": {
            const { images, text } = getConnectedInputs(node.id);

            if (!text) {
              updateNodeData(node.id, {
                status: "error",
                error: "Missing text input",
              });
              set({ isRunning: false, currentNodeId: null });
              return;
            }

            updateNodeData(node.id, {
              inputImages: images,
              inputPrompt: text,
              status: "loading",
              error: null,
            });

            try {
              const nodeData = node.data as NanoBananaNodeData;

              const requestPayload = {
                images,
                prompt: text,
                aspectRatio: nodeData.aspectRatio,
                resolution: nodeData.resolution,
                model: nodeData.model,
                useGoogleSearch: nodeData.useGoogleSearch,
              };

              const { geminiApiKey } = useSettingsStore.getState();
              const response = await fetch("/api/generate", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(geminiApiKey && { "x-gemini-api-key": geminiApiKey }),
                },
                body: JSON.stringify(requestPayload),
                signal: abortController.signal,
              });

              if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                  const errorJson = JSON.parse(errorText);
                  errorMessage = errorJson.error || errorMessage;
                } catch {
                  if (errorText) errorMessage += ` - ${errorText.substring(0, 200)}`;
                }

                updateNodeData(node.id, {
                  status: "error",
                  error: errorMessage,
                });
                set({ isRunning: false, currentNodeId: null });
                return;
              }

              const result = await response.json();

              if (result.success && result.image) {
                // Save the newly generated image to global history
                get().addToGlobalHistory({
                  image: result.image,
                  timestamp: Date.now(),
                  prompt: text,
                  aspectRatio: nodeData.aspectRatio,
                  model: nodeData.model,
                });
                updateNodeData(node.id, {
                  outputImage: result.image,
                  status: "complete",
                  error: null,
                });
              } else {
                updateNodeData(node.id, {
                  status: "error",
                  error: result.error || "Generation failed",
                });
                set({ isRunning: false, currentNodeId: null });
                return;
              }
            } catch (error) {
              if (error instanceof Error && error.name === "AbortError") {
                updateNodeData(node.id, { status: "idle", error: null });
                set({ isRunning: false, currentNodeId: null, abortController: null });
                return;
              }

              let errorMessage = "Generation failed";
              if (error instanceof TypeError && error.message.includes("NetworkError")) {
                errorMessage = "Network error. Check your connection and try again.";
              } else if (error instanceof TypeError) {
                errorMessage = `Network error: ${error.message}`;
              } else if (error instanceof Error) {
                errorMessage = error.message;
              }

              updateNodeData(node.id, {
                status: "error",
                error: errorMessage,
              });
              set({ isRunning: false, currentNodeId: null, abortController: null });
              return;
            }
            break;
          }

          case "llmGenerate": {
            const { images, text, context } = getConnectedInputs(node.id);

            if (!text && !context) {
              updateNodeData(node.id, {
                status: "error",
                error: "Missing text or context input",
              });
              set({ isRunning: false, currentNodeId: null });
              return;
            }

            // Combine text (instruction) and context (content) if both present
            let combinedPrompt: string;
            if (text && context) {
              combinedPrompt = `${text}\n\n---\n\n${context}`;
            } else {
              combinedPrompt = text || context || "";
            }

            updateNodeData(node.id, {
              inputPrompt: text,
              inputContext: context,
              inputImages: images,
              outputImages: images, // passthrough
              status: "loading",
              error: null,
            });

            try {
              const nodeData = node.data as LLMGenerateNodeData;
              const { geminiApiKey, openaiApiKey } = useSettingsStore.getState();
              const response = await fetch("/api/llm", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(geminiApiKey && { "x-gemini-api-key": geminiApiKey }),
                  ...(openaiApiKey && { "x-openai-api-key": openaiApiKey }),
                },
                body: JSON.stringify({
                  prompt: combinedPrompt,
                  images,
                  provider: nodeData.provider,
                  model: nodeData.model,
                  temperature: nodeData.temperature,
                  maxTokens: nodeData.maxTokens,
                  useGoogleSearch: nodeData.useGoogleSearch ?? false,
                }),
                signal: abortController.signal,
              });

              if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `HTTP ${response.status}`;
                try {
                  const errorJson = JSON.parse(errorText);
                  errorMessage = errorJson.error || errorMessage;
                } catch {
                  if (errorText) errorMessage += ` - ${errorText.substring(0, 200)}`;
                }
                updateNodeData(node.id, {
                  status: "error",
                  error: errorMessage,
                });
                set({ isRunning: false, currentNodeId: null });
                return;
              }

              const result = await response.json();

              if (result.success && result.text) {
                updateNodeData(node.id, {
                  outputText: result.text,
                  status: "complete",
                  error: null,
                });
              } else {
                updateNodeData(node.id, {
                  status: "error",
                  error: result.error || "LLM generation failed",
                });
                set({ isRunning: false, currentNodeId: null });
                return;
              }
            } catch (error) {
              if (error instanceof Error && error.name === "AbortError") {
                updateNodeData(node.id, { status: "idle", error: null });
                set({ isRunning: false, currentNodeId: null, abortController: null });
                return;
              }
              updateNodeData(node.id, {
                status: "error",
                error: error instanceof Error ? error.message : "LLM generation failed",
              });
              set({ isRunning: false, currentNodeId: null, abortController: null });
              return;
            }
            break;
          }

          case "output": {
            const { images, video } = getConnectedInputs(node.id);
            if (images.length > 0) updateNodeData(node.id, { image: images[0] });
            if (video) updateNodeData(node.id, { video });
            break;
          }

          case "videoGenerate": {
            const { images, referenceImages, context } = getConnectedInputs(node.id);
            const nodeData = node.data as VideoGenerateNodeData;

            // For video chaining, prioritize last frames from upstream video nodes
            // This ensures proper continuity when multiple images are connected
            const imageEdges = edges.filter(e => e.target === node.id && (e.targetHandle === "image" || !e.targetHandle));
            let firstFrame: string | null = null;

            // First, look for a last frame from an upstream video node (for chaining)
            for (const edge of imageEdges) {
              const sourceNode = nodes.find(n => n.id === edge.source);
              if (sourceNode?.type === "videoGenerate" || sourceNode?.type === "videoInput") {
                const lastFrame = sourceNode.type === "videoGenerate"
                  ? (sourceNode.data as VideoGenerateNodeData).lastFrame
                  : (sourceNode.data as VideoInputNodeData).lastFrame;
                if (lastFrame) {
                  firstFrame = lastFrame;
                  console.log(`[Video] Using last frame from ${sourceNode.type} ${sourceNode.id} for chaining`);
                  break;
                }
              }
            }

            // Fall back to first available image if no video last frame found
            if (!firstFrame && images.length > 0) {
              firstFrame = images[0];
              console.log(`[Video] Using first available image as start frame (no video chain detected)`);
            }

            // referenceImages come from separate reference handle (up to 3)
            const refs = referenceImages.slice(0, 3);

            // Get text input - check if connected to a syllable chunker for chunk selection
            let text: string | null = null;
            const textEdge = edges.find(e => e.target === node.id && e.targetHandle === "text");
            if (textEdge) {
              // Get fresh node data (not the captured `nodes` from start of execution)
              const currentNodes = get().nodes;
              const sourceNode = currentNodes.find(n => n.id === textEdge.source);
              if (sourceNode?.type === "syllableChunker") {
                // Use the video node's chunkIndex to select which chunk
                const chunkerData = sourceNode.data as SyllableChunkerNodeData;
                const chunks = chunkerData.outputChunks || [];
                const idx = Math.max(0, Math.min(nodeData.chunkIndex - 1, chunks.length - 1)); // Convert 1-indexed to 0-indexed
                text = chunks[idx] || null;
                console.log(`[Video] Using chunk ${nodeData.chunkIndex} of ${chunks.length}: "${text?.substring(0, 50)}..."`);
              } else {
                // Normal text source - also get fresh data
                const { text: connectedText } = get().getConnectedInputs(node.id);
                text = connectedText;
              }
            }

            if (!firstFrame || !text) {
              updateNodeData(node.id, { status: "error", error: "Missing image or prompt input" });
              set({ isRunning: false, currentNodeId: null });
              return;
            }

            // Combine prompt and context if context is provided
            const fullPrompt = context ? `${context}\n\n${text}` : text;

            updateNodeData(node.id, {
              inputImage: firstFrame,
              inputPrompt: text,
              inputContext: context,
              referenceImages: refs,
              status: "loading",
              error: null
            });

            try {
              const { geminiApiKey, kieAiApiKey } = useSettingsStore.getState();
              const isKieAiModel = nodeData.model?.startsWith("kieai-");
              console.log("[Video] Model:", nodeData.model, "| Using Kie AI:", isKieAiModel);

              let response: Response;
              if (isKieAiModel) {
                // Use Kie AI API
                response = await fetch("/api/video-kieai", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(kieAiApiKey && { "x-kieai-api-key": kieAiApiKey }),
                  },
                  body: JSON.stringify({
                    prompt: fullPrompt,
                    model: nodeData.model,
                    image: firstFrame,
                    referenceImages: refs.length > 0 ? refs : undefined,
                    aspectRatio: nodeData.aspectRatio,
                    duration: nodeData.duration,
                  }),
                  signal: abortController.signal,
                });
              } else {
                // Use Google Veo API
                response = await fetch("/api/video", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(geminiApiKey && { "x-gemini-api-key": geminiApiKey }),
                  },
                  body: JSON.stringify({
                    prompt: fullPrompt,
                    model: nodeData.model,
                    image: firstFrame,
                    referenceImages: refs.length > 0 ? refs : undefined,
                    durationSeconds: nodeData.duration,
                    aspectRatio: nodeData.aspectRatio,
                    resolution: nodeData.resolution,
                  }),
                  signal: abortController.signal,
                });
              }

              const result = await response.json();
              if (result.success) {
                updateNodeData(node.id, {
                  outputVideo: result.video,
                  lastFrame: result.lastFrame,
                  status: "complete",
                  error: null,
                });
                // Add delay between video generations to avoid rate limiting
                console.log("[Video] Waiting 5s before next node...");
                await new Promise(resolve => setTimeout(resolve, 5000));
              } else {
                throw new Error(result.error);
              }
            } catch (error) {
              if (error instanceof Error && error.name === "AbortError") {
                updateNodeData(node.id, { status: "idle", error: null });
                set({ isRunning: false, currentNodeId: null, abortController: null });
                return;
              }
              updateNodeData(node.id, { status: "error", error: error instanceof Error ? error.message : "Video failed" });
              set({ isRunning: false, currentNodeId: null });
              return;
            }
            break;
          }

          case "elevenLabs": {
            const { text } = getConnectedInputs(node.id);
            if (!text) {
              updateNodeData(node.id, { status: "error", error: "Missing script input" });
      set({ isRunning: false, currentNodeId: null });
              return;
            }

            updateNodeData(node.id, { inputText: text, status: "loading", error: null });

            try {
              const nodeData = node.data as ElevenLabsNodeData;
              const { elevenLabsApiKey } = useSettingsStore.getState();
              const response = await fetch("/api/elevenlabs", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(elevenLabsApiKey && { "x-elevenlabs-api-key": elevenLabsApiKey }),
                },
                body: JSON.stringify({ text, voiceId: nodeData.voiceId }),
                signal: abortController.signal,
              });

              const result = await response.json();
              if (result.success) {
                updateNodeData(node.id, { outputAudio: result.audio, status: "complete", error: null });
              } else {
                throw new Error(result.error);
              }
            } catch (error) {
              if (error instanceof Error && error.name === "AbortError") {
                updateNodeData(node.id, { status: "idle", error: null });
                set({ isRunning: false, currentNodeId: null, abortController: null });
                return;
              }
              updateNodeData(node.id, { status: "error", error: error instanceof Error ? error.message : "Voice failed" });
      set({ isRunning: false, currentNodeId: null });
              return;
            }
            break;
          }

          case "syllableChunker": {
            const { text } = getConnectedInputs(node.id);
            if (!text) {
              updateNodeData(node.id, { status: "error", error: "Missing text input" });
              set({ isRunning: false, currentNodeId: null });
              return;
            }

            updateNodeData(node.id, { inputScript: text, status: "loading", error: null });

            try {
              const nodeData = node.data as SyllableChunkerNodeData;
              const chunks = chunkBySyllables(text, nodeData.targetSyllables, nodeData.chunkPrefix ?? "Dialogue: ");
              updateNodeData(node.id, {
                outputChunks: chunks,
                selectedChunkIndex: 0,
                status: "complete",
                error: null,
              });
            } catch (error) {
              updateNodeData(node.id, {
                status: "error",
                error: error instanceof Error ? error.message : "Chunking failed",
              });
              set({ isRunning: false, currentNodeId: null });
              return;
            }
            break;
          }

          case "caption": {
            const { video } = getConnectedInputs(node.id);
            if (!video) {
              updateNodeData(node.id, { status: "error", error: "No video input connected" });
              set({ isRunning: false, currentNodeId: null });
              return;
            }

            const captionData = node.data as CaptionNodeData;
            updateNodeData(node.id, { inputVideo: video, status: "loading", error: null });

            try {
              // Step 1: Transcribe the video
              console.log("[Caption] Transcribing video...");
              const { openaiApiKey } = useSettingsStore.getState();
              const transcribeResponse = await fetch("/api/transcribe", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(openaiApiKey && { "x-openai-api-key": openaiApiKey }),
                },
                body: JSON.stringify({ video }),
                signal: abortController.signal,
              });

              const transcribeResult = await transcribeResponse.json();
              if (!transcribeResult.success) {
                throw new Error(transcribeResult.error || "Transcription failed");
              }

              console.log(`[Caption] Transcribed ${transcribeResult.words.length} words`);
              updateNodeData(node.id, {
                transcription: transcribeResult.words,
                editedTranscript: transcribeResult.text,
              });

              // Step 2: Burn captions into video
              console.log("[Caption] Burning captions...");
              const burnResponse = await fetch("/api/caption-burn", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  video,
                  words: transcribeResult.words,
                  style: captionData.style,
                }),
                signal: abortController.signal,
              });

              const burnResult = await burnResponse.json();
              if (!burnResult.success) {
                throw new Error(burnResult.error || "Caption burning failed");
              }

              console.log("[Caption] Captions burned successfully");
              updateNodeData(node.id, {
                outputVideo: burnResult.video,
                status: "complete",
                error: null,
              });
            } catch (error) {
              if (error instanceof Error && error.name === "AbortError") {
                updateNodeData(node.id, { status: "idle", error: null });
                set({ isRunning: false, currentNodeId: null, abortController: null });
                return;
              }
              updateNodeData(node.id, {
                status: "error",
                error: error instanceof Error ? error.message : "Caption generation failed",
              });
              set({ isRunning: false, currentNodeId: null });
              return;
            }
            break;
          }

          case "videoStitch": {
            // Get all connected video nodes and their videos
            const currentNodes = get().nodes;
            const currentEdges = get().edges;
            const videoEdges = currentEdges.filter(
              (e) => e.target === node.id && e.targetHandle === "video"
            );

            if (videoEdges.length === 0) {
              updateNodeData(node.id, { status: "error", error: "No video nodes connected" });
              set({ isRunning: false, currentNodeId: null });
              return;
            }

            // Collect videos with their chunkIndex
            const videosToStitch: { video: string; chunkIndex: number }[] = [];

            for (const edge of videoEdges) {
              const sourceNode = currentNodes.find((n) => n.id === edge.source);
              if (sourceNode?.type === "videoGenerate") {
                const videoData = sourceNode.data as VideoGenerateNodeData;
                if (videoData.outputVideo) {
                  videosToStitch.push({
                    video: videoData.outputVideo,
                    chunkIndex: videoData.chunkIndex || 1,
                  });
                }
              }
            }

            if (videosToStitch.length === 0) {
              updateNodeData(node.id, { status: "error", error: "No videos ready to stitch" });
              set({ isRunning: false, currentNodeId: null });
              return;
            }

            updateNodeData(node.id, {
              inputVideos: videosToStitch.map((v) => ({ ...v, sourceNodeId: "" })),
              status: "loading",
              error: null,
            });

            try {
              const response = await fetch("/api/video-stitch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ videos: videosToStitch }),
                signal: abortController.signal,
              });

              const result = await response.json();
              if (result.success) {
                updateNodeData(node.id, { outputVideo: result.video, status: "complete", error: null });
              } else {
                throw new Error(result.error);
              }
            } catch (error) {
              if (error instanceof Error && error.name === "AbortError") {
                updateNodeData(node.id, { status: "idle", error: null });
                set({ isRunning: false, currentNodeId: null, abortController: null });
                return;
              }
              updateNodeData(node.id, { status: "error", error: error instanceof Error ? error.message : "Stitching failed" });
              set({ isRunning: false, currentNodeId: null });
              return;
            }
            break;
          }
        }
      }

      set({ isRunning: false, currentNodeId: null, abortController: null });
      // Autosave after successful workflow completion
      get().autoSave();
    } catch {
      set({ isRunning: false, currentNodeId: null, abortController: null });
    }
  },

  stopWorkflow: () => {
    const { isRunning, abortController } = get();
    if (isRunning && abortController) {
      abortController.abort();
    }
    set({ isRunning: false, currentNodeId: null, abortController: null });
  },

  regenerateNode: async (nodeId: string) => {
    const { nodes, edges, updateNodeData, getConnectedInputs, isRunning } = get();

    if (isRunning) {
      return;
    }

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) {
      return;
    }

    const abortController = new AbortController();
    set({ isRunning: true, currentNodeId: nodeId, abortController });

    try {
      if (node.type === "nanoBanana") {
        const nodeData = node.data as NanoBananaNodeData;

        // Always get fresh connected inputs first, fall back to stored inputs only if not connected
        const inputs = getConnectedInputs(nodeId);
        let images = inputs.images.length > 0 ? inputs.images : (nodeData.inputImages ?? []);
        let text = inputs.text ?? nodeData.inputPrompt;

        if (!text) {
          updateNodeData(nodeId, {
            status: "error",
            error: "Missing text input",
          });
          set({ isRunning: false, currentNodeId: null });
          return;
        }

        updateNodeData(nodeId, {
          status: "loading",
          error: null,
        });

        const { geminiApiKey } = useSettingsStore.getState();
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(geminiApiKey && { "x-gemini-api-key": geminiApiKey }),
          },
          body: JSON.stringify({
            images,
            prompt: text,
            aspectRatio: nodeData.aspectRatio,
            resolution: nodeData.resolution,
            model: nodeData.model,
            useGoogleSearch: nodeData.useGoogleSearch,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = `HTTP ${response.status}`;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error || errorMessage;
          } catch {
            if (errorText) errorMessage += ` - ${errorText.substring(0, 200)}`;
          }
          updateNodeData(nodeId, { status: "error", error: errorMessage });
          set({ isRunning: false, currentNodeId: null });
          return;
        }

        const result = await response.json();
        if (result.success && result.image) {
          // Save the newly generated image to global history
          get().addToGlobalHistory({
            image: result.image,
            timestamp: Date.now(),
            prompt: text,
            aspectRatio: nodeData.aspectRatio,
            model: nodeData.model,
          });
          updateNodeData(nodeId, {
            outputImage: result.image,
            status: "complete",
            error: null,
          });
        } else {
          updateNodeData(nodeId, {
            status: "error",
            error: result.error || "Generation failed",
          });
        }
      } else if (node.type === "llmGenerate") {
        const nodeData = node.data as LLMGenerateNodeData;

        // Always get fresh connected inputs first, fall back to stored inputs only if not connected
        const inputs = getConnectedInputs(nodeId);
        const text = inputs.text ?? nodeData.inputPrompt;
        const context = inputs.context ?? nodeData.inputContext;
        const images = inputs.images.length > 0 ? inputs.images : (nodeData.inputImages ?? []);

        if (!text && !context) {
          updateNodeData(nodeId, {
            status: "error",
            error: "Missing text or context input",
          });
          set({ isRunning: false, currentNodeId: null });
          return;
        }

        // Combine text (instruction) and context (content) if both present
        let combinedPrompt: string;
        if (text && context) {
          combinedPrompt = `${text}\n\n---\n\n${context}`;
        } else {
          combinedPrompt = text || context || "";
        }

        updateNodeData(nodeId, {
          inputPrompt: text,
          inputContext: context,
          inputImages: images,
          outputImages: images, // passthrough
          status: "loading",
          error: null,
        });

        const { geminiApiKey, openaiApiKey } = useSettingsStore.getState();
        const response = await fetch("/api/llm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(geminiApiKey && { "x-gemini-api-key": geminiApiKey }),
            ...(openaiApiKey && { "x-openai-api-key": openaiApiKey }),
          },
          body: JSON.stringify({
            prompt: combinedPrompt,
            images,
            provider: nodeData.provider,
            model: nodeData.model,
            temperature: nodeData.temperature,
            maxTokens: nodeData.maxTokens,
            useGoogleSearch: nodeData.useGoogleSearch ?? false,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = `HTTP ${response.status}`;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error || errorMessage;
          } catch {
            if (errorText) errorMessage += ` - ${errorText.substring(0, 200)}`;
          }
          updateNodeData(nodeId, { status: "error", error: errorMessage });
          set({ isRunning: false, currentNodeId: null });
          return;
        }

        const result = await response.json();
        if (result.success && result.text) {
          updateNodeData(nodeId, {
            outputText: result.text,
            status: "complete",
            error: null,
          });
        } else {
          updateNodeData(nodeId, {
            status: "error",
            error: result.error || "LLM generation failed",
          });
        }
      } else if (node.type === "videoGenerate") {
        const nodeData = node.data as VideoGenerateNodeData;
        const inputs = getConnectedInputs(nodeId);
        const image = inputs.images[0] ?? nodeData.inputImage;
        const refs = inputs.referenceImages.slice(0, 3); // Up to 3 reference images
        const context = inputs.context ?? nodeData.inputContext;

        // Get text input - check if connected to a syllable chunker for chunk selection
        let text: string | null = null;
        const textEdge = edges.find(e => e.target === nodeId && e.targetHandle === "text");
        if (textEdge) {
          const sourceNode = nodes.find(n => n.id === textEdge.source);
          if (sourceNode?.type === "syllableChunker") {
            // Use the video node's chunkIndex to select which chunk
            const chunkerData = sourceNode.data as SyllableChunkerNodeData;
            const chunks = chunkerData.outputChunks || [];
            const idx = Math.max(0, Math.min(nodeData.chunkIndex - 1, chunks.length - 1));
            text = chunks[idx] || null;
            console.log(`[Video Regenerate] Using chunk ${nodeData.chunkIndex} of ${chunks.length}`);
            console.log(`[Video Regenerate] Chunk text: "${text?.substring(0, 80)}..."`);
          } else {
            text = inputs.text;
          }
        } else {
          text = inputs.text ?? nodeData.inputPrompt;
        }

        if (!image || !text) {
          updateNodeData(nodeId, { status: "error", error: "Missing image or prompt input" });
          set({ isRunning: false, currentNodeId: null });
          return;
        }

        // Combine prompt and context if context is provided
        const fullPrompt = context ? `${context}\n\n${text}` : text;

        updateNodeData(nodeId, { status: "loading", error: null, inputContext: context, referenceImages: refs });

        const { geminiApiKey, kieAiApiKey } = useSettingsStore.getState();
        const isKieAiModel = nodeData.model?.startsWith("kieai-");
        console.log("[Video Regenerate] Model:", nodeData.model, "| Using Kie AI:", isKieAiModel);
        console.log("[Video Regenerate] Prompt:", fullPrompt?.substring(0, 100), "| Image:", image ? "present" : "MISSING");

        let response: Response;
        if (isKieAiModel) {
          // Use Kie AI API
          console.log("[Video Regenerate] Making Kie AI request...");
          response = await fetch("/api/video-kieai", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(kieAiApiKey && { "x-kieai-api-key": kieAiApiKey }),
            },
            body: JSON.stringify({
              prompt: fullPrompt,
              model: nodeData.model,
              image,
              referenceImages: refs.length > 0 ? refs : undefined,
              aspectRatio: nodeData.aspectRatio,
              duration: nodeData.duration,
            }),
            signal: abortController.signal,
          });
        } else {
          // Use Google Veo API
          response = await fetch("/api/video", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(geminiApiKey && { "x-gemini-api-key": geminiApiKey }),
            },
            body: JSON.stringify({
              prompt: fullPrompt,
              model: nodeData.model,
              image,
              referenceImages: refs.length > 0 ? refs : undefined,
              durationSeconds: nodeData.duration,
              aspectRatio: nodeData.aspectRatio,
              resolution: nodeData.resolution,
            }),
            signal: abortController.signal,
          });
        }

        const result = await response.json();
        if (result.success) {
          updateNodeData(nodeId, {
            outputVideo: result.video,
            lastFrame: result.lastFrame,
            status: "complete",
            error: null,
          });
        } else {
          throw new Error(result.error);
        }
      } else if (node.type === "elevenLabs") {
        const nodeData = node.data as ElevenLabsNodeData;
        const inputs = getConnectedInputs(nodeId);
        const text = inputs.text ?? nodeData.inputText;

        if (!text) {
          updateNodeData(nodeId, { status: "error", error: "Missing script input" });
      set({ isRunning: false, currentNodeId: null });
          return;
        }

        updateNodeData(nodeId, { status: "loading", error: null });

        const { elevenLabsApiKey } = useSettingsStore.getState();
        const response = await fetch("/api/elevenlabs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(elevenLabsApiKey && { "x-elevenlabs-api-key": elevenLabsApiKey }),
          },
          body: JSON.stringify({ text, voiceId: nodeData.voiceId }),
          signal: abortController.signal,
        });

        const result = await response.json();
        if (result.success) {
          updateNodeData(nodeId, { outputAudio: result.audio, status: "complete", error: null });
        } else {
          throw new Error(result.error);
        }
      } else if (node.type === "syllableChunker") {
        const nodeData = node.data as SyllableChunkerNodeData;
        const inputs = getConnectedInputs(nodeId);
        const text = inputs.text ?? nodeData.inputScript;

        if (!text) {
          updateNodeData(nodeId, { status: "error", error: "Missing text input" });
          set({ isRunning: false, currentNodeId: null });
          return;
        }

        updateNodeData(nodeId, { inputScript: text, status: "loading", error: null });

        try {
          const chunks = chunkBySyllables(text, nodeData.targetSyllables, nodeData.chunkPrefix ?? "Dialogue: ");
          updateNodeData(nodeId, {
            outputChunks: chunks,
            selectedChunkIndex: 0,
            status: "complete",
            error: null,
          });
        } catch (error) {
          updateNodeData(nodeId, {
            status: "error",
            error: error instanceof Error ? error.message : "Chunking failed",
          });
        }
      } else if (node.type === "videoStitch") {
        const stitchData = node.data as VideoStitchNodeData;
        const iterationCount = stitchData.iterationCount || 1;
        const outputFolder = stitchData.outputFolder;

        // Get all connected video nodes
        const currentEdges = get().edges;
        const videoEdges = currentEdges.filter(
          (e) => e.target === nodeId && e.targetHandle === "video"
        );

        if (videoEdges.length === 0) {
          updateNodeData(nodeId, { status: "error", error: "No video nodes connected" });
          set({ isRunning: false, currentNodeId: null });
          return;
        }

        // Get the connected video node IDs
        const videoNodeIds = videoEdges.map(e => e.source);

        updateNodeData(nodeId, { status: "loading", error: null, currentIteration: 0 });

        const { geminiApiKey, kieAiApiKey } = useSettingsStore.getState();

        // Run iterations
        for (let iteration = 1; iteration <= iterationCount; iteration++) {
          console.log(`[Video Stitch] Starting iteration ${iteration}/${iterationCount}`);
          updateNodeData(nodeId, { currentIteration: iteration });

          // IMPORTANT: Clear old outputVideo and lastFrame from ALL connected video nodes
          // This prevents stale frames from previous runs bleeding into new generations
          // Note: We do NOT clear inputImage as that's the user's intended input, not cached output
          for (const videoNodeId of videoNodeIds) {
            updateNodeData(videoNodeId, {
              outputVideo: null,
              lastFrame: null,
            });
          }
          console.log(`[Video Stitch] Cleared previous outputs from ${videoNodeIds.length} video nodes`);

          // Regenerate all connected video nodes
          for (const videoNodeId of videoNodeIds) {
            const currentNodes = get().nodes;
            const videoNode = currentNodes.find(n => n.id === videoNodeId);
            if (!videoNode || videoNode.type !== "videoGenerate") continue;

            const videoData = videoNode.data as VideoGenerateNodeData;
            const videoInputs = getConnectedInputs(videoNodeId);
            const image = videoInputs.images[0] ?? videoData.inputImage;
            const refs = videoInputs.referenceImages.slice(0, 3); // Get reference images from dedicated handle
            const context = videoInputs.context ?? videoData.inputContext;

            // Get text input - check if connected to a syllable chunker
            let text: string | null = null;
            const textEdge = edges.find(e => e.target === videoNodeId && e.targetHandle === "text");
            if (textEdge) {
              const sourceNode = currentNodes.find(n => n.id === textEdge.source);
              if (sourceNode?.type === "syllableChunker") {
                const chunkerData = sourceNode.data as SyllableChunkerNodeData;
                const chunks = chunkerData.outputChunks || [];
                const idx = Math.max(0, Math.min(videoData.chunkIndex - 1, chunks.length - 1));
                text = chunks[idx] || null;
              } else {
                text = videoInputs.text;
              }
            } else {
              text = videoInputs.text ?? videoData.inputPrompt;
            }

            if (!image || !text) {
              console.log(`[Video Stitch] Skipping video node ${videoNodeId} - missing image or text`);
              continue;
            }

            const fullPrompt = context ? `${context}\n\n${text}` : text;

            // Set current node to video node so it shows as running on canvas
            set({ currentNodeId: videoNodeId });
            updateNodeData(videoNodeId, { status: "loading", error: null, referenceImages: refs });

            try {
              const isKieAiModel = videoData.model?.startsWith("kieai-");
              let response: Response;

              if (isKieAiModel) {
                response = await fetch("/api/video-kieai", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(kieAiApiKey && { "x-kieai-api-key": kieAiApiKey }),
                  },
                  body: JSON.stringify({
                    prompt: fullPrompt,
                    model: videoData.model,
                    image,
                    referenceImages: refs.length > 0 ? refs : undefined,
                    aspectRatio: videoData.aspectRatio,
                    duration: videoData.duration,
                  }),
                  signal: abortController.signal,
                });
              } else {
                response = await fetch("/api/video", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(geminiApiKey && { "x-gemini-api-key": geminiApiKey }),
                  },
                  body: JSON.stringify({
                    prompt: fullPrompt,
                    model: videoData.model,
                    image,
                    referenceImages: refs.length > 0 ? refs : undefined,
                    durationSeconds: videoData.duration,
                    aspectRatio: videoData.aspectRatio,
                    resolution: videoData.resolution,
                  }),
                  signal: abortController.signal,
                });
              }

              const result = await response.json();
              if (result.success) {
                updateNodeData(videoNodeId, {
                  outputVideo: result.video,
                  lastFrame: result.lastFrame,
                  status: "complete",
                  error: null,
                });
                console.log(`[Video Stitch] Video node ${videoNodeId} completed for iteration ${iteration}`);
              } else {
                throw new Error(result.error);
              }
            } catch (error) {
              if (error instanceof Error && error.name === "AbortError") {
                updateNodeData(videoNodeId, { status: "idle", error: null });
                updateNodeData(nodeId, { status: "idle", error: null, currentIteration: 0 });
                set({ isRunning: false, currentNodeId: null, abortController: null });
                return;
              }
              updateNodeData(videoNodeId, {
                status: "error",
                error: error instanceof Error ? error.message : "Video generation failed",
              });
              // Continue with other videos even if one fails
            }
          }

          // Collect videos for stitching
          const updatedNodes = get().nodes;
          const videosToStitch: { video: string; chunkIndex: number }[] = [];

          for (const edge of videoEdges) {
            const sourceNode = updatedNodes.find((n) => n.id === edge.source);
            if (sourceNode?.type === "videoGenerate") {
              const videoData = sourceNode.data as VideoGenerateNodeData;
              if (videoData.outputVideo) {
                videosToStitch.push({
                  video: videoData.outputVideo,
                  chunkIndex: videoData.chunkIndex || 1,
                });
              }
            }
          }

          if (videosToStitch.length === 0) {
            console.log(`[Video Stitch] No videos ready for iteration ${iteration}, skipping`);
            continue;
          }

          // Set current node back to stitch node for stitching phase
          set({ currentNodeId: nodeId });
          updateNodeData(nodeId, { status: "loading" });

          // Stitch videos
          console.log(`[Video Stitch] Stitching ${videosToStitch.length} videos for iteration ${iteration}`);
          const stitchResponse = await fetch("/api/video-stitch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videos: videosToStitch }),
            signal: abortController.signal,
          });

          const stitchResult = await stitchResponse.json();
          if (!stitchResult.success) {
            throw new Error(stitchResult.error);
          }

          const stitchedVideo = stitchResult.video;

          // Save to folder or set as output
          if (outputFolder) {
            const filename = `stitched_iter${iteration}_${new Date().toISOString().replace(/[:.]/g, "-")}.mp4`;
            const saveResponse = await fetch("/api/save-video", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                video: stitchedVideo,
                folder: outputFolder,
                filename,
              }),
            });

            const saveResult = await saveResponse.json();
            if (saveResult.success) {
              console.log(`[Video Stitch] Saved iteration ${iteration} to: ${saveResult.path}`);
            } else {
              console.error(`[Video Stitch] Failed to save iteration ${iteration}: ${saveResult.error}`);
            }
          }

          // Update output video with the latest iteration
          updateNodeData(nodeId, {
            inputVideos: videosToStitch.map((v) => ({ ...v, sourceNodeId: "" })),
            outputVideo: stitchedVideo,
          });
        }

        // Mark as complete
        updateNodeData(nodeId, { status: "complete", error: null, currentIteration: 0 });
        console.log(`[Video Stitch] All ${iterationCount} iterations complete`);
      }

      set({ isRunning: false, currentNodeId: null, abortController: null });
      // Autosave after successful regeneration
      get().autoSave();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        updateNodeData(nodeId, {
          status: "idle",
          error: null,
        });
      } else {
      updateNodeData(nodeId, {
        status: "error",
        error: error instanceof Error ? error.message : "Regeneration failed",
      });
      }
      set({ isRunning: false, currentNodeId: null, abortController: null });
    }
  },

  saveWorkflow: (name?: string) => {
    const { nodes, edges, edgeStyle } = get();

    const workflow: WorkflowFile = {
      version: 1,
      name: name || `workflow-${new Date().toISOString().slice(0, 10)}`,
      nodes,
      edges,
      edgeStyle,
    };

    const json = JSON.stringify(workflow, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${workflow.name}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  saveToProjectDirectory: async () => {
    const { nodes, edges, edgeStyle, saveDirectoryPath, workflowName, currentWorkflowId } = get();

    if (!saveDirectoryPath) {
      return { success: false, error: "No project directory set" };
    }

    const name = workflowName || "workflow";
    const workflow: WorkflowFile = {
      version: 1,
      id: currentWorkflowId || `wf_${Date.now()}`,
      name,
      nodes,
      edges,
      edgeStyle,
    };

    try {
      const response = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directoryPath: saveDirectoryPath,
          filename: name,
          workflow,
        }),
      });

      const result = await response.json();
      if (result.success) {
        return { success: true, filePath: result.filePath };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  },

  loadWorkflow: (workflow: WorkflowFile) => {
      recordHistory();
    // Update nodeIdCounter to avoid ID collisions
    const maxId = workflow.nodes.reduce((max, node) => {
      const match = node.id.match(/-(\d+)$/);
      if (match) {
        return Math.max(max, parseInt(match[1], 10));
      }
      return max;
    }, 0);
    nodeIdCounter = maxId;

    set({
      nodes: workflow.nodes,
      edges: workflow.edges,
      edgeStyle: workflow.edgeStyle || "angular",
      isRunning: false,
      currentNodeId: null,
    });
  },

  clearWorkflow: () => {
      recordHistory();
    set({
      nodes: [],
      edges: [],
      isRunning: false,
      currentNodeId: null,
    });
  },

  resetIncurredCost: () => {
    // Cost tracking is stored in localStorage per workflow
    const workflowId = get().currentWorkflowId;
    if (workflowId) {
      const costsKey = "nodemango-workflow-costs";
      try {
        const costs = JSON.parse(localStorage.getItem(costsKey) || "{}");
        costs[workflowId] = 0;
        localStorage.setItem(costsKey, JSON.stringify(costs));
      } catch {
        // Ignore localStorage errors
      }
    }
  },

  // Groups - stub implementations (feature not fully implemented)
  createGroup: (nodeIds: string[], name?: string) => {
    const groupId = `group-${Date.now()}`;
    const newGroup: GroupData = {
      name: name || "Group",
      color: "neutral",
      position: { x: 0, y: 0 },
      size: { width: 300, height: 200 },
      locked: false,
      nodeIds,
    };
    set((state) => ({
      groups: { ...state.groups, [groupId]: newGroup },
    }));
    return groupId;
  },

  updateGroup: (groupId: string, updates: Partial<GroupData>) => {
    set((state) => ({
      groups: {
        ...state.groups,
        [groupId]: { ...state.groups[groupId], ...updates },
      },
    }));
  },

  deleteGroup: (groupId: string) => {
    set((state) => {
      const { [groupId]: _, ...rest } = state.groups;
      return { groups: rest };
    });
  },

  moveGroupNodes: () => {
    // Stub - would move all nodes in a group by delta
  },

  toggleGroupLock: (groupId: string) => {
    set((state) => ({
      groups: {
        ...state.groups,
        [groupId]: { ...state.groups[groupId], locked: !state.groups[groupId]?.locked },
      },
    }));
  },

  removeNodesFromGroup: () => {
    // Stub - would remove nodes from their groups
  },

  addToGlobalHistory: (item: Omit<ImageHistoryItem, "id">) => {
    const newItem: ImageHistoryItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    set((state) => ({
      globalImageHistory: [newItem, ...state.globalImageHistory],
    }));
  },

  clearGlobalHistory: () => {
    set({ globalImageHistory: [] });
  },

  // Manual autosave - call this after workflow finishes
  autoSave: () => {
    const state = get();
    const { currentWorkflowId, workflowList, nodes, edges, edgeStyle, globalImageHistory } = state;

    // Save current workflow to multi-workflow store
    if (currentWorkflowId) {
      const meta = workflowList.find((w) => w.id === currentWorkflowId);
      if (meta) {
        const now = Date.now();
        saveWorkflowToIDB({
          id: currentWorkflowId,
          name: meta.name,
          createdAt: meta.createdAt,
          updatedAt: now,
          nodes,
          edges,
          edgeStyle,
        });
        // Update updatedAt in list
        set({
          workflowList: workflowList.map((w) =>
            w.id === currentWorkflowId ? { ...w, updatedAt: now } : w
          ),
        });
      }
    }

    // Also save global image history
    saveMetaToIDB("globalImageHistory", globalImageHistory);

    // Legacy save for backward compatibility
    saveToIndexedDB({
      nodes,
      edges,
      edgeStyle,
      globalImageHistory,
    });
  },
};
});

// Load saved state on app startup
if (typeof window !== "undefined") {
  // Use the new multi-workflow loading
  useWorkflowStore.getState().loadWorkflowList();

  // Save on page unload
  window.addEventListener("beforeunload", () => {
    const state = useWorkflowStore.getState();
    const { currentWorkflowId, workflowList, nodes, edges, edgeStyle, globalImageHistory } = state;

    // Save current workflow to multi-workflow store (best effort sync)
    if (currentWorkflowId) {
      const meta = workflowList.find((w) => w.id === currentWorkflowId);
      if (meta) {
        const now = Date.now();
        const workflowData: StoredWorkflow = {
          id: currentWorkflowId,
          name: meta.name,
          createdAt: meta.createdAt,
          updatedAt: now,
          nodes,
          edges,
          edgeStyle,
        };

        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction([WORKFLOWS_STORE, META_STORE], "readwrite");
          transaction.objectStore(WORKFLOWS_STORE).put(workflowData);
          transaction.objectStore(META_STORE).put(globalImageHistory, "globalImageHistory");
        };
      }
    }

    // Legacy save for backward compatibility - save as object directly
    const legacyData = {
      state: {
        nodes,
        edges,
        edgeStyle,
        globalImageHistory,
      },
    };
    const legacyRequest = indexedDB.open(DB_NAME, DB_VERSION);
    legacyRequest.onsuccess = () => {
      const transaction = legacyRequest.result.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      store.put(legacyData, STATE_KEY);
    };
  });
}
