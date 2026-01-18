"use client";

import { useCallback, memo, useRef, useState } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { useSettingsStore } from "@/store/settingsStore";
import { SoundEffectsNodeData } from "@/types";

type SoundEffectsNodeType = Node<SoundEffectsNodeData, "soundEffects">;

export const SoundEffectsNode = memo(({ id, data, selected }: NodeProps<SoundEffectsNodeType>) => {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNodeData(id, { prompt: e.target.value });
  }, [id, updateNodeData]);

  const handleDurationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseFloat(e.target.value) : null;
    updateNodeData(id, { duration: value });
  }, [id, updateNodeData]);

  const handleGenerate = useCallback(async () => {
    if (!nodeData.prompt || isGenerating) return;

    setIsGenerating(true);
    updateNodeData(id, { status: "loading", error: null });

    try {
      const { elevenLabsApiKey } = useSettingsStore.getState();
      const response = await fetch("/api/sound-effects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(elevenLabsApiKey && { "x-elevenlabs-api-key": elevenLabsApiKey }),
        },
        body: JSON.stringify({
          text: nodeData.prompt,
          ...(nodeData.duration && { duration: nodeData.duration }),
        }),
      });

      const result = await response.json();
      if (result.success) {
        updateNodeData(id, {
          outputAudio: result.audio,
          status: "complete",
        });
        console.log("[SoundEffects] Generation complete");
      } else {
        updateNodeData(id, { status: "error", error: result.error });
        console.error("[SoundEffects] Failed:", result.error);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      updateNodeData(id, { status: "error", error: errorMsg });
      console.error("[SoundEffects] Error:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [id, nodeData.prompt, nodeData.duration, isGenerating, updateNodeData]);

  const hasPrompt = !!nodeData.prompt?.trim();
  const hasOutput = !!nodeData.outputAudio;

  return (
    <BaseNode
      id={id}
      title="Sound Effects"
      selected={selected}
      hasError={nodeData.status === "error"}
      minWidth={320}
      minHeight={320}
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
          <label className="text-[9px] text-neutral-500 uppercase tracking-wider">Describe Sound</label>
          <textarea
            value={nodeData.prompt}
            onChange={handlePromptChange}
            placeholder="e.g., thunder rumbling in the distance, footsteps on gravel, door creaking..."
            className="nodrag w-full h-20 text-[10px] p-2 border border-neutral-700 rounded bg-neutral-900/50 text-neutral-200 placeholder:text-neutral-600 resize-none"
          />
        </div>

        {/* Duration (optional) */}
        <div className="flex items-center gap-2">
          <label className="text-[9px] text-neutral-500 uppercase tracking-wider flex-shrink-0">Duration</label>
          <input
            type="number"
            value={nodeData.duration || ""}
            onChange={handleDurationChange}
            placeholder="Auto"
            min={0.5}
            max={22}
            step={0.5}
            className="nodrag flex-1 text-[10px] py-1 px-2 border border-neutral-700 rounded bg-neutral-900/50 text-neutral-300 placeholder:text-neutral-600"
          />
          <span className="text-[9px] text-neutral-500">sec</span>
        </div>

        {/* Info */}
        <div className="text-[9px] text-neutral-500 leading-relaxed p-2 bg-amber-900/20 border border-amber-800/30 rounded">
          <span className="text-amber-400 font-medium">AI Sound Generation</span> - Describe any sound effect and ElevenLabs will generate it.
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={!hasPrompt || isGenerating}
          className="nodrag w-full py-2 text-[10px] font-medium bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white transition-colors"
        >
          {isGenerating ? "Generating..." : "Generate Sound"}
        </button>

        {/* Error Display */}
        {nodeData.status === "error" && nodeData.error && (
          <div className="p-2 bg-red-900/30 border border-red-700/50 rounded">
            <p className="text-[9px] text-red-400">{nodeData.error}</p>
          </div>
        )}

        {/* Loading Indicator */}
        {nodeData.status === "loading" && (
          <div className="flex items-center justify-center gap-2 p-2 bg-amber-900/30 border border-amber-700/50 rounded">
            <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-[9px] text-amber-400">Generating sound effect...</span>
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
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
});

SoundEffectsNode.displayName = "SoundEffectsNode";
