"use client";

import { useCallback, memo, useRef, useEffect, useState, useMemo } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { ExecuteButton } from "./ExecuteButton";
import { useWorkflowStore } from "@/store/workflowStore";
import { VideoGenerateNodeData, VideoAspectRatio, VideoResolution, VideoDuration, VideoModel } from "@/types";

type VideoGenerateNodeType = Node<VideoGenerateNodeData, "videoGenerate">;

export const VideoGenerateNode = memo(({ id, data, selected }: NodeProps<VideoGenerateNodeType>) => {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const edges = useWorkflowStore((state) => state.edges);
  const nodes = useWorkflowStore((state) => state.nodes);
  const getConnectedInputs = useWorkflowStore((state) => state.getConnectedInputs);
  const videoRef = useRef<HTMLVideoElement>(null);
  const extractedVideoRef = useRef<string | null>(null); // Track which video we've extracted from

  // Get actual reference image count (including passthrough) - updates when edges or nodes change
  const actualRefCount = useMemo(() => {
    const inputs = getConnectedInputs(id);
    return inputs.referenceImages.length;
  }, [id, getConnectedInputs, edges, nodes]);

  // Extract last frame when video loads (only once per video)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !nodeData.outputVideo) return;

    // Skip if we've already extracted from this video
    if (extractedVideoRef.current === nodeData.outputVideo) return;

    let hasExtracted = false;

    const captureFrame = () => {
      if (hasExtracted) return;
      hasExtracted = true;

      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const lastFrameDataUrl = canvas.toDataURL("image/png"); // Use PNG for lossless quality in video chains
          if (lastFrameDataUrl && lastFrameDataUrl.length > 100) {
            extractedVideoRef.current = nodeData.outputVideo;
            updateNodeData(id, { lastFrame: lastFrameDataUrl });
          }
        }
      } catch (e) {
        console.error("Failed to extract last frame:", e);
      }
      // Reset to beginning for playback
      video.currentTime = 0;
    };

    const extractLastFrame = () => {
      if (hasExtracted) return;
      // Seek to the exact end to capture the last frame
      video.currentTime = video.duration;
    };

    video.addEventListener("loadedmetadata", extractLastFrame);
    video.addEventListener("seeked", captureFrame);

    // If video is already loaded, trigger extraction
    if (video.readyState >= 1 && video.duration > 0) {
      extractLastFrame();
    }

    return () => {
      video.removeEventListener("loadedmetadata", extractLastFrame);
      video.removeEventListener("seeked", captureFrame);
    };
  }, [nodeData.outputVideo, id, updateNodeData]);

  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { model: e.target.value as VideoModel });
    },
    [id, updateNodeData]
  );

  const handleChunkIndexChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Math.max(1, parseInt(e.target.value, 10) || 1);
      updateNodeData(id, { chunkIndex: value });
    },
    [id, updateNodeData]
  );

  const handleDurationChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { duration: parseInt(e.target.value, 10) as VideoDuration });
    },
    [id, updateNodeData]
  );

  const handleAspectRatioChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { aspectRatio: e.target.value as VideoAspectRatio });
    },
    [id, updateNodeData]
  );

  const handleResolutionChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { resolution: e.target.value as VideoResolution });
    },
    [id, updateNodeData]
  );

  const handleRegenerate = useCallback(() => {
    regenerateNode(id);
  }, [id, regenerateNode]);

  const handleClear = useCallback(() => {
    updateNodeData(id, { outputVideo: null, lastFrame: null, status: "idle", error: null });
  }, [id, updateNodeData]);

  const [isExtractingFrame, setIsExtractingFrame] = useState(false);

  // Trim controls state
  const [showTrimControls, setShowTrimControls] = useState(false);
  const [trimStartTime, setTrimStartTime] = useState<number>(0);
  const [trimEndTime, setTrimEndTime] = useState<number | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimPreviewFrame, setTrimPreviewFrame] = useState<string | null>(null);
  const [activePreview, setActivePreview] = useState<"start" | "end">("end"); // Which slider is being previewed
  const FRAME_STEP = 1 / 30; // ~33ms for 30fps

  // Get video duration when video loads
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !nodeData.outputVideo) {
      setVideoDuration(null);
      setTrimStartTime(0);
      setTrimEndTime(null);
      return;
    }

    const handleLoadedMetadata = () => {
      setVideoDuration(video.duration);
      setTrimStartTime(0); // Default to start
      setTrimEndTime(video.duration); // Default to full length
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    if (video.duration) {
      handleLoadedMetadata();
    }

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [nodeData.outputVideo]);

  // Capture frame at trim point for preview
  const captureFrameAtTime = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;

    const captureOnSeek = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const frameDataUrl = canvas.toDataURL("image/png");
          setTrimPreviewFrame(frameDataUrl);
        }
      } catch (e) {
        console.error("Failed to capture frame:", e);
      }
      video.removeEventListener("seeked", captureOnSeek);
    };

    video.addEventListener("seeked", captureOnSeek);
    video.currentTime = time;
  }, []);

  // Update preview when trim time changes
  useEffect(() => {
    if (showTrimControls && trimEndTime !== null && videoDuration !== null) {
      // Preview the active slider position
      const previewTime = activePreview === "start"
        ? Math.max(0, trimStartTime + 0.01)  // Slightly after start
        : Math.max(0, trimEndTime - 0.01);   // Slightly before end
      captureFrameAtTime(previewTime);
    }
  }, [trimStartTime, trimEndTime, showTrimControls, videoDuration, activePreview, captureFrameAtTime]);

  // Handle trim slider changes
  const handleTrimStartChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setTrimStartTime(Math.min(value, (trimEndTime ?? videoDuration ?? value) - 0.1));
    setActivePreview("start");
  }, [trimEndTime, videoDuration]);

  const handleTrimEndChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setTrimEndTime(Math.max(value, trimStartTime + 0.1));
    setActivePreview("end");
  }, [trimStartTime]);

  // Frame-by-frame navigation for start time
  const handleStartFrameStep = useCallback((direction: "back" | "forward") => {
    if (trimEndTime === null || videoDuration === null) return;
    const step = direction === "forward" ? FRAME_STEP : -FRAME_STEP;
    const newTime = Math.max(0, Math.min(trimEndTime - 0.1, trimStartTime + step));
    setTrimStartTime(newTime);
    setActivePreview("start");
  }, [trimStartTime, trimEndTime, videoDuration, FRAME_STEP]);

  // Frame-by-frame navigation for end time
  const handleEndFrameStep = useCallback((direction: "back" | "forward") => {
    if (trimEndTime === null || videoDuration === null) return;
    const step = direction === "forward" ? FRAME_STEP : -FRAME_STEP;
    const newTime = Math.max(trimStartTime + 0.1, Math.min(videoDuration, trimEndTime + step));
    setTrimEndTime(newTime);
    setActivePreview("end");
  }, [trimStartTime, trimEndTime, videoDuration, FRAME_STEP]);

  // Apply trim
  const handleApplyTrim = useCallback(async () => {
    if (!nodeData.outputVideo || trimEndTime === null || isTrimming) return;

    setIsTrimming(true);
    try {
      const response = await fetch("/api/video-trim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video: nodeData.outputVideo,
          startTime: trimStartTime,
          endTime: trimEndTime,
        }),
      });

      const result = await response.json();
      if (result.success) {
        // Save original video for undo (only on first trim)
        const updates: Partial<VideoGenerateNodeData> = {
          outputVideo: result.video,
          lastFrame: result.frame || nodeData.lastFrame,
        };
        if (!nodeData.originalVideo) {
          updates.originalVideo = nodeData.outputVideo;
        }
        updateNodeData(id, updates);
        setShowTrimControls(false);
        setTrimPreviewFrame(null);
        console.log(`[VideoGenerate] Trimmed video from ${trimStartTime.toFixed(3)}s to ${trimEndTime.toFixed(3)}s`);
      } else {
        console.error("[VideoGenerate] Trim failed:", result.error);
        alert(`Trim failed: ${result.error}`);
      }
    } catch (error) {
      console.error("[VideoGenerate] Trim error:", error);
      alert(`Trim error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsTrimming(false);
    }
  }, [id, nodeData.outputVideo, nodeData.originalVideo, nodeData.lastFrame, trimStartTime, trimEndTime, isTrimming, updateNodeData]);

  // Undo trim - restore original video
  const handleUndoTrim = useCallback(() => {
    if (!nodeData.originalVideo) return;
    updateNodeData(id, {
      outputVideo: nodeData.originalVideo,
      originalVideo: null,
      lastFrame: null, // Will need re-extraction
    });
    setTrimStartTime(0);
    console.log("[VideoGenerate] Undo trim - restored original video");
  }, [id, nodeData.originalVideo, updateNodeData]);

  const handleReExtractFrame = useCallback(async () => {
    if (!nodeData.outputVideo || isExtractingFrame) return;

    setIsExtractingFrame(true);
    try {
      const response = await fetch("/api/extract-frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video: nodeData.outputVideo }),
      });

      const result = await response.json();
      if (result.success && result.frame) {
        updateNodeData(id, { lastFrame: result.frame });
        console.log("[VideoGenerate] Successfully re-extracted last frame");
      } else {
        console.error("[VideoGenerate] Failed to extract frame:", result.error);
      }
    } catch (error) {
      console.error("[VideoGenerate] Error extracting frame:", error);
    } finally {
      setIsExtractingFrame(false);
    }
  }, [id, nodeData.outputVideo, isExtractingFrame, updateNodeData]);

  // Use actual reference count from getConnectedInputs (includes passthrough)
  // Don't fall back to stored data - it may be stale from previous execution
  const refCount = actualRefCount;

  return (
    <BaseNode
      id={id}
      title="Video Generate (Veo 3.1)"
      selected={selected}
      hasError={nodeData.status === "error"}
      minWidth={340}
      minHeight={580}
    >
      {/* Color-coded handles - see legend in node */}

      {/* INPUTS (left side) */}
      {/* Start Frame - green */}
      <Handle
        type="target"
        position={Position.Left}
        id="image"
        style={{ top: "15%", background: "#22c55e" }}
        data-handletype="image"
      />
      {/* Reference images - purple */}
      <Handle
        type="target"
        position={Position.Left}
        id="reference"
        style={{ top: "38%", background: "#a855f7" }}
        data-handletype="image"
      />
      {/* Text prompt - blue */}
      <Handle
        type="target"
        position={Position.Left}
        id="text"
        style={{ top: "61%", background: "#3b82f6" }}
        data-handletype="text"
      />
      {/* Context - yellow */}
      <Handle
        type="target"
        position={Position.Left}
        id="context"
        style={{ top: "84%", background: "#eab308" }}
        data-handletype="text"
      />

      {/* OUTPUTS (right side) */}
      {/* Video output - red */}
      <Handle
        type="source"
        position={Position.Right}
        id="video"
        style={{ top: "15%", background: "#ef4444" }}
        data-handletype="video"
      />
      {/* Reference passthrough - purple */}
      <Handle
        type="source"
        position={Position.Right}
        id="reference"
        style={{ top: "38%", background: "#a855f7" }}
        data-handletype="image"
      />
      {/* Last Frame output - green */}
      <Handle
        type="source"
        position={Position.Right}
        id="image"
        style={{ top: "84%", background: "#22c55e" }}
        data-handletype="image"
      />

      <div className="flex-1 flex flex-col min-h-0 gap-2">
        {/* Input indicators */}
        {(nodeData.inputImage || refCount > 0) && (
          <div className="flex gap-2 items-center">
            {nodeData.inputImage && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-neutral-900/50 rounded border border-neutral-700">
                <div className="w-6 h-6 rounded overflow-hidden">
                  <img src={nodeData.inputImage} className="w-full h-full object-cover" alt="Start frame" />
                </div>
                <span className="text-[8px] text-neutral-400">Start</span>
              </div>
            )}
            {refCount > 0 && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-900/30 rounded border border-purple-700/50">
                <span className="text-[9px] text-purple-300">+{refCount} ref</span>
              </div>
            )}
          </div>
        )}

        {/* Preview Area */}
        <div className="relative w-full flex-1 min-h-[140px] border border-dashed border-neutral-600 rounded overflow-hidden bg-black/20 group">
          {nodeData.outputVideo ? (
            <video
              key={nodeData.outputVideo.length} // Force reload when video changes (e.g., after trim)
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
                  <span className="text-[10px] text-neutral-400">Generating video...</span>
                  <span className="text-[9px] text-neutral-500">This may take 30s - 2min</span>
                </>
              ) : nodeData.status === "error" ? (
                <span className="text-[10px] text-red-400">{nodeData.error || "Failed"}</span>
              ) : (
                <>
                  <svg className="w-6 h-6 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  <span className="text-neutral-500 text-[10px]">Connect image & prompt</span>
                  <span className="text-neutral-600 text-[8px]">Top=start frame, 2nd=reference (optional)</span>
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

        {/* Model Selector */}
        <div className="flex flex-col gap-0.5">
          <label className="text-[9px] text-neutral-500 uppercase tracking-wider">Model</label>
          <select
            value={nodeData.model ?? "veo-3.1-fast"}
            onChange={handleModelChange}
            className="text-[10px] py-1 px-1.5 border border-neutral-700 rounded bg-neutral-900/50 text-neutral-300"
          >
            <optgroup label="Google Veo">
              <option value="veo-3.1-fast">Veo 3.1 Fast</option>
              <option value="veo-3.1">Veo 3.1 (Higher Quality)</option>
            </optgroup>
            <optgroup label="Kie AI">
              <option value="kieai-veo3-fast">Kie AI Veo 3.1 Fast</option>
              <option value="kieai-veo3">Kie AI Veo 3.1</option>
            </optgroup>
          </select>
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-4 gap-2">
          <div className="flex flex-col gap-0.5">
            <label className="text-[9px] text-neutral-500 uppercase tracking-wider">Chunk #</label>
            <input
              type="number"
              min={1}
              value={nodeData.chunkIndex ?? 1}
              onChange={handleChunkIndexChange}
              className="nodrag text-[10px] py-1 px-1.5 border border-neutral-700 rounded bg-neutral-900/50 text-neutral-300 w-full"
              title="Which chunk to use when connected to a Syllable Chunker"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <label className="text-[9px] text-neutral-500 uppercase tracking-wider">Duration</label>
            <select
              value={nodeData.duration}
              onChange={handleDurationChange}
              className="text-[10px] py-1 px-1.5 border border-neutral-700 rounded bg-neutral-900/50 text-neutral-300"
            >
              <option value={4}>4 sec</option>
              <option value={6}>6 sec</option>
              <option value={8}>8 sec</option>
            </select>
          </div>

          <div className="flex flex-col gap-0.5">
            <label className="text-[9px] text-neutral-500 uppercase tracking-wider">Aspect</label>
            <select
              value={nodeData.aspectRatio}
              onChange={handleAspectRatioChange}
              className="text-[10px] py-1 px-1.5 border border-neutral-700 rounded bg-neutral-900/50 text-neutral-300"
            >
              <option value="9:16">9:16</option>
              <option value="16:9">16:9</option>
            </select>
          </div>

          <div className="flex flex-col gap-0.5">
            <label className="text-[9px] text-neutral-500 uppercase tracking-wider">Quality</label>
            <select
              value={nodeData.resolution}
              onChange={handleResolutionChange}
              className="text-[10px] py-1 px-1.5 border border-neutral-700 rounded bg-neutral-900/50 text-neutral-300"
            >
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
              <option value="4k">4K</option>
            </select>
          </div>
        </div>

        {/* Trim Controls */}
        {nodeData.outputVideo && videoDuration && (
          <div className="border border-neutral-700 rounded p-2 bg-neutral-900/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-neutral-500 uppercase tracking-wider">Trim Video</span>
                {nodeData.originalVideo && (
                  <button
                    onClick={handleUndoTrim}
                    className="nodrag text-[8px] px-1.5 py-0.5 bg-yellow-600/80 hover:bg-yellow-500 rounded text-white"
                    title="Restore original video"
                  >
                    Undo
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowTrimControls(!showTrimControls)}
                className="text-[9px] text-blue-400 hover:text-blue-300"
              >
                {showTrimControls ? "Hide" : "Show"}
              </button>
            </div>

            {showTrimControls && (
              <div className="space-y-3">
                {/* Trim preview */}
                {trimPreviewFrame && (
                  <div className="relative">
                    <img
                      src={trimPreviewFrame}
                      alt="Trim point preview"
                      className="w-full h-20 object-contain bg-black rounded border border-neutral-700"
                    />
                    <span className="absolute bottom-1 right-1 text-[8px] bg-black/80 px-1 rounded text-neutral-300">
                      {activePreview === "start" ? "Start" : "End"}: {activePreview === "start" ? trimStartTime.toFixed(3) : trimEndTime?.toFixed(3)}s
                    </span>
                  </div>
                )}

                {/* Start time slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] text-green-400 font-medium">Start Time</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartFrameStep("back")}
                        disabled={isTrimming}
                        className="nodrag px-1.5 py-0.5 text-[8px] bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 rounded text-neutral-300"
                        title="Previous frame"
                      >
                        ←
                      </button>
                      <span className="text-[8px] text-green-400 font-mono w-12 text-center">{trimStartTime.toFixed(3)}s</span>
                      <button
                        onClick={() => handleStartFrameStep("forward")}
                        disabled={isTrimming}
                        className="nodrag px-1.5 py-0.5 text-[8px] bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 rounded text-neutral-300"
                        title="Next frame"
                      >
                        →
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={videoDuration}
                    step={0.001}
                    value={trimStartTime}
                    onChange={handleTrimStartChange}
                    className="nodrag w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                  />
                </div>

                {/* End time slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] text-blue-400 font-medium">End Time</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEndFrameStep("back")}
                        disabled={isTrimming}
                        className="nodrag px-1.5 py-0.5 text-[8px] bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 rounded text-neutral-300"
                        title="Previous frame"
                      >
                        ←
                      </button>
                      <span className="text-[8px] text-blue-400 font-mono w-12 text-center">{trimEndTime?.toFixed(3)}s</span>
                      <button
                        onClick={() => handleEndFrameStep("forward")}
                        disabled={isTrimming}
                        className="nodrag px-1.5 py-0.5 text-[8px] bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 rounded text-neutral-300"
                        title="Next frame"
                      >
                        →
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={videoDuration}
                    step={0.001}
                    value={trimEndTime ?? videoDuration}
                    onChange={handleTrimEndChange}
                    className="nodrag w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Duration info and apply */}
                <div className="flex items-center justify-between">
                  <span className="text-[8px] text-neutral-400">
                    Duration: <span className="text-white font-mono">{((trimEndTime ?? videoDuration) - trimStartTime).toFixed(3)}s</span>
                    {" "}(original: {videoDuration.toFixed(1)}s)
                  </span>
                  <button
                    onClick={handleApplyTrim}
                    disabled={isTrimming || (trimStartTime === 0 && trimEndTime === videoDuration)}
                    className="nodrag px-3 py-1 text-[9px] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white font-medium"
                    title="Apply trim and extract new last frame"
                  >
                    {isTrimming ? "Trimming..." : "Apply Trim"}
                  </button>
                </div>

                <p className="text-[8px] text-neutral-500">
                  Trim video from start and/or end to remove unwanted content. The last frame becomes the new chain frame.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Last Frame Preview (for chaining) */}
        {nodeData.outputVideo && (
          <div className={`flex items-center gap-2 p-1.5 rounded border ${
            nodeData.lastFrame && nodeData.lastFrame !== nodeData.outputVideo
              ? "bg-green-900/20 border-green-700/50"
              : "bg-yellow-900/20 border-yellow-700/50"
          }`}>
            <div className="w-12 h-12 rounded border border-neutral-600/50 overflow-hidden flex-shrink-0 bg-black">
              {nodeData.lastFrame && nodeData.lastFrame !== nodeData.outputVideo ? (
                <img src={nodeData.lastFrame} className="w-full h-full object-cover" alt="Last frame" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-500 text-[8px]">
                  No frame
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-[9px] block ${
                nodeData.lastFrame && nodeData.lastFrame !== nodeData.outputVideo
                  ? "text-green-400"
                  : "text-yellow-400"
              }`}>
                {nodeData.lastFrame && nodeData.lastFrame !== nodeData.outputVideo
                  ? "Last Frame Extracted"
                  : "Last Frame Missing"}
              </span>
              <span className="text-[8px] text-neutral-500">Connect to next video's image input</span>
            </div>
            <button
              onClick={handleReExtractFrame}
              disabled={isExtractingFrame || isRunning}
              className="nodrag px-2 py-1 text-[8px] bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 rounded text-neutral-300 transition-colors flex-shrink-0"
              title="Re-extract last frame using ffmpeg"
            >
              {isExtractingFrame ? "..." : "Extract"}
            </button>
          </div>
        )}

        {/* Execute button */}
        <ExecuteButton nodeId={id} />
      </div>
    </BaseNode>
  );
});

VideoGenerateNode.displayName = "VideoGenerateNode";
