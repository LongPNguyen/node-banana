"use client";

import { useCallback, memo, useRef, useMemo, useState } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { VideoStitchNodeData, VideoGenerateNodeData, WorkflowNode } from "@/types";

type VideoStitchNodeType = Node<VideoStitchNodeData, "videoStitch">;

export const VideoStitchNode = memo(({ id, data, selected }: NodeProps<VideoStitchNodeType>) => {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [isStitching, setIsStitching] = useState(false);

  // Get connected video nodes and their videos, sorted by chunkIndex
  const connectedVideos = useMemo(() => {
    // Find all edges connecting to this node's video input
    const videoEdges = edges.filter(
      (e) => e.target === id && e.targetHandle === "video"
    );

    // Get the source video nodes
    const videoSources: { nodeId: string; video: string | null; chunkIndex: number }[] = [];

    for (const edge of videoEdges) {
      const sourceNode = nodes.find((n) => n.id === edge.source) as WorkflowNode | undefined;
      if (sourceNode?.type === "videoGenerate") {
        const videoData = sourceNode.data as VideoGenerateNodeData;
        videoSources.push({
          nodeId: sourceNode.id,
          video: videoData.outputVideo,
          chunkIndex: videoData.chunkIndex || 1,
        });
      }
    }

    // Sort by chunkIndex
    return videoSources.sort((a, b) => a.chunkIndex - b.chunkIndex);
  }, [id, nodes, edges]);

  const handleClear = useCallback(() => {
    updateNodeData(id, { outputVideo: null, inputVideos: [], status: "idle", error: null });
  }, [id, updateNodeData]);

  const handleDownload = useCallback(() => {
    if (!nodeData.outputVideo) return;

    const link = document.createElement("a");
    link.href = nodeData.outputVideo;
    link.download = `stitched-video-${Date.now()}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [nodeData.outputVideo]);

  const handleIterationCountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1));
      updateNodeData(id, { iterationCount: value });
    },
    [id, updateNodeData]
  );

  const handleBrowseFolder = useCallback(async () => {
    setIsBrowsing(true);
    try {
      const response = await fetch("/api/browse-directory");
      const result = await response.json();

      if (result.success && !result.cancelled && result.path) {
        updateNodeData(id, { outputFolder: result.path });
      }
    } catch (error) {
      console.error("Failed to browse folder:", error);
    } finally {
      setIsBrowsing(false);
    }
  }, [id, updateNodeData]);

  const handleClearFolder = useCallback(() => {
    updateNodeData(id, { outputFolder: null });
  }, [id, updateNodeData]);

  // Stitch only - just combine existing videos without regenerating
  const handleStitchOnly = useCallback(async () => {
    if (isStitching || isRunning) return;

    const videosToStitch = connectedVideos
      .filter(v => v.video)
      .map(v => ({ video: v.video!, chunkIndex: v.chunkIndex }));

    if (videosToStitch.length === 0) {
      updateNodeData(id, { status: "error", error: "No videos ready to stitch" });
      return;
    }

    setIsStitching(true);
    updateNodeData(id, { status: "loading", error: null });

    try {
      const response = await fetch("/api/video-stitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videos: videosToStitch }),
      });

      const result = await response.json();
      if (result.success) {
        // Save to folder if set
        if (nodeData.outputFolder) {
          const filename = `stitched_${new Date().toISOString().replace(/[:.]/g, "-")}.mp4`;
          await fetch("/api/save-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              video: result.video,
              folder: nodeData.outputFolder,
              filename,
            }),
          });
        }
        updateNodeData(id, {
          inputVideos: videosToStitch.map(v => ({ ...v, sourceNodeId: "" })),
          outputVideo: result.video,
          status: "complete",
          error: null,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      updateNodeData(id, {
        status: "error",
        error: error instanceof Error ? error.message : "Stitching failed",
      });
    } finally {
      setIsStitching(false);
    }
  }, [id, connectedVideos, nodeData.outputFolder, isStitching, isRunning, updateNodeData]);

  // Regenerate all - regenerate connected videos then stitch
  const handleRegenerateAll = useCallback(() => {
    if (isRunning) return;
    regenerateNode(id);
  }, [id, isRunning, regenerateNode]);

  const readyVideoCount = connectedVideos.filter(v => v.video).length;
  const totalConnections = connectedVideos.length;

  return (
    <BaseNode
      id={id}
      title="Video Stitch"
      selected={selected}
      hasError={nodeData.status === "error"}
      minWidth={340}
      minHeight={380}
    >
      {/* Video inputs (accepts multiple) */}
      <Handle
        type="target"
        position={Position.Left}
        id="video"
        style={{ top: "50%" }}
        data-handletype="video"
      />

      {/* Video output */}
      <Handle
        type="source"
        position={Position.Right}
        id="video"
        style={{ top: "50%" }}
        data-handletype="video"
      />

      <div className="flex-1 flex flex-col min-h-0 gap-2">
        {/* Connection Status */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[9px] text-neutral-500">
            {totalConnections > 0
              ? `${readyVideoCount}/${totalConnections} videos ready`
              : "Connect video nodes"
            }
          </span>
          {totalConnections > 0 && (
            <span className="text-[8px] text-neutral-600">
              Sorted by chunk #
            </span>
          )}
        </div>

        {/* Iteration Settings */}
        <div className="flex gap-2 items-center px-1">
          <div className="flex items-center gap-1.5">
            <label className="text-[9px] text-neutral-500">Iterations:</label>
            <input
              type="number"
              min="1"
              max="99"
              value={nodeData.iterationCount ?? 1}
              onChange={handleIterationCountChange}
              className="nodrag w-12 px-1.5 py-0.5 text-[10px] bg-neutral-800 border border-neutral-700 rounded text-neutral-200 text-center focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          {nodeData.currentIteration > 0 && (
            <span className="text-[9px] text-teal-400">
              Running {nodeData.currentIteration}/{nodeData.iterationCount}
            </span>
          )}
        </div>

        {/* Output Folder */}
        <div className="flex flex-col gap-1 px-1">
          <label className="text-[9px] text-neutral-500">Output Folder (for iterations):</label>
          <div className="flex gap-1">
            <div className="flex-1 px-2 py-1 text-[9px] bg-neutral-800 border border-neutral-700 rounded text-neutral-400 truncate">
              {nodeData.outputFolder || "Not set (will download)"}
            </div>
            <button
              onClick={handleBrowseFolder}
              disabled={isBrowsing}
              className="px-2 py-1 text-[9px] bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 rounded text-neutral-300 transition-colors"
            >
              {isBrowsing ? "..." : "Browse"}
            </button>
            {nodeData.outputFolder && (
              <button
                onClick={handleClearFolder}
                className="px-1.5 py-1 text-[9px] bg-neutral-700 hover:bg-red-600/50 rounded text-neutral-400 hover:text-white transition-colors"
                title="Clear folder"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Connected Videos List */}
        {totalConnections > 0 && (
          <div className="nodrag nopan nowheel max-h-[80px] overflow-y-auto space-y-1 px-1">
            {connectedVideos.map((cv, idx) => (
              <div
                key={cv.nodeId}
                className={`flex items-center gap-2 px-2 py-1 rounded text-[9px] ${
                  cv.video
                    ? "bg-green-900/30 border border-green-700/50 text-green-300"
                    : "bg-neutral-800/50 border border-neutral-700/50 text-neutral-500"
                }`}
              >
                <span className="font-mono">{idx + 1}.</span>
                <span>Chunk {cv.chunkIndex}</span>
                <span className="text-[8px] text-neutral-500 ml-auto">
                  {cv.video ? "Ready" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Preview Area */}
        <div className="relative w-full flex-1 min-h-[140px] border border-dashed border-neutral-600 rounded overflow-hidden bg-black/20 group">
          {nodeData.outputVideo ? (
            <video
              ref={videoRef}
              src={nodeData.outputVideo}
              controls
              className="w-full h-full object-contain"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-2 p-4 text-center">
              {nodeData.status === "loading" ? (
                <>
                  <svg className="w-6 h-6 animate-spin text-neutral-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-[10px] text-neutral-400">Stitching videos...</span>
                  <span className="text-[9px] text-neutral-500">This may take a moment</span>
                </>
              ) : nodeData.status === "error" ? (
                <span className="text-[10px] text-red-400">{nodeData.error || "Failed"}</span>
              ) : totalConnections === 0 ? (
                <>
                  <svg className="w-6 h-6 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m14.25 0h1.5" />
                  </svg>
                  <span className="text-neutral-500 text-[10px]">Connect video nodes</span>
                  <span className="text-neutral-600 text-[8px]">Videos will be ordered by chunk #</span>
                </>
              ) : readyVideoCount < totalConnections ? (
                <>
                  <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-yellow-500 text-[10px]">Waiting for videos...</span>
                  <span className="text-neutral-600 text-[8px]">{readyVideoCount}/{totalConnections} ready</span>
                </>
              ) : (
                <>
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-green-500 text-[10px]">All videos ready</span>
                  <span className="text-neutral-600 text-[8px]">Click execute to stitch</span>
                </>
              )}
            </div>
          )}

          {nodeData.outputVideo && (
            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleDownload}
                className="w-5 h-5 bg-neutral-900/80 hover:bg-green-600/80 rounded flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                title="Download"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
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

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleStitchOnly}
            disabled={isStitching || isRunning || readyVideoCount === 0}
            className="nodrag flex-1 py-2 px-3 text-[10px] font-medium bg-teal-600 hover:bg-teal-500 disabled:bg-neutral-700 disabled:text-neutral-500 rounded text-white transition-colors flex items-center justify-center gap-1.5"
            title="Stitch existing videos without regenerating"
          >
            {isStitching ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Stitching...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                Stitch Only
              </>
            )}
          </button>
          <button
            onClick={handleRegenerateAll}
            disabled={isRunning || totalConnections === 0}
            className="nodrag flex-1 py-2 px-3 text-[10px] font-medium bg-purple-600 hover:bg-purple-500 disabled:bg-neutral-700 disabled:text-neutral-500 rounded text-white transition-colors flex items-center justify-center gap-1.5"
            title={`Regenerate all ${totalConnections} videos and stitch (${nodeData.iterationCount || 1} iteration${(nodeData.iterationCount || 1) > 1 ? 's' : ''})`}
          >
            {isRunning && nodeData.status === "loading" ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Running...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Regen All
              </>
            )}
          </button>
        </div>
      </div>
    </BaseNode>
  );
});

VideoStitchNode.displayName = "VideoStitchNode";
