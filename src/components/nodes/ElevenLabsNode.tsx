"use client";

import { useCallback, memo, useRef, useEffect, useState } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { ExecuteButton } from "./ExecuteButton";
import { useWorkflowStore } from "@/store/workflowStore";
import { useSettingsStore } from "@/store/settingsStore";
import { ElevenLabsNodeData } from "@/types";

type ElevenLabsNodeType = Node<ElevenLabsNodeData, "elevenLabs">;

interface Voice {
  id: string;
  name: string;
  previewUrl: string | null;
  category: string;
  accent: string | null;
  description: string | null;
  gender: string | null;
  age: string | null;
}

// Fallback voices if API fails
const FALLBACK_VOICES: Voice[] = [
  { id: "pNInz6obpg8nEByWQX7X", name: "Adam", previewUrl: null, category: "premade", accent: "american", description: "deep", gender: "male", age: "middle aged" },
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", previewUrl: null, category: "premade", accent: "american", description: "calm", gender: "female", age: "young" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", previewUrl: null, category: "premade", accent: "american", description: "soft", gender: "female", age: "young" },
  { id: "VR6AewMgYgzn73nuRIBy", name: "Josh", previewUrl: null, category: "premade", accent: "american", description: "deep", gender: "male", age: "young" },
];

export const ElevenLabsNode = memo(({ id, data, selected }: NodeProps<ElevenLabsNodeType>) => {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);

  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const [voices, setVoices] = useState<Voice[]>(FALLBACK_VOICES);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // Fetch voices from ElevenLabs API
  useEffect(() => {
    if (voicesLoaded) return;

    const fetchVoices = async () => {
      setIsLoadingVoices(true);
      try {
        const { elevenLabsApiKey } = useSettingsStore.getState();
        const response = await fetch("/api/elevenlabs-voices", {
          method: "GET",
          headers: {
            ...(elevenLabsApiKey && { "x-elevenlabs-api-key": elevenLabsApiKey }),
          },
        });

        const result = await response.json();
        if (result.success && result.voices?.length > 0) {
          setVoices(result.voices);
          // If current voiceId is not in list, select first voice
          if (!result.voices.some((v: Voice) => v.id === nodeData.voiceId)) {
            updateNodeData(id, { voiceId: result.voices[0].id });
          }
        }
      } catch (error) {
        console.error("[ElevenLabs] Failed to fetch voices:", error);
      } finally {
        setIsLoadingVoices(false);
        setVoicesLoaded(true);
      }
    };

    fetchVoices();
  }, [id, nodeData.voiceId, updateNodeData, voicesLoaded]);

  const handleVoiceChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { voiceId: e.target.value });
    },
    [id, updateNodeData]
  );

  const handlePreview = useCallback(() => {
    const currentVoice = voices.find(v => v.id === nodeData.voiceId);
    if (!currentVoice?.previewUrl) return;

    if (previewAudioRef.current) {
      if (isPreviewPlaying) {
        previewAudioRef.current.pause();
        previewAudioRef.current.currentTime = 0;
        setIsPreviewPlaying(false);
      } else {
        previewAudioRef.current.src = currentVoice.previewUrl;
        previewAudioRef.current.play();
        setIsPreviewPlaying(true);
      }
    }
  }, [voices, nodeData.voiceId, isPreviewPlaying]);

  const handleRegenerate = useCallback(() => {
    regenerateNode(id);
  }, [id, regenerateNode]);

  const handleClear = useCallback(() => {
    updateNodeData(id, { outputAudio: null, status: "idle", error: null });
  }, [id, updateNodeData]);

  const currentVoice = voices.find(v => v.id === nodeData.voiceId);
  const hasPreview = !!currentVoice?.previewUrl;

  // Group voices by category
  const groupedVoices = voices.reduce((acc, voice) => {
    const category = voice.category || "other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(voice);
    return acc;
  }, {} as Record<string, Voice[]>);

  const categoryLabels: Record<string, string> = {
    cloned: "Your Cloned Voices",
    generated: "Generated Voices",
    premade: "Default Voices",
    professional: "Professional Voices",
    other: "Other Voices",
  };

  return (
    <BaseNode
      id={id}
      title="Voice (ElevenLabs)"
      selected={selected}
      hasError={nodeData.status === "error"}
    >
      {/* Hidden audio element for preview */}
      <audio
        ref={previewAudioRef}
        onEnded={() => setIsPreviewPlaying(false)}
        className="hidden"
      />

      {/* Text input (Script) */}
      <Handle
        type="target"
        position={Position.Left}
        id="text"
        data-handletype="text"
      />

      {/* Audio output */}
      <Handle
        type="source"
        position={Position.Right}
        id="audio"
        data-handletype="audio"
      />

      <div className="flex-1 flex flex-col min-h-0 gap-2">
        <div className="relative group w-full flex-1 min-h-[60px] border border-dashed border-neutral-600 rounded flex flex-col items-center justify-center bg-black/20">
          {nodeData.outputAudio ? (
            <div className="w-full px-2">
              <audio src={nodeData.outputAudio} controls className="w-full h-8" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1 p-2 text-center">
              {nodeData.status === "loading" ? (
                <svg className="w-5 h-5 animate-spin text-neutral-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : nodeData.status === "error" ? (
                <span className="text-[9px] text-red-400">{nodeData.error || "Failed"}</span>
              ) : (
                <>
                  <svg className="w-5 h-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                  </svg>
                  <span className="text-neutral-500 text-[9px]">Connect script to generate voice</span>
                </>
              )}
            </div>
          )}

          {nodeData.outputAudio && (
            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleRegenerate}
                disabled={isRunning}
                className="w-4 h-4 bg-neutral-900/80 hover:bg-blue-600/80 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                title="Regenerate"
              >
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={handleClear}
                className="w-4 h-4 bg-neutral-900/80 hover:bg-red-600/80 rounded flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                title="Clear"
              >
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Voice Selector with Preview */}
        <div className="flex items-center gap-1">
          <select
            value={nodeData.voiceId}
            onChange={handleVoiceChange}
            disabled={isLoadingVoices}
            className="nodrag flex-1 text-[10px] py-1 px-1.5 border border-neutral-700 rounded bg-neutral-900/50 focus:outline-none focus:ring-1 focus:ring-neutral-600 text-neutral-300 shrink-0"
          >
            {isLoadingVoices ? (
              <option>Loading...</option>
            ) : (
              Object.entries(groupedVoices).map(([category, categoryVoices]) => (
                <optgroup key={category} label={categoryLabels[category] || category}>
                  {categoryVoices.map(voice => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name}
                      {voice.gender && voice.accent ? ` (${voice.gender}, ${voice.accent})` : ""}
                    </option>
                  ))}
                </optgroup>
              ))
            )}
          </select>
          {/* Preview Button */}
          <button
            onClick={handlePreview}
            disabled={!hasPreview}
            className={`nodrag w-6 h-6 flex items-center justify-center rounded border transition-colors ${
              isPreviewPlaying
                ? "bg-green-600 border-green-500 text-white"
                : hasPreview
                  ? "bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-green-400 hover:border-green-600"
                  : "bg-neutral-800/50 border-neutral-700/50 text-neutral-600 cursor-not-allowed"
            }`}
            title={hasPreview ? (isPreviewPlaying ? "Stop" : "Preview") : "No preview"}
          >
            {isPreviewPlaying ? (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>

        {/* Execute button */}
        <ExecuteButton nodeId={id} />
      </div>
    </BaseNode>
  );
});

ElevenLabsNode.displayName = "ElevenLabsNode";
