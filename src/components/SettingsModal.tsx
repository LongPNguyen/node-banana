"use client";

import { useState, useCallback, useEffect } from "react";
import { useSettingsStore } from "@/store/settingsStore";

export function SettingsModal() {
  const {
    isSettingsOpen,
    setSettingsOpen,
    geminiApiKey,
    openaiApiKey,
    elevenLabsApiKey,
    replicateApiKey,
    kieAiApiKey,
    setGeminiApiKey,
    setOpenaiApiKey,
    setElevenLabsApiKey,
    setReplicateApiKey,
    setKieAiApiKey,
  } = useSettingsStore();

  // Local state for editing
  const [localGemini, setLocalGemini] = useState(geminiApiKey);
  const [localOpenai, setLocalOpenai] = useState(openaiApiKey);
  const [localElevenlabs, setLocalElevenlabs] = useState(elevenLabsApiKey);
  const [localReplicate, setLocalReplicate] = useState(replicateApiKey);
  const [localKieAi, setLocalKieAi] = useState(kieAiApiKey);

  // Visibility toggles
  const [showGemini, setShowGemini] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);
  const [showElevenlabs, setShowElevenlabs] = useState(false);
  const [showReplicate, setShowReplicate] = useState(false);
  const [showKieAi, setShowKieAi] = useState(false);

  // Sync local state when modal opens
  useEffect(() => {
    if (isSettingsOpen) {
      setLocalGemini(geminiApiKey);
      setLocalOpenai(openaiApiKey);
      setLocalElevenlabs(elevenLabsApiKey);
      setLocalReplicate(replicateApiKey);
      setLocalKieAi(kieAiApiKey);
    }
  }, [isSettingsOpen, geminiApiKey, openaiApiKey, elevenLabsApiKey, replicateApiKey, kieAiApiKey]);

  const handleSave = useCallback(() => {
    setGeminiApiKey(localGemini.trim());
    setOpenaiApiKey(localOpenai.trim());
    setElevenLabsApiKey(localElevenlabs.trim());
    setReplicateApiKey(localReplicate.trim());
    setKieAiApiKey(localKieAi.trim());
    setSettingsOpen(false);
  }, [localGemini, localOpenai, localElevenlabs, localReplicate, localKieAi, setGeminiApiKey, setOpenaiApiKey, setElevenLabsApiKey, setReplicateApiKey, setKieAiApiKey, setSettingsOpen]);

  const handleClose = useCallback(() => {
    setSettingsOpen(false);
  }, [setSettingsOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSettingsOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSettingsOpen, handleClose]);

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <h2 className="text-lg font-semibold text-neutral-100">Settings</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-neutral-800 rounded transition-colors text-neutral-400 hover:text-neutral-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <p className="text-sm text-neutral-400">
            Enter your API keys below. Keys are stored locally in your browser.
          </p>

          {/* Gemini API Key */}
          <ApiKeyInput
            label="Google Gemini API Key"
            value={localGemini}
            onChange={setLocalGemini}
            show={showGemini}
            onToggleShow={() => setShowGemini(!showGemini)}
            placeholder="AIza..."
            hasKey={!!geminiApiKey}
          />

          {/* OpenAI API Key */}
          <ApiKeyInput
            label="OpenAI API Key"
            value={localOpenai}
            onChange={setLocalOpenai}
            show={showOpenai}
            onToggleShow={() => setShowOpenai(!showOpenai)}
            placeholder="sk-..."
            hasKey={!!openaiApiKey}
          />

          {/* ElevenLabs API Key */}
          <ApiKeyInput
            label="ElevenLabs API Key"
            value={localElevenlabs}
            onChange={setLocalElevenlabs}
            show={showElevenlabs}
            onToggleShow={() => setShowElevenlabs(!showElevenlabs)}
            placeholder="xi-..."
            hasKey={!!elevenLabsApiKey}
          />

          {/* Replicate API Key */}
          <ApiKeyInput
            label="Replicate API Key"
            value={localReplicate}
            onChange={setLocalReplicate}
            show={showReplicate}
            onToggleShow={() => setShowReplicate(!showReplicate)}
            placeholder="r8_..."
            hasKey={!!replicateApiKey}
          />

          {/* Kie AI API Key */}
          <ApiKeyInput
            label="Kie AI API Key (Video)"
            value={localKieAi}
            onChange={setLocalKieAi}
            show={showKieAi}
            onToggleShow={() => setShowKieAi(!showKieAi)}
            placeholder="kie_..."
            hasKey={!!kieAiApiKey}
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-neutral-800 bg-neutral-900/50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-green-600 hover:bg-green-500 text-white rounded transition-colors font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

interface ApiKeyInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggleShow: () => void;
  placeholder: string;
  hasKey: boolean;
}

function ApiKeyInput({ label, value, onChange, show, onToggleShow, placeholder, hasKey }: ApiKeyInputProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-neutral-200">{label}</label>
        {hasKey && (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Configured
          </span>
        )}
      </div>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-10 text-sm bg-neutral-800 border border-neutral-700 rounded focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 text-neutral-100 placeholder-neutral-500"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-200 transition-colors"
          title={show ? "Hide" : "Show"}
        >
          {show ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
