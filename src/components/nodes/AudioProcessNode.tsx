"use client";

import { useCallback, memo, useRef, useEffect, useState } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { useSettingsStore } from "@/store/settingsStore";
import { AudioProcessNodeData, NoiseReductionLevel, AudioProcessMethod } from "@/types";

type AudioProcessNodeType = Node<AudioProcessNodeData, "audioProcess">;

export const AudioProcessNode = memo(({ id, data, selected }: NodeProps<AudioProcessNodeType>) => {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const edges = useWorkflowStore((state) => state.edges);
  const nodes = useWorkflowStore((state) => state.nodes);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Get connected input video
  const getInputVideo = useCallback((): string | null => {
    const inputEdge = edges.find(e => e.target === id && e.targetHandle === "video");
    if (!inputEdge) return null;

    const sourceNode = nodes.find(n => n.id === inputEdge.source);
    if (!sourceNode) return null;

    // Extract video from various node types
    const sourceData = sourceNode.data as Record<string, unknown>;
    if (sourceNode.type === "videoGenerate" || sourceNode.type === "videoInput") {
      return (sourceData.outputVideo as string) || (sourceData.video as string) || null;
    }
    if (sourceNode.type === "videoStitch" || sourceNode.type === "videoUpscale" || sourceNode.type === "audioProcess" || sourceNode.type === "caption") {
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

  const handleMethodChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    updateNodeData(id, { method: e.target.value as AudioProcessMethod });
  }, [id, updateNodeData]);

  const handleLevelChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    updateNodeData(id, { noiseReduction: e.target.value as NoiseReductionLevel });
  }, [id, updateNodeData]);

  const handleProcess = useCallback(async () => {
    const inputVideo = getInputVideo();
    if (!inputVideo || isProcessing) return;

    setIsProcessing(true);
    updateNodeData(id, { status: "loading", error: null });

    const method = nodeData.method || "elevenlabs";

    try {
      if (method === "elevenlabs") {
        // Use ElevenLabs AI Audio Isolation
        const { elevenLabsApiKey } = useSettingsStore.getState();
        const response = await fetch("/api/audio-isolate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(elevenLabsApiKey && { "x-elevenlabs-api-key": elevenLabsApiKey }),
          },
          body: JSON.stringify({ video: inputVideo }),
        });

        const result = await response.json();
        if (result.success) {
          updateNodeData(id, {
            outputVideo: result.video,
            status: "complete",
          });
          console.log("[AudioProcess] AI audio isolation complete");
        } else {
          updateNodeData(id, { status: "error", error: result.error });
          console.error("[AudioProcess] AI isolation failed:", result.error);
        }
      } else {
        // Use FFmpeg noise reduction
        const response = await fetch("/api/audio-denoise", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            video: inputVideo,
            noiseReduction: nodeData.noiseReduction,
          }),
        });

        const result = await response.json();
        if (result.success) {
          updateNodeData(id, {
            outputVideo: result.video,
            status: "complete",
          });
          console.log(`[AudioProcess] FFmpeg ${result.noiseReduction} noise reduction complete`);
        } else {
          updateNodeData(id, { status: "error", error: result.error });
          console.error("[AudioProcess] FFmpeg failed:", result.error);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      updateNodeData(id, { status: "error", error: errorMsg });
      console.error("[AudioProcess] Error:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [id, nodeData.noiseReduction, nodeData.method, getInputVideo, isProcessing, updateNodeData]);

  const inputVideo = getInputVideo();
  const hasInput = !!inputVideo;
  const hasOutput = !!nodeData.outputVideo;
  const method = nodeData.method || "elevenlabs";

  return (
    <BaseNode
      id={id}
      title="Audio Process"
      selected={selected}
      hasError={nodeData.status === "error"}
      minWidth={320}
      minHeight={360}
    >
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
        title="Processed video output"
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

        {/* Method Selector */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[9px] text-neutral-500 uppercase tracking-wider flex-shrink-0">Method</label>
            <select
              value={method}
              onChange={handleMethodChange}
              className="flex-1 text-[10px] py-1 px-1.5 border border-neutral-700 rounded bg-neutral-900/50 text-neutral-300"
            >
              <option value="elevenlabs">AI Isolation (ElevenLabs)</option>
              <option value="ffmpeg">Basic (FFmpeg)</option>
            </select>
          </div>

          {method === "elevenlabs" ? (
            <div className="text-[9px] text-neutral-500 leading-relaxed p-2 bg-cyan-900/20 border border-cyan-800/30 rounded">
              <span className="text-cyan-400 font-medium">AI-powered</span> voice isolation. Removes background noise while preserving voice clarity. Best quality.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <label className="text-[9px] text-neutral-500 uppercase tracking-wider flex-shrink-0">Level</label>
                <select
                  value={nodeData.noiseReduction}
                  onChange={handleLevelChange}
                  className="flex-1 text-[10px] py-1 px-1.5 border border-neutral-700 rounded bg-neutral-900/50 text-neutral-300"
                >
                  <option value="light">Light - Subtle cleanup</option>
                  <option value="medium">Medium - Balanced</option>
                  <option value="heavy">Heavy - Aggressive</option>
                </select>
              </div>
              <div className="text-[9px] text-neutral-500 leading-relaxed">
                {nodeData.noiseReduction === "light" && "Gentle filtering, preserves voice clarity"}
                {nodeData.noiseReduction === "medium" && "Good balance of noise removal and audio quality"}
                {nodeData.noiseReduction === "heavy" && "Maximum noise removal, may affect voice quality"}
              </div>
            </>
          )}
        </div>

        {/* Process Button */}
        <button
          onClick={handleProcess}
          disabled={!hasInput || isProcessing}
          className={`nodrag w-full py-2 text-[10px] font-medium rounded text-white transition-colors ${
            method === "elevenlabs"
              ? "bg-cyan-600 hover:bg-cyan-500"
              : "bg-neutral-600 hover:bg-neutral-500"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isProcessing
            ? (method === "elevenlabs" ? "Isolating Voice..." : "Processing...")
            : (method === "elevenlabs" ? "Isolate Voice (AI)" : "Reduce Noise")}
        </button>

        {/* Error Display */}
        {nodeData.status === "error" && nodeData.error && (
          <div className="p-2 bg-red-900/30 border border-red-700/50 rounded">
            <p className="text-[9px] text-red-400">{nodeData.error}</p>
          </div>
        )}

        {/* Loading Indicator */}
        {nodeData.status === "loading" && (
          <div className="flex items-center justify-center gap-2 p-2 bg-cyan-900/30 border border-cyan-700/50 rounded">
            <div className="w-3 h-3 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-[9px] text-cyan-400">
              {method === "elevenlabs" ? "AI isolating voice..." : "Processing audio..."}
            </span>
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
              <span className="absolute top-1 right-1 text-[8px] bg-green-600/80 px-1 rounded text-white">
                {method === "elevenlabs" ? "AI Cleaned" : "Cleaned"}
              </span>
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
});

AudioProcessNode.displayName = "AudioProcessNode";
