import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsStore {
  // API Keys
  geminiApiKey: string;
  openaiApiKey: string;
  elevenLabsApiKey: string;
  replicateApiKey: string;
  kieAiApiKey: string;

  // Setters
  setGeminiApiKey: (key: string) => void;
  setOpenaiApiKey: (key: string) => void;
  setElevenLabsApiKey: (key: string) => void;
  setReplicateApiKey: (key: string) => void;
  setKieAiApiKey: (key: string) => void;

  // Settings modal
  isSettingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;

  // Helper to get API key for a provider
  getApiKey: (provider: "gemini" | "openai" | "elevenlabs" | "replicate" | "kieai") => string;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      // Initial state - empty strings
      geminiApiKey: "",
      openaiApiKey: "",
      elevenLabsApiKey: "",
      replicateApiKey: "",
      kieAiApiKey: "",

      // Setters
      setGeminiApiKey: (key: string) => set({ geminiApiKey: key }),
      setOpenaiApiKey: (key: string) => set({ openaiApiKey: key }),
      setElevenLabsApiKey: (key: string) => set({ elevenLabsApiKey: key }),
      setReplicateApiKey: (key: string) => set({ replicateApiKey: key }),
      setKieAiApiKey: (key: string) => set({ kieAiApiKey: key }),

      // Settings modal state
      isSettingsOpen: false,
      setSettingsOpen: (open: boolean) => set({ isSettingsOpen: open }),

      // Helper to get API key for a provider
      getApiKey: (provider: "gemini" | "openai" | "elevenlabs" | "replicate" | "kieai") => {
        const state = get();
        switch (provider) {
          case "gemini":
            return state.geminiApiKey;
          case "openai":
            return state.openaiApiKey;
          case "elevenlabs":
            return state.elevenLabsApiKey;
          case "replicate":
            return state.replicateApiKey;
          case "kieai":
            return state.kieAiApiKey;
          default:
            return "";
        }
      },
    }),
    {
      name: "nodemango-settings",
      // Only persist the API keys, not the modal state
      partialize: (state) => ({
        geminiApiKey: state.geminiApiKey,
        openaiApiKey: state.openaiApiKey,
        elevenLabsApiKey: state.elevenLabsApiKey,
        replicateApiKey: state.replicateApiKey,
        kieAiApiKey: state.kieAiApiKey,
      }),
    }
  )
);
