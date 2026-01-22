"use client";

import { memo, useCallback, useState } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { GreenScreenNodeData } from "@/types";

const STEP_LABELS = {
  idle: "Ready",
  extracting: "Extracting frame...",
  generating: "Generating green screen...",
  capturing: "Motion capture...",
  complete: "Complete",
};

export const GreenScreenNode = memo(function GreenScreenNode({
  id,
  data,
  selected,
}: NodeProps) {
  const nodeData = data as GreenScreenNodeData;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const getConnectedInputs = useWorkflowStore((state) => state.getConnectedInputs);

  const [isProcessing, setIsProcessing] = useState(false);

  // Get connected video input
  const connectedInputs = getConnectedInputs(id);
  const hasVideo = !!connectedInputs.video;

  const handleProcess = useCallback(async () => {
    const inputs = getConnectedInputs(id);

    if (!inputs.video) {
      updateNodeData(id, { error: "No video connected. Connect a video input." });
      return;
    }

    setIsProcessing(true);
    updateNodeData(id, {
      status: "loading",
      error: null,
      currentStep: "extracting",
      inputVideo: inputs.video,
    });

    try {
      const response = await fetch("/api/green-screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video: inputs.video,
          prompt: nodeData.prompt || "same person standing on solid bright green screen background, full body visible, same pose, same clothing, same appearance, studio lighting",
          resolution: nodeData.resolution,
          greenColor: nodeData.greenColor,
        }),
      });

      const result = await response.json();

      if (result.success) {
        updateNodeData(id, {
          extractedFrame: result.extractedFrame,
          greenScreenImage: result.greenScreenImage,
          outputVideo: result.video,
          lastFrame: result.lastFrame,
          status: "complete",
          currentStep: "complete",
        });
      } else {
        updateNodeData(id, {
          status: "error",
          error: result.error || "Processing failed",
          currentStep: "idle",
        });
      }
    } catch (error) {
      console.error("[GreenScreen] Error:", error);
      updateNodeData(id, {
        status: "error",
        error: error instanceof Error ? error.message : "Processing failed",
        currentStep: "idle",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [id, nodeData.prompt, nodeData.resolution, nodeData.greenColor, getConnectedInputs, updateNodeData]);

  const handleDownload = useCallback(() => {
    if (!nodeData.outputVideo) return;

    const link = document.createElement("a");
    link.href = nodeData.outputVideo;
    link.download = `green-screen-${Date.now()}.mp4`;
    link.click();
  }, [nodeData.outputVideo]);

  return (
    <BaseNode id={id} selected={selected} title="Green Screen">
      {/* Input Handle - Video */}
      <Handle
        type="target"
        position={Position.Left}
        id="video"
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-neutral-800"
        style={{ top: "50%" }}
        title="Video Input"
      />

      {/* Output Handle - Video */}
      <Handle
        type="source"
        position={Position.Right}
        id="video"
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-neutral-800"
        style={{ top: "50%" }}
        title="Video Output (Green Screen)"
      />

      <div className="p-3 space-y-3">
        {/* Connection Status */}
        <div className="text-[10px] text-neutral-400 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${hasVideo ? "bg-pink-500" : "bg-neutral-600"}`} />
          <span>Video: {hasVideo ? "Connected" : "Not connected"}</span>
        </div>

        {/* Custom Prompt */}
        <div>
          <label className="text-[10px] text-neutral-400 block mb-1">
            Green Screen Prompt (optional)
          </label>
          <textarea
            value={nodeData.prompt}
            onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
            placeholder="same person on green screen background..."
            className="w-full px-2 py-1.5 text-xs bg-neutral-700 border border-neutral-600 rounded text-neutral-200 resize-none"
            rows={2}
          />
        </div>

        {/* Resolution */}
        <div>
          <label className="text-[10px] text-neutral-400 block mb-1">Resolution</label>
          <select
            value={nodeData.resolution}
            onChange={(e) => updateNodeData(id, { resolution: e.target.value as "720p" | "1080p" })}
            className="w-full px-2 py-1 text-xs bg-neutral-700 border border-neutral-600 rounded text-neutral-200"
          >
            <option value="720p">720p (Faster)</option>
            <option value="1080p">1080p (Higher Quality)</option>
          </select>
        </div>

        {/* Green Color */}
        <div>
          <label className="text-[10px] text-neutral-400 block mb-1">Green Screen Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={nodeData.greenColor}
              onChange={(e) => updateNodeData(id, { greenColor: e.target.value })}
              className="w-8 h-8 rounded border border-neutral-600 cursor-pointer"
            />
            <input
              type="text"
              value={nodeData.greenColor}
              onChange={(e) => updateNodeData(id, { greenColor: e.target.value })}
              className="flex-1 px-2 py-1 text-xs bg-neutral-700 border border-neutral-600 rounded text-neutral-200"
            />
          </div>
        </div>

        {/* Process Button */}
        <button
          onClick={handleProcess}
          disabled={isProcessing || !hasVideo}
          className={`w-full py-2 px-3 rounded text-xs font-medium transition-colors ${
            isProcessing
              ? "bg-green-600 text-white cursor-wait"
              : hasVideo
              ? "bg-green-500 hover:bg-green-600 text-white"
              : "bg-neutral-700 text-neutral-500 cursor-not-allowed"
          }`}
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {STEP_LABELS[nodeData.currentStep] || "Processing..."}
            </span>
          ) : (
            "Generate Green Screen"
          )}
        </button>

        {/* Progress Steps */}
        {isProcessing && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[10px]">
              <span className={`w-2 h-2 rounded-full ${nodeData.currentStep === "extracting" ? "bg-yellow-500 animate-pulse" : nodeData.currentStep !== "idle" ? "bg-green-500" : "bg-neutral-600"}`} />
              <span className={nodeData.currentStep === "extracting" ? "text-yellow-400" : "text-neutral-400"}>Extract first frame</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className={`w-2 h-2 rounded-full ${nodeData.currentStep === "generating" ? "bg-yellow-500 animate-pulse" : ["capturing", "complete"].includes(nodeData.currentStep) ? "bg-green-500" : "bg-neutral-600"}`} />
              <span className={nodeData.currentStep === "generating" ? "text-yellow-400" : "text-neutral-400"}>Generate green screen image</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className={`w-2 h-2 rounded-full ${nodeData.currentStep === "capturing" ? "bg-yellow-500 animate-pulse" : nodeData.currentStep === "complete" ? "bg-green-500" : "bg-neutral-600"}`} />
              <span className={nodeData.currentStep === "capturing" ? "text-yellow-400" : "text-neutral-400"}>Motion capture</span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {nodeData.error && (
          <div className="text-[10px] text-red-400 bg-red-900/20 rounded p-2">
            {nodeData.error}
          </div>
        )}

        {/* Intermediate Previews */}
        {(nodeData.extractedFrame || nodeData.greenScreenImage) && (
          <div className="space-y-2">
            <label className="text-[10px] text-neutral-400 block">Intermediate Steps</label>
            <div className="grid grid-cols-2 gap-2">
              {nodeData.extractedFrame && (
                <div>
                  <span className="text-[9px] text-neutral-500 block mb-1">First Frame</span>
                  <img
                    src={nodeData.extractedFrame}
                    alt="Extracted frame"
                    className="w-full rounded border border-neutral-700"
                  />
                </div>
              )}
              {nodeData.greenScreenImage && (
                <div>
                  <span className="text-[9px] text-neutral-500 block mb-1">Green Screen</span>
                  <img
                    src={nodeData.greenScreenImage}
                    alt="Green screen"
                    className="w-full rounded border border-neutral-700"
                  />
                </div>
              )}
            </div>
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
