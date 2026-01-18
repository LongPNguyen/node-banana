"use client";

import { useCallback, memo, useRef, useEffect, useState } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { VideoUpscaleNodeData, UpscaleResolution } from "@/types";

type VideoUpscaleNodeType = Node<VideoUpscaleNodeData, "videoUpscale">;

export const VideoUpscaleNode = memo(({ id, data, selected }: NodeProps<VideoUpscaleNodeType>) => {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const edges = useWorkflowStore((state) => state.edges);
  const nodes = useWorkflowStore((state) => state.nodes);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isUpscaling, setIsUpscaling] = useState(false);

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

  const handleResolutionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    updateNodeData(id, { targetResolution: e.target.value as UpscaleResolution });
  }, [id, updateNodeData]);

  const handleSharpenChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { sharpen: e.target.checked });
  }, [id, updateNodeData]);

  const handleUpscale = useCallback(async () => {
    const inputVideo = getInputVideo();
    if (!inputVideo || isUpscaling) return;

    setIsUpscaling(true);
    updateNodeData(id, { status: "loading", error: null });

    try {
      const response = await fetch("/api/video-upscale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video: inputVideo,
          targetResolution: nodeData.targetResolution,
          sharpen: nodeData.sharpen,
        }),
      });

      const result = await response.json();
      if (result.success) {
        updateNodeData(id, {
          outputVideo: result.video,
          originalResolution: result.originalResolution,
          newResolution: result.newResolution,
          status: "complete",
        });
        console.log(`[VideoUpscale] Upscaled ${result.originalResolution} -> ${result.newResolution}`);
      } else {
        updateNodeData(id, { status: "error", error: result.error });
        console.error("[VideoUpscale] Failed:", result.error);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      updateNodeData(id, { status: "error", error: errorMsg });
      console.error("[VideoUpscale] Error:", error);
    } finally {
      setIsUpscaling(false);
    }
  }, [id, nodeData.targetResolution, nodeData.sharpen, getInputVideo, isUpscaling, updateNodeData]);

  const inputVideo = getInputVideo();
  const hasInput = !!inputVideo;
  const hasOutput = !!nodeData.outputVideo;

  return (
    <BaseNode
      id={id}
      title="Video Upscale"
      selected={selected}
      hasError={nodeData.status === "error"}
      minWidth={320}
      minHeight={340}
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
        title="Upscaled video output"
      />

      <div className="space-y-3 p-1">
        {/* Input Preview */}
        <div className="space-y-1">
          <label className="text-[9px] text-neutral-500 uppercase tracking-wider">Input Video</label>
          {hasInput ? (
            <div className="relative bg-black rounded border border-neutral-700 overflow-hidden">
              <video
                src={inputVideo}
                className="w-full h-24 object-contain"
                muted
                playsInline
              />
              {nodeData.originalResolution && (
                <span className="absolute bottom-1 left-1 text-[8px] bg-black/80 px-1 rounded text-neutral-300">
                  {nodeData.originalResolution}
                </span>
              )}
            </div>
          ) : (
            <div className="h-16 bg-neutral-800/50 rounded border border-dashed border-neutral-700 flex items-center justify-center">
              <span className="text-[9px] text-neutral-500">Connect video input</span>
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[9px] text-neutral-500 uppercase tracking-wider flex-shrink-0">Target</label>
            <select
              value={nodeData.targetResolution}
              onChange={handleResolutionChange}
              className="flex-1 text-[10px] py-1 px-1.5 border border-neutral-700 rounded bg-neutral-900/50 text-neutral-300"
            >
              <option value="1080p">1080p (1920x1080)</option>
              <option value="1440p">1440p (2560x1440)</option>
              <option value="4k">4K (3840x2160)</option>
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={nodeData.sharpen}
              onChange={handleSharpenChange}
              className="nodrag w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-800 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
            />
            <span className="text-[10px] text-neutral-400">Apply sharpening</span>
          </label>
        </div>

        {/* Upscale Button */}
        <button
          onClick={handleUpscale}
          disabled={!hasInput || isUpscaling}
          className="nodrag w-full py-2 text-[10px] font-medium bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white transition-colors"
        >
          {isUpscaling ? "Upscaling..." : "Upscale Video"}
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
            <span className="text-[9px] text-purple-400">Upscaling video...</span>
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
                className="w-full h-28 object-contain"
                muted
                playsInline
              />
              {nodeData.newResolution && (
                <span className="absolute top-1 right-1 text-[8px] bg-green-600/80 px-1 rounded text-white">
                  {nodeData.newResolution}
                </span>
              )}
            </div>
            {nodeData.originalResolution && nodeData.newResolution && (
              <p className="text-[8px] text-neutral-500 text-center">
                {nodeData.originalResolution} → {nodeData.newResolution}
              </p>
            )}
          </div>
        )}
      </div>
    </BaseNode>
  );
});

VideoUpscaleNode.displayName = "VideoUpscaleNode";
