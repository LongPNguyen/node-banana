"use client";

import { useCallback, memo, useRef, useState } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { useSettingsStore } from "@/store/settingsStore";
import { MusicGenerateNodeData } from "@/types";

type MusicGenerateNodeType = Node<MusicGenerateNodeData, "musicGenerate">;

export const MusicGenerateNode = memo(({ id, data, selected }: NodeProps<MusicGenerateNodeType>) => {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNodeData(id, { prompt: e.target.value });
  }, [id, updateNodeData]);

  const handleDurationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 30;
    updateNodeData(id, { duration: Math.min(60, Math.max(5, value)) });
  }, [id, updateNodeData]);

  const handleInstrumentalChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { instrumental: e.target.checked });
  }, [id, updateNodeData]);

  const handleGenerate = useCallback(async () => {
    if (!nodeData.prompt || isGenerating) return;

    setIsGenerating(true);
    updateNodeData(id, { status: "loading", error: null });

    try {
      const { elevenLabsApiKey } = useSettingsStore.getState();
      const response = await fetch("/api/music-generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(elevenLabsApiKey && { "x-elevenlabs-api-key": elevenLabsApiKey }),
        },
        body: JSON.stringify({
          prompt: nodeData.prompt,
          duration: nodeData.duration,
          instrumental: nodeData.instrumental,
        }),
      });

      const result = await response.json();
      if (result.success) {
        updateNodeData(id, {
          outputAudio: result.audio,
          status: "complete",
        });
        console.log("[MusicGenerate] Generation complete");
      } else {
        updateNodeData(id, { status: "error", error: result.error });
        console.error("[MusicGenerate] Failed:", result.error);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      updateNodeData(id, { status: "error", error: errorMsg });
      console.error("[MusicGenerate] Error:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [id, nodeData.prompt, nodeData.duration, nodeData.instrumental, isGenerating, updateNodeData]);

  const hasPrompt = !!nodeData.prompt?.trim();
  const hasOutput = !!nodeData.outputAudio;

  return (
    <BaseNode
      id={id}
      title="Music Generate"
      selected={selected}
      hasError={nodeData.status === "error"}
      minWidth={320}
      minHeight={380}
    >
      {/* Audio Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="audio"
        style={{ background: "#f59e0b", top: "50%" }}
        title="Audio output"
      />

      <div className="space-y-3 p-1">
        {/* Prompt Input */}
        <div className="space-y-1">
          <label className="text-[9px] text-neutral-500 uppercase tracking-wider">Describe Music</label>
          <textarea
            value={nodeData.prompt}
            onChange={handlePromptChange}
            placeholder="e.g., upbeat electronic music with synths, calm piano melody, epic orchestral trailer music..."
            className="nodrag w-full h-20 text-[10px] p-2 border border-neutral-700 rounded bg-neutral-900/50 text-neutral-200 placeholder:text-neutral-600 resize-none"
          />
        </div>

        {/* Settings Row */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-[9px] text-neutral-500 uppercase tracking-wider flex-shrink-0">Duration</label>
            <input
              type="number"
              value={nodeData.duration}
              onChange={handleDurationChange}
              min={5}
              max={60}
              step={5}
              className="nodrag w-16 text-[10px] py-1 px-2 border border-neutral-700 rounded bg-neutral-900/50 text-neutral-300"
            />
            <span className="text-[9px] text-neutral-500">sec</span>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={nodeData.instrumental}
              onChange={handleInstrumentalChange}
              className="nodrag w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-800 text-pink-500 focus:ring-pink-500 focus:ring-offset-0"
            />
            <span className="text-[9px] text-neutral-400">Instrumental</span>
          </label>
        </div>

        {/* Info */}
        <div className="text-[9px] text-neutral-500 leading-relaxed p-2 bg-pink-900/20 border border-pink-800/30 rounded">
          <span className="text-pink-400 font-medium">AI Music Generation</span> - Describe the mood, genre, and instruments for background music.
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={!hasPrompt || isGenerating}
          className="nodrag w-full py-2 text-[10px] font-medium bg-pink-600 hover:bg-pink-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white transition-colors"
        >
          {isGenerating ? "Generating..." : "Generate Music"}
        </button>

        {/* Error Display */}
        {nodeData.status === "error" && nodeData.error && (
          <div className="p-2 bg-red-900/30 border border-red-700/50 rounded">
            <p className="text-[9px] text-red-400">{nodeData.error}</p>
          </div>
        )}

        {/* Loading Indicator */}
        {nodeData.status === "loading" && (
          <div className="flex items-center justify-center gap-2 p-2 bg-pink-900/30 border border-pink-700/50 rounded">
            <div className="w-3 h-3 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-[9px] text-pink-400">Generating music...</span>
          </div>
        )}

        {/* Output Preview */}
        {hasOutput && (
          <div className="space-y-1">
            <label className="text-[9px] text-neutral-500 uppercase tracking-wider">Output</label>
            <div className="relative bg-neutral-800 rounded border border-green-700/50 overflow-hidden p-2">
              <audio
                ref={audioRef}
                src={nodeData.outputAudio!}
                controls
                className="w-full h-8"
              />
              <div className="text-[8px] text-neutral-500 mt-1">
                {nodeData.duration}s {nodeData.instrumental ? "instrumental" : "with vocals"}
              </div>
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
});

MusicGenerateNode.displayName = "MusicGenerateNode";
