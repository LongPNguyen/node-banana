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
  AnnotationNodeData,
  PromptNodeData,
  NanoBananaNodeData,
  LLMGenerateNodeData,
  OutputNodeData,
  VideoGenerateNodeData,
  ElevenLabsNodeData,
  WorkflowNodeData,
  ImageHistoryItem,
  WorkflowMetadata,
} from "@/types";
import { useToast } from "@/components/Toast";
import { useSettingsStore } from "@/store/settingsStore";

export type EdgeStyle = "angular" | "curved";

// Workflow file format
export interface WorkflowFile {
  version: 1;
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
  workflowList: WorkflowMetadata[];
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
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
  loadWorkflow: (workflow: WorkflowFile) => void;
  clearWorkflow: () => void;

  // Helpers
  getNodeById: (id: string) => WorkflowNode | undefined;
  getConnectedInputs: (nodeId: string) => {
    images: string[];
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
      } as OutputNodeData;
    case "videoGenerate":
      return {
        inputImage: null,
        inputPrompt: null,
        outputVideo: null,
        lastFrame: null,
        duration: 4,
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
  }
};

let nodeIdCounter = 0;

const HISTORY_LIMIT = 100;

// IndexedDB helper for multi-workflow storage
const DB_NAME = "node-banana-db";
const DB_VERSION = 2; // Upgraded for multi-workflow support
const STORE_NAME = "states"; // Legacy store
const WORKFLOWS_STORE = "workflows"; // New: individual workflow data
const META_STORE = "meta"; // New: app-level metadata
const STATE_KEY = "node-banana-workflow"; // Legacy key

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
      localStorage.removeItem("node-banana-workflow");
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
const generateWorkflowId = () => `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
  workflowList: [],
  sidebarOpen: false,

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
        abortController: null,
  globalImageHistory: [],

  // Multi-workflow methods
  setSidebarOpen: (open: boolean) => {
    set({ sidebarOpen: open });
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
      annotation: { width: 300, height: 280 },
      prompt: { width: 320, height: 220 },
      nanoBanana: { width: 300, height: 300 },
      llmGenerate: { width: 320, height: 360 },
      output: { width: 320, height: 320 },
      videoGenerate: { width: 320, height: 380 },
      elevenLabs: { width: 300, height: 200 },
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
    let text: string | null = null;
    let context: string | null = null;
    let video: string | null = null;
    let audio: string | null = null;

    edges
      .filter((edge) => edge.target === nodeId)
      .forEach((edge) => {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        if (!sourceNode) return;

        const handleId = edge.targetHandle;

        if (handleId === "image" || !handleId) {
          // Get image from source node - collect all connected images
          if (sourceNode.type === "imageInput") {
            const sourceImage = (sourceNode.data as ImageInputNodeData).image;
            if (sourceImage) images.push(sourceImage);
          } else if (sourceNode.type === "annotation") {
            const sourceImage = (sourceNode.data as AnnotationNodeData).outputImage;
            if (sourceImage) images.push(sourceImage);
          } else if (sourceNode.type === "nanoBanana") {
            const sourceImage = (sourceNode.data as NanoBananaNodeData).outputImage;
            if (sourceImage) images.push(sourceImage);
          } else if (sourceNode.type === "llmGenerate") {
            const sourceImages = (sourceNode.data as LLMGenerateNodeData).outputImages;
            if (sourceImages && sourceImages.length > 0) images.push(...sourceImages);
          } else if (sourceNode.type === "videoGenerate") {
            // Passthrough last frame for chaining
            const sourceImage = (sourceNode.data as VideoGenerateNodeData).lastFrame;
            if (sourceImage) images.push(sourceImage);
          }
        }

        if (handleId === "text") {
          if (sourceNode.type === "prompt") {
            text = (sourceNode.data as PromptNodeData).prompt;
          } else if (sourceNode.type === "llmGenerate") {
            text = (sourceNode.data as LLMGenerateNodeData).outputText;
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
          }
        }

        if (handleId === "audio") {
          if (sourceNode.type === "elevenLabs") {
            audio = (sourceNode.data as ElevenLabsNodeData).outputAudio;
          }
        }
      });

    return { images, text, context, video, audio };
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
            const { images, video, audio } = getConnectedInputs(node.id);
            if (images.length > 0) updateNodeData(node.id, { image: images[0] });
            // Add video/audio output support here if needed
            break;
          }

          case "videoGenerate": {
            const { images, text } = getConnectedInputs(node.id);
            const image = images[0];

            if (!image || !text) {
              updateNodeData(node.id, { status: "error", error: "Missing image or prompt input" });
              set({ isRunning: false, currentNodeId: null });
              return;
            }

            updateNodeData(node.id, { inputImage: image, inputPrompt: text, status: "loading", error: null });

            try {
              const nodeData = node.data as VideoGenerateNodeData;
              const { replicateApiKey } = useSettingsStore.getState();
              const response = await fetch("/api/video", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(replicateApiKey && { "x-replicate-api-key": replicateApiKey }),
                },
                body: JSON.stringify({ prompt: text, image, duration: nodeData.duration }),
                signal: abortController.signal,
              });

              const result = await response.json();
              if (result.success) {
                updateNodeData(node.id, {
                  outputVideo: result.video,
                  lastFrame: result.lastFrame,
                  status: "complete",
                  error: null,
                });
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
    const { nodes, updateNodeData, getConnectedInputs, isRunning } = get();

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
        const text = inputs.text ?? nodeData.inputPrompt;
        const image = inputs.images[0] ?? nodeData.inputImage;

        if (!image || !text) {
          updateNodeData(nodeId, { status: "error", error: "Missing image or prompt input" });
          set({ isRunning: false, currentNodeId: null });
          return;
        }

        updateNodeData(nodeId, { status: "loading", error: null });

        const { replicateApiKey } = useSettingsStore.getState();
        const response = await fetch("/api/video", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(replicateApiKey && { "x-replicate-api-key": replicateApiKey }),
          },
          body: JSON.stringify({ prompt: text, image, duration: nodeData.duration }),
          signal: abortController.signal,
        });

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
