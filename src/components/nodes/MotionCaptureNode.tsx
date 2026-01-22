"use client";

import { useCallback, memo, useRef, useEffect, useState } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { useSettingsStore } from "@/store/settingsStore";
import { MotionCaptureNodeData, CharacterOrientation } from "@/types";

type MotionCaptureNodeType = Node<MotionCaptureNodeData, "motionCapture">;

export const MotionCaptureNode = memo(({ id, data, selected }: NodeProps<MotionCaptureNodeType>) => {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const edges = useWorkflowStore((state) => state.edges);
  const nodes = useWorkflowStore((state) => state.nodes);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Get connected reference image
  const getReferenceImage = useCallback((): string | null => {
    const inputEdge = edges.find(e => e.target === id && e.targetHandle === "image");
    if (!inputEdge) return null;

    const sourceNode = nodes.find(n => n.id === inputEdge.source);
    if (!sourceNode) return null;

    const sourceData = sourceNode.data as Record<string, unknown>;

    // From image input nodes
    if (sourceNode.type === "imageInput") {
      return (sourceData.image as string) || null;
    }
    // From annotation nodes
    if (sourceNode.type === "annotation") {
      return (sourceData.outputImage as string) || null;
    }
    // From nanoBanana (image generation)
    if (sourceNode.type === "nanoBanana") {
      return (sourceData.outputImage as string) || null;
    }
    return null;
  }, [edges, nodes, id]);

  // Get connected source video
  const getSourceVideo = useCallback((): string | null => {
    const inputEdge = edges.find(e => e.target === id && e.targetHandle === "video");
    if (!inputEdge) return null;

    const sourceNode = nodes.find(n => n.id === inputEdge.source);
    if (!sourceNode) return null;

    const sourceData = sourceNode.data as Record<string, unknown>;

    if (sourceNode.type === "videoGenerate" || sourceNode.type === "videoInput") {
      return (sourceData.outputVideo as string) || (sourceData.video as string) || null;
    }
    if (sourceNode.type === "videoStitch" || sourceNode.type === "videoUpscale" ||
        sourceNode.type === "audioProcess" || sourceNode.type === "caption" ||
        sourceNode.type === "voiceSwap" || sourceNode.type === "motionCapture") {
      return (sourceData.outputVideo as string) || null;
    }
    return null;
  }, [edges, nodes, id]);

  // Auto-update inputs when edges or upstream nodes change
  useEffect(() => {
    const referenceImage = getReferenceImage();
    const sourceVideo = getSourceVideo();

    if (referenceImage !== nodeData.referenceImage || sourceVideo !== nodeData.sourceVideo) {
      updateNodeData(id, { referenceImage, sourceVideo });
    }
  }, [edges, nodes, id, getReferenceImage, getSourceVideo, nodeData.referenceImage, nodeData.sourceVideo, updateNodeData]);

  const handleOrientationChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    updateNodeData(id, { characterOrientation: e.target.value as CharacterOrientation });
  }, [id, updateNodeData]);

  const handleResolutionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    updateNodeData(id, { resolution: e.target.value as "720p" | "1080p" });
  }, [id, updateNodeData]);

  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNodeData(id, { prompt: e.target.value });
  }, [id, updateNodeData]);

  const handleGenerate = useCallback(async () => {
    const referenceImage = getReferenceImage();
    const sourceVideo = getSourceVideo();

    if (!referenceImage || !sourceVideo || isProcessing) return;

    setIsProcessing(true);
    updateNodeData(id, { status: "loading", error: null });

    try {
      const { kieAiApiKey } = useSettingsStore.getState();
      const response = await fetch("/api/motion-capture", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(kieAiApiKey && { "x-kieai-api-key": kieAiApiKey }),
        },
        body: JSON.stringify({
          referenceImage,
          sourceVideo,
          characterOrientation: nodeData.characterOrientation,
          mode: nodeData.resolution,
          prompt: nodeData.prompt || undefined,
        }),
      });

      const result = await response.json();
      if (result.success) {
        updateNodeData(id, {
          outputVideo: result.video,
          lastFrame: result.lastFrame || null,
          status: "complete",
        });
        console.log("[MotionCapture] Generation complete");
      } else {
        updateNodeData(id, { status: "error", error: result.error });
        console.error("[MotionCapture] Failed:", result.error);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      updateNodeData(id, { status: "error", error: errorMsg });
      console.error("[MotionCapture] Error:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [id, nodeData.characterOrientation, nodeData.resolution, nodeData.prompt, getReferenceImage, getSourceVideo, isProcessing, updateNodeData]);

  const referenceImage = getReferenceImage();
  const sourceVideo = getSourceVideo();
  const hasImage = !!referenceImage;
  const hasVideo = !!sourceVideo;
  const hasOutput = !!nodeData.outputVideo;
  const canGenerate = hasImage && hasVideo && !isProcessing;

  return (
    <BaseNode
      id={id}
      title="Motion Capture"
      selected={selected}
      hasError={nodeData.status === "error"}
      minWidth={380}
      minHeight={500}
    >
      {/* Image Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="image"
        style={{ background: "#10b981", top: "30%" }}
        title="Character image input"
      />

      {/* Video Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="video"
        style={{ background: "#ef4444", top: "70%" }}
        title="Motion source video"
      />

      {/* Video Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="video"
        style={{ background: "#ef4444", top: "50%" }}
        title="Motion captured video output"
      />

      <div className="space-y-3 p-1">
        {/* Input Previews */}
        <div className="grid grid-cols-2 gap-2">
          {/* Reference Image */}
          <div className="space-y-1">
            <label className="text-[9px] text-neutral-500 uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Character
            </label>
            {hasImage ? (
              <div className="relative bg-black rounded border border-neutral-700 overflow-hidden aspect-square">
                <img
                  src={referenceImage}
                  alt="Character"
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="h-20 bg-neutral-800/50 rounded border border-dashed border-neutral-700 flex items-center justify-center">
                <span className="text-[8px] text-neutral-500 text-center px-2">Connect image</span>
              </div>
            )}
          </div>

          {/* Source Video */}
          <div className="space-y-1">
            <label className="text-[9px] text-neutral-500 uppercase tracking-wider flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Motion
            </label>
            {hasVideo ? (
              <div className="relative bg-black rounded border border-neutral-700 overflow-hidden aspect-square">
                <video
                  src={sourceVideo}
                  className="w-full h-full object-contain"
                  muted
                  playsInline
                  loop
                  autoPlay
                />
              </div>
            ) : (
              <div className="h-20 bg-neutral-800/50 rounded border border-dashed border-neutral-700 flex items-center justify-center">
                <span className="text-[8px] text-neutral-500 text-center px-2">Connect video</span>
              </div>
            )}
          </div>
        </div>

        {/* Settings */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[9px] text-neutral-500 uppercase tracking-wider">Orientation</label>
            <select
              value={nodeData.characterOrientation}
              onChange={handleOrientationChange}
              className="nodrag w-full text-[10px] py-1.5 px-2 border border-neutral-700 rounded bg-neutral-900/50 text-neutral-300"
            >
              <option value="image">Match Image</option>
              <option value="video">Match Video</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] text-neutral-500 uppercase tracking-wider">Resolution</label>
            <select
              value={nodeData.resolution}
              onChange={handleResolutionChange}
              className="nodrag w-full text-[10px] py-1.5 px-2 border border-neutral-700 rounded bg-neutral-900/50 text-neutral-300"
            >
              <option value="720p">720p (Standard)</option>
              <option value="1080p">1080p (Pro)</option>
            </select>
          </div>
        </div>

        {/* Prompt (Optional) */}
        <div className="space-y-1">
          <label className="text-[9px] text-neutral-500 uppercase tracking-wider">Scene Description (Optional)</label>
          <textarea
            value={nodeData.prompt}
            onChange={handlePromptChange}
            placeholder="Describe the scene, setting, or additional context..."
            className="nodrag w-full h-14 text-[10px] p-2 border border-neutral-700 rounded bg-neutral-900/50 text-neutral-200 placeholder:text-neutral-600 resize-none"
          />
        </div>

        {/* Info */}
        <div className="text-[9px] text-neutral-500 leading-relaxed p-2 bg-cyan-900/20 border border-cyan-800/30 rounded">
          <span className="text-cyan-400 font-medium">Kling 2.6 Motion Control</span> - Transfers motion from the video to animate your character image. Works best with clear poses.
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="nodrag w-full py-2.5 text-[10px] font-medium bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white transition-colors"
        >
          {isProcessing ? "Generating Motion..." : "Generate Motion Capture"}
        </button>

        {/* Error Display */}
        {nodeData.status === "error" && nodeData.error && (
          <div className="p-2 bg-red-900/30 border border-red-700/50 rounded">
            <p className="text-[9px] text-red-400">{nodeData.error}</p>
          </div>
        )}

        {/* Loading Indicator */}
        {nodeData.status === "loading" && (
          <div className="flex items-center justify-center gap-2 p-3 bg-cyan-900/30 border border-cyan-700/50 rounded">
            <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-[9px] text-cyan-400">Processing motion capture (this may take a few minutes)...</span>
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
                className="w-full h-32 object-contain"
                playsInline
              />
              <span className="absolute top-1 right-1 text-[8px] bg-cyan-600/80 px-1.5 py-0.5 rounded text-white">
                {nodeData.resolution}
              </span>
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
});

MotionCaptureNode.displayName = "MotionCaptureNode";
