"use client";

import { useCallback, memo, useRef, useEffect, useState } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { useSettingsStore } from "@/store/settingsStore";
import { VoiceSwapNodeData } from "@/types";

type VoiceSwapNodeType = Node<VoiceSwapNodeData, "voiceSwap">;

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
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", previewUrl: null, category: "premade", accent: "american", description: "calm", gender: "female", age: "young" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", previewUrl: null, category: "premade", accent: "american", description: "deep", gender: "male", age: "middle aged" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", previewUrl: null, category: "premade", accent: "american", description: "soft", gender: "female", age: "young" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", previewUrl: null, category: "premade", accent: "american", description: "deep", gender: "male", age: "young" },
];

export const VoiceSwapNode = memo(({ id, data, selected }: NodeProps<VoiceSwapNodeType>) => {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const edges = useWorkflowStore((state) => state.edges);
  const nodes = useWorkflowStore((state) => state.nodes);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
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
            updateNodeData(id, {
              voiceId: result.voices[0].id,
              voiceName: result.voices[0].name,
            });
          }
        }
      } catch (error) {
        console.error("[VoiceSwap] Failed to fetch voices:", error);
      } finally {
        setIsLoadingVoices(false);
        setVoicesLoaded(true);
      }
    };

    fetchVoices();
  }, [id, nodeData.voiceId, updateNodeData, voicesLoaded]);

  // Get connected input video
  const getInputVideo = useCallback((): string | null => {
    const inputEdge = edges.find(e => e.target === id && e.targetHandle === "video");
    if (!inputEdge) return null;

    const sourceNode = nodes.find(n => n.id === inputEdge.source);
    if (!sourceNode) return null;

    const sourceData = sourceNode.data as Record<string, unknown>;
    if (sourceNode.type === "videoGenerate" || sourceNode.type === "videoInput") {
      return (sourceData.outputVideo as string) || (sourceData.video as string) || null;
    }
    if (sourceNode.type === "videoStitch" || sourceNode.type === "videoUpscale" ||
        sourceNode.type === "audioProcess" || sourceNode.type === "caption" || sourceNode.type === "voiceSwap") {
      return (sourceData.outputVideo as string) || null;
    }
    return null;
  }, [edges, nodes, id]);

  // Auto-update input video when edges or upstream nodes change
  useEffect(() => {
    const inputVideo = getInputVideo();
    if (inputVideo !== nodeData.inputVideo) {
      updateNodeData(id, { inputVideo });
    }
  }, [edges, nodes, id, getInputVideo, nodeData.inputVideo, updateNodeData]);

  const handleVoiceChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const voice = voices.find(v => v.id === e.target.value);
    updateNodeData(id, {
      voiceId: e.target.value,
      voiceName: voice?.name || null
    });
  }, [id, updateNodeData, voices]);

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

  const handleSwap = useCallback(async () => {
    const inputVideo = getInputVideo();
    if (!inputVideo || isProcessing) return;

    setIsProcessing(true);
    updateNodeData(id, { status: "loading", error: null });

    try {
      const { elevenLabsApiKey } = useSettingsStore.getState();
      const response = await fetch("/api/voice-swap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(elevenLabsApiKey && { "x-elevenlabs-api-key": elevenLabsApiKey }),
        },
        body: JSON.stringify({
          video: inputVideo,
          voiceId: nodeData.voiceId,
        }),
      });

      const result = await response.json();
      if (result.success) {
        updateNodeData(id, {
          outputVideo: result.video,
          status: "complete",
        });
        console.log("[VoiceSwap] Voice swap complete");
      } else {
        updateNodeData(id, { status: "error", error: result.error });
        console.error("[VoiceSwap] Failed:", result.error);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      updateNodeData(id, { status: "error", error: errorMsg });
      console.error("[VoiceSwap] Error:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [id, nodeData.voiceId, getInputVideo, isProcessing, updateNodeData]);

  const inputVideo = getInputVideo();
  const hasInput = !!inputVideo;
  const hasOutput = !!nodeData.outputVideo;
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
      title="Voice Swap"
      selected={selected}
      hasError={nodeData.status === "error"}
      minWidth={340}
      minHeight={420}
    >
      {/* Hidden audio element for preview */}
      <audio
        ref={previewAudioRef}
        onEnded={() => setIsPreviewPlaying(false)}
        className="hidden"
      />

      {/* Video Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="video"
        style={{ background: "#ef4444", top: "50%" }}
        title="Video input"
      />

      {/* Video Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="video"
        style={{ background: "#ef4444", top: "50%" }}
        title="Voice-swapped video output"
      />

      <div className="space-y-3 p-1">
        {/* Input Preview */}
        <div className="space-y-1">
          <label className="text-[9px] text-neutral-500 uppercase tracking-wider">Input Video</label>
          {hasInput ? (
            <div className="relative bg-black rounded border border-neutral-700 overflow-hidden">
              <video
                src={inputVideo}
                className="w-full h-20 object-contain"
                muted
                playsInline
              />
            </div>
          ) : (
            <div className="h-14 bg-neutral-800/50 rounded border border-dashed border-neutral-700 flex items-center justify-center">
              <span className="text-[9px] text-neutral-500">Connect video input</span>
            </div>
          )}
        </div>

        {/* Voice Selector */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[9px] text-neutral-500 uppercase tracking-wider flex-shrink-0">Voice</label>
            <select
              value={nodeData.voiceId}
              onChange={handleVoiceChange}
              disabled={isLoadingVoices}
              className="nodrag flex-1 text-[10px] py-1.5 px-2 border border-neutral-700 rounded bg-neutral-900/50 text-neutral-300"
            >
              {isLoadingVoices ? (
                <option>Loading voices...</option>
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
              className={`nodrag w-8 h-8 flex items-center justify-center rounded border transition-colors ${
                isPreviewPlaying
                  ? "bg-purple-600 border-purple-500 text-white"
                  : hasPreview
                    ? "bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-purple-400 hover:border-purple-600"
                    : "bg-neutral-800/50 border-neutral-700/50 text-neutral-600 cursor-not-allowed"
              }`}
              title={hasPreview ? (isPreviewPlaying ? "Stop preview" : "Preview voice") : "No preview available"}
            >
              {isPreviewPlaying ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
          </div>

          {/* Voice Info */}
          {currentVoice && (
            <div className="text-[9px] text-neutral-500 leading-relaxed p-2 bg-purple-900/20 border border-purple-800/30 rounded">
              <span className="text-purple-400 font-medium">{currentVoice.name}</span>
              {currentVoice.description && <span> - {currentVoice.description}</span>}
              {currentVoice.gender && currentVoice.age && (
                <span className="text-neutral-600"> ({currentVoice.gender}, {currentVoice.age})</span>
              )}
              <div className="mt-1 text-[8px] text-neutral-600">
                Category: {categoryLabels[currentVoice.category] || currentVoice.category}
              </div>
            </div>
          )}
        </div>

        {/* Swap Button */}
        <button
          onClick={handleSwap}
          disabled={!hasInput || isProcessing}
          className="nodrag w-full py-2 text-[10px] font-medium bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white transition-colors"
        >
          {isProcessing ? "Swapping Voice..." : "Swap Voice"}
        </button>

        {/* Error Display */}
        {nodeData.status === "error" && nodeData.error && (
          <div className="p-2 bg-red-900/30 border border-red-700/50 rounded">
            <p className="text-[9px] text-red-400">{nodeData.error}</p>
          </div>
        )}

        {/* Loading Indicator */}
        {nodeData.status === "loading" && (
          <div className="flex items-center justify-center gap-2 p-2 bg-purple-900/30 border border-purple-700/50 rounded">
            <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-[9px] text-purple-400">Converting voice...</span>
          </div>
        )}

        {/* Output Preview */}
        {hasOutput && (
          <div className="space-y-1">
            <label className="text-[9px] text-neutral-500 uppercase tracking-wider">Output</label>
            <div className="relative bg-black rounded border border-green-700/50 overflow-hidden">
              <video
                ref={videoRef}
                src={nodeData.outputVideo!}
                controls
                className="w-full h-24 object-contain"
                playsInline
              />
              <span className="absolute top-1 right-1 text-[8px] bg-purple-600/80 px-1 rounded text-white">
                {nodeData.voiceName}
              </span>
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
});

VoiceSwapNode.displayName = "VoiceSwapNode";
