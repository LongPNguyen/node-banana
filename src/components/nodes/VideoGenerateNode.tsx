"use client";

import { useCallback, memo } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { ExecuteButton } from "./ExecuteButton";
import { useWorkflowStore } from "@/store/workflowStore";
import { VideoGenerateNodeData } from "@/types";

type VideoGenerateNodeType = Node<VideoGenerateNodeData, "videoGenerate">;

export const VideoGenerateNode = memo(({ id, data, selected }: NodeProps<VideoGenerateNodeType>) => {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);

  const handleDurationChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { duration: parseInt(e.target.value, 10) });
    },
    [id, updateNodeData]
  );

  const handleRegenerate = useCallback(() => {
    regenerateNode(id);
  }, [id, regenerateNode]);

  const handleClear = useCallback(() => {
    updateNodeData(id, { outputVideo: null, lastFrame: null, status: "idle", error: null });
  }, [id, updateNodeData]);

  return (
    <BaseNode
      id={id}
      title="Video Generate"
      selected={selected}
      hasError={nodeData.status === "error"}
    >
      {/* Image input (Start Frame) */}
      <Handle
        type="target"
        position={Position.Left}
        id="image"
        style={{ top: "30%" }}
        data-handletype="image"
      />
      {/* Text input (Motion Prompt) */}
      <Handle
        type="target"
        position={Position.Left}
        id="text"
        style={{ top: "70%" }}
        data-handletype="text"
      />

      {/* Video output */}
      <Handle
        type="source"
        position={Position.Right}
        id="video"
        style={{ top: "30%" }}
        data-handletype="video"
      />
      {/* Image output (Last Frame for chaining) */}
      <Handle
        type="source"
        position={Position.Right}
        id="image"
        style={{ top: "70%" }}
        data-handletype="image"
      />

      <div className="flex-1 flex flex-col min-h-0 gap-2">
        {/* Preview Area */}
        <div className="relative w-full flex-1 min-h-[120px] border border-dashed border-neutral-600 rounded overflow-hidden bg-black/20">
          {nodeData.outputVideo ? (
            <video
              src={nodeData.outputVideo}
              controls
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-2 p-4 text-center">
              {nodeData.status === "loading" ? (
                <svg className="w-6 h-6 animate-spin text-neutral-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : nodeData.status === "error" ? (
                <span className="text-[10px] text-red-400">{nodeData.error || "Failed"}</span>
              ) : (
                <>
                  <svg className="w-6 h-6 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  <span className="text-neutral-500 text-[10px]">Connect image & prompt to generate video</span>
                </>
              )}
            </div>
          )}

          {nodeData.outputVideo && (
            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleRegenerate}
                disabled={isRunning}
                className="w-5 h-5 bg-neutral-900/80 hover:bg-blue-600/80 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                title="Regenerate"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={handleClear}
                className="w-5 h-5 bg-neutral-900/80 hover:bg-red-600/80 rounded flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                title="Clear"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-neutral-500">Duration</label>
            <select
              value={nodeData.duration}
              onChange={handleDurationChange}
              className="text-[10px] py-0.5 px-1.5 border border-neutral-700 rounded bg-neutral-900/50 text-neutral-300"
            >
              <option value={4}>4 Seconds</option>
              <option value={5}>5 Seconds</option>
              <option value={10}>10 Seconds</option>
            </select>
          </div>

          {nodeData.lastFrame && (
            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-neutral-500 uppercase tracking-wider">Next Start Frame</span>
              <div className="w-16 h-16 rounded border border-neutral-700 overflow-hidden">
                <img src={nodeData.lastFrame} className="w-full h-full object-cover" alt="Last frame" />
              </div>
            </div>
          )}

          {/* Execute button */}
          <ExecuteButton nodeId={id} />
        </div>
      </div>
    </BaseNode>
  );
});

VideoGenerateNode.displayName = "VideoGenerateNode";

