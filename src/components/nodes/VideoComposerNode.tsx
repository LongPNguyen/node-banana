"use client";

import { memo, useCallback, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { VideoComposerNodeData } from "@/types";

export const VideoComposerNode = memo(function VideoComposerNode({
  id,
  data,
  selected,
}: NodeProps) {
  const nodeData = data as VideoComposerNodeData;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const getConnectedInputs = useWorkflowStore((state) => state.getConnectedInputs);

  const [isRendering, setIsRendering] = useState(false);

  // Get connected inputs
  const connectedInputs = getConnectedInputs(id);
  const hasCode = !!nodeData.inputCode;
  const hasAssets = connectedInputs.images.length > 0 || connectedInputs.video;

  // Collect videos from connections (we need to handle multiple video connections)
  const connectedVideos = connectedInputs.video ? [connectedInputs.video] : [];
  const connectedImages = connectedInputs.images || [];

  // Update inputVideos and inputImages when connections change
  useEffect(() => {
    updateNodeData(id, {
      inputVideos: connectedVideos,
      inputImages: connectedImages,
    });
  }, [connectedVideos.length, connectedImages.length]);

  const handleRender = useCallback(async () => {
    if (!nodeData.inputCode) {
      updateNodeData(id, { error: "No Remotion code connected. Connect an LLM node with generated code." });
      return;
    }

    setIsRendering(true);
    updateNodeData(id, { status: "loading", error: null });

    try {
      const response = await fetch("/api/video-composer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: nodeData.inputCode,
          videos: nodeData.inputVideos,
          images: nodeData.inputImages,
          duration: nodeData.duration,
          aspectRatio: nodeData.aspectRatio,
          fps: nodeData.fps,
        }),
      });

      const result = await response.json();

      if (result.success) {
        updateNodeData(id, {
          outputVideo: result.video,
          status: "complete",
        });
      } else {
        updateNodeData(id, {
          status: "error",
          error: result.error || "Render failed",
        });
      }
    } catch (error) {
      console.error("[VideoComposer] Render error:", error);
      updateNodeData(id, {
        status: "error",
        error: error instanceof Error ? error.message : "Render failed",
      });
    } finally {
      setIsRendering(false);
    }
  }, [id, nodeData.inputCode, nodeData.inputVideos, nodeData.inputImages, nodeData.duration, nodeData.aspectRatio, nodeData.fps, updateNodeData]);

  const handleDownload = useCallback(() => {
    if (!nodeData.outputVideo) return;

    const link = document.createElement("a");
    link.href = nodeData.outputVideo;
    link.download = `composed-video-${Date.now()}.mp4`;
    link.click();
  }, [nodeData.outputVideo]);

  return (
    <BaseNode id={id} selected={selected} title="Video Composer">
      {/* Input Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="text"
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-neutral-800"
        style={{ top: "30%" }}
        title="Remotion Code (from LLM)"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="video"
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-neutral-800"
        style={{ top: "50%" }}
        title="Video Input"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="image"
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-neutral-800"
        style={{ top: "70%" }}
        title="Image Input"
      />

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="video"
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-neutral-800"
        style={{ top: "50%" }}
        title="Video Output"
      />

      <div className="p-3 space-y-3">
        {/* Connected Assets Summary */}
        <div className="text-[10px] text-neutral-400 space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Code: {hasCode ? "Connected" : "Not connected"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-pink-500" />
            <span>Videos: {connectedVideos.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span>Images: {connectedImages.length}</span>
          </div>
        </div>

        {/* Settings */}
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-neutral-400 block mb-1">Duration (seconds)</label>
            <input
              type="number"
              min={1}
              max={120}
              value={nodeData.duration}
              onChange={(e) => updateNodeData(id, { duration: parseInt(e.target.value) || 10 })}
              className="w-full px-2 py-1 text-xs bg-neutral-700 border border-neutral-600 rounded text-neutral-200"
            />
          </div>

          <div>
            <label className="text-[10px] text-neutral-400 block mb-1">Aspect Ratio</label>
            <select
              value={nodeData.aspectRatio}
              onChange={(e) => updateNodeData(id, { aspectRatio: e.target.value as "9:16" | "16:9" | "1:1" })}
              className="w-full px-2 py-1 text-xs bg-neutral-700 border border-neutral-600 rounded text-neutral-200"
            >
              <option value="9:16">9:16 (Vertical)</option>
              <option value="16:9">16:9 (Horizontal)</option>
              <option value="1:1">1:1 (Square)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-neutral-400 block mb-1">FPS</label>
            <select
              value={nodeData.fps}
              onChange={(e) => updateNodeData(id, { fps: parseInt(e.target.value) })}
              className="w-full px-2 py-1 text-xs bg-neutral-700 border border-neutral-600 rounded text-neutral-200"
            >
              <option value={24}>24 fps</option>
              <option value={30}>30 fps</option>
              <option value={60}>60 fps</option>
            </select>
          </div>
        </div>

        {/* Code Preview */}
        {nodeData.inputCode && (
          <div>
            <label className="text-[10px] text-neutral-400 block mb-1">Generated Code</label>
            <div className="bg-neutral-900 rounded p-2 max-h-24 overflow-auto">
              <pre className="text-[9px] text-neutral-400 whitespace-pre-wrap">
                {nodeData.inputCode.slice(0, 300)}
                {nodeData.inputCode.length > 300 && "..."}
              </pre>
            </div>
          </div>
        )}

        {/* Render Button */}
        <button
          onClick={handleRender}
          disabled={isRendering || !hasCode}
          className={`w-full py-2 px-3 rounded text-xs font-medium transition-colors ${
            isRendering
              ? "bg-indigo-600 text-white cursor-wait"
              : hasCode
              ? "bg-indigo-500 hover:bg-indigo-600 text-white"
              : "bg-neutral-700 text-neutral-500 cursor-not-allowed"
          }`}
        >
          {isRendering ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Rendering...
            </span>
          ) : (
            "Render Video"
          )}
        </button>

        {/* Error Display */}
        {nodeData.error && (
          <div className="text-[10px] text-red-400 bg-red-900/20 rounded p-2">
            {nodeData.error}
          </div>
        )}

        {/* Output Video Preview */}
        {nodeData.outputVideo && (
          <div className="space-y-2">
            <label className="text-[10px] text-neutral-400 block">Output</label>
            <div className="relative bg-black rounded overflow-hidden aspect-video">
              <video
                src={nodeData.outputVideo}
                controls
                className="w-full h-full object-contain"
              />
            </div>
            <button
              onClick={handleDownload}
              className="w-full py-1.5 px-3 rounded text-xs font-medium bg-neutral-700 hover:bg-neutral-600 text-neutral-200 transition-colors"
            >
              Download
            </button>
          </div>
        )}
      </div>
    </BaseNode>
  );
});
