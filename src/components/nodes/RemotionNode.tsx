"use client";

import { useCallback, memo, useRef, useEffect, useState } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import {
  RemotionNodeData,
  RemotionIntroTemplate,
  RemotionOutroTemplate,
  RemotionOverlayAnimation,
  RemotionOverlayPosition,
  RemotionTextOverlay,
} from "@/types";

type RemotionNodeType = Node<RemotionNodeData, "remotion">;

const INTRO_TEMPLATES: { value: RemotionIntroTemplate; label: string }[] = [
  { value: "none", label: "None" },
  { value: "logo-reveal", label: "Logo Reveal" },
  { value: "text-scale", label: "Text Scale" },
  { value: "slide-in", label: "Slide In" },
  { value: "glitch", label: "Glitch" },
];

const OUTRO_TEMPLATES: { value: RemotionOutroTemplate; label: string }[] = [
  { value: "none", label: "None" },
  { value: "cta-follow", label: "CTA Follow" },
  { value: "cta-subscribe", label: "CTA Subscribe" },
  { value: "fade-out", label: "Fade Out" },
  { value: "slide-out", label: "Slide Out" },
];

const ANIMATIONS: { value: RemotionOverlayAnimation; label: string }[] = [
  { value: "pop", label: "Pop" },
  { value: "fade", label: "Fade" },
  { value: "slide-up", label: "Slide Up" },
  { value: "slide-down", label: "Slide Down" },
  { value: "slide-left", label: "Slide Left" },
  { value: "slide-right", label: "Slide Right" },
  { value: "bounce", label: "Bounce" },
  { value: "typewriter", label: "Typewriter" },
];

const POSITIONS: { value: RemotionOverlayPosition; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "center", label: "Center" },
  { value: "bottom", label: "Bottom" },
  { value: "top-left", label: "Top Left" },
  { value: "top-right", label: "Top Right" },
  { value: "bottom-left", label: "Bottom Left" },
  { value: "bottom-right", label: "Bottom Right" },
];

export const RemotionNode = memo(({ id, data, selected }: NodeProps<RemotionNodeType>) => {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const edges = useWorkflowStore((state) => state.edges);
  const nodes = useWorkflowStore((state) => state.nodes);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [activeTab, setActiveTab] = useState<"intro" | "overlays" | "outro">("intro");

  // Get connected input video
  const getInputVideo = useCallback((): string | null => {
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

  // Get video duration when input changes
  useEffect(() => {
    const inputVideo = getInputVideo();
    if (inputVideo !== nodeData.inputVideo) {
      updateNodeData(id, { inputVideo });
    }
  }, [edges, nodes, id, getInputVideo, nodeData.inputVideo, updateNodeData]);

  // Get duration from video element
  const handleVideoMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (video.duration && video.duration !== nodeData.videoDuration) {
      updateNodeData(id, { videoDuration: video.duration });
    }
  }, [id, nodeData.videoDuration, updateNodeData]);

  // Intro handlers
  const handleIntroTemplateChange = useCallback((template: RemotionIntroTemplate) => {
    updateNodeData(id, {
      intro: { ...nodeData.intro, template, enabled: template !== "none" }
    });
  }, [id, nodeData.intro, updateNodeData]);

  const handleIntroDurationChange = useCallback((duration: number) => {
    updateNodeData(id, { intro: { ...nodeData.intro, duration } });
  }, [id, nodeData.intro, updateNodeData]);

  const handleIntroTextChange = useCallback((text: string) => {
    updateNodeData(id, { intro: { ...nodeData.intro, text } });
  }, [id, nodeData.intro, updateNodeData]);

  const handleIntroSubtextChange = useCallback((subtext: string) => {
    updateNodeData(id, { intro: { ...nodeData.intro, subtext } });
  }, [id, nodeData.intro, updateNodeData]);

  // Outro handlers
  const handleOutroTemplateChange = useCallback((template: RemotionOutroTemplate) => {
    updateNodeData(id, {
      outro: { ...nodeData.outro, template, enabled: template !== "none" }
    });
  }, [id, nodeData.outro, updateNodeData]);

  const handleOutroDurationChange = useCallback((duration: number) => {
    updateNodeData(id, { outro: { ...nodeData.outro, duration } });
  }, [id, nodeData.outro, updateNodeData]);

  const handleOutroTextChange = useCallback((text: string) => {
    updateNodeData(id, { outro: { ...nodeData.outro, text } });
  }, [id, nodeData.outro, updateNodeData]);

  const handleOutroHandleChange = useCallback((handle: string) => {
    updateNodeData(id, { outro: { ...nodeData.outro, handle } });
  }, [id, nodeData.outro, updateNodeData]);

  // Overlay handlers
  const handleAddOverlay = useCallback(() => {
    const newOverlay: RemotionTextOverlay = {
      id: `overlay-${Date.now()}`,
      text: "TEXT",
      startTime: 1,
      duration: 2,
      animation: "pop",
      position: "center",
      fontSize: 56,
      fontColor: "#ffffff",
      strokeColor: "#000000",
      strokeWidth: 3,
    };
    updateNodeData(id, { overlays: [...nodeData.overlays, newOverlay] });
  }, [id, nodeData.overlays, updateNodeData]);

  const handleRemoveOverlay = useCallback((overlayId: string) => {
    updateNodeData(id, {
      overlays: nodeData.overlays.filter(o => o.id !== overlayId)
    });
  }, [id, nodeData.overlays, updateNodeData]);

  const handleUpdateOverlay = useCallback((overlayId: string, updates: Partial<RemotionTextOverlay>) => {
    updateNodeData(id, {
      overlays: nodeData.overlays.map(o =>
        o.id === overlayId ? { ...o, ...updates } : o
      )
    });
  }, [id, nodeData.overlays, updateNodeData]);

  // Render handler
  const handleRender = useCallback(async () => {
    const inputVideo = getInputVideo();
    if (!inputVideo || !nodeData.videoDuration || isRendering) return;

    setIsRendering(true);
    updateNodeData(id, { status: "loading", error: null });

    try {
      // Determine video dimensions from aspect ratio
      // Default to 9:16 vertical video
      const width = 1080;
      const height = 1920;
      const fps = 30;

      const response = await fetch("/api/remotion-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video: inputVideo,
          videoDuration: nodeData.videoDuration,
          width,
          height,
          fps,
          intro: nodeData.intro,
          outro: nodeData.outro,
          overlays: nodeData.overlays,
        }),
      });

      const result = await response.json();
      if (result.success) {
        updateNodeData(id, {
          outputVideo: result.video,
          status: "complete",
        });
        console.log("[Remotion] Render complete");
      } else {
        updateNodeData(id, { status: "error", error: result.error });
        console.error("[Remotion] Render failed:", result.error);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      updateNodeData(id, { status: "error", error: errorMsg });
      console.error("[Remotion] Error:", error);
    } finally {
      setIsRendering(false);
    }
  }, [id, nodeData, getInputVideo, isRendering, updateNodeData]);

  const inputVideo = getInputVideo();
  const hasInput = !!inputVideo;
  const hasOutput = !!nodeData.outputVideo;
  const canRender = hasInput && nodeData.videoDuration && !isRendering;

  return (
    <BaseNode
      id={id}
      title="Remotion Post-Process"
      selected={selected}
      hasError={nodeData.status === "error"}
      minWidth={400}
      minHeight={600}
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
                onLoadedMetadata={handleVideoMetadata}
              />
              {nodeData.videoDuration && (
                <span className="absolute bottom-1 right-1 text-[8px] bg-black/80 px-1 rounded text-neutral-300">
                  {nodeData.videoDuration.toFixed(1)}s
                </span>
              )}
            </div>
          ) : (
            <div className="h-14 bg-neutral-800/50 rounded border border-dashed border-neutral-700 flex items-center justify-center">
              <span className="text-[9px] text-neutral-500">Connect video input</span>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1">
          {(["intro", "overlays", "outro"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`nodrag flex-1 py-1.5 text-[9px] font-medium rounded transition-colors ${
                activeTab === tab
                  ? "bg-purple-600 text-white"
                  : "bg-neutral-700 text-neutral-400 hover:bg-neutral-600"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === "overlays" && nodeData.overlays.length > 0 && (
                <span className="ml-1 px-1 bg-purple-500 rounded-full text-[8px]">
                  {nodeData.overlays.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="nowheel max-h-[250px] overflow-y-auto p-2 bg-neutral-800/50 rounded border border-neutral-700">
          {/* Intro Tab */}
          {activeTab === "intro" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] text-neutral-500 uppercase tracking-wider">Template</label>
                <select
                  value={nodeData.intro.template}
                  onChange={(e) => handleIntroTemplateChange(e.target.value as RemotionIntroTemplate)}
                  className="nodrag w-full text-[10px] py-1.5 px-2 border border-neutral-700 rounded bg-neutral-900/50 text-neutral-300"
                >
                  {INTRO_TEMPLATES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {nodeData.intro.template !== "none" && (
                <>
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase tracking-wider">Duration (seconds)</label>
                    <input
                      type="number"
                      min={0.5}
                      max={10}
                      step={0.5}
                      value={nodeData.intro.duration}
                      onChange={(e) => handleIntroDurationChange(parseFloat(e.target.value) || 2)}
                      className="nodrag w-full text-[10px] py-1.5 px-2 border border-neutral-700 rounded bg-neutral-900/50 text-neutral-300"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase tracking-wider">Main Text</label>
                    <input
                      type="text"
                      value={nodeData.intro.text || ""}
                      onChange={(e) => handleIntroTextChange(e.target.value)}
                      placeholder="INTRO TEXT"
                      className="nodrag w-full text-[10px] py-1.5 px-2 border border-neutral-700 rounded bg-neutral-900/50 text-neutral-300"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase tracking-wider">Subtext</label>
                    <input
                      type="text"
                      value={nodeData.intro.subtext || ""}
                      onChange={(e) => handleIntroSubtextChange(e.target.value)}
                      placeholder="Optional subtext"
                      className="nodrag w-full text-[10px] py-1.5 px-2 border border-neutral-700 rounded bg-neutral-900/50 text-neutral-300"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Overlays Tab */}
          {activeTab === "overlays" && (
            <div className="space-y-3">
              <button
                onClick={handleAddOverlay}
                className="nodrag w-full py-1.5 text-[10px] font-medium bg-neutral-700 hover:bg-neutral-600 rounded text-neutral-300 transition-colors"
              >
                + Add Text Overlay
              </button>

              {nodeData.overlays.length === 0 ? (
                <div className="text-[9px] text-neutral-500 text-center py-4">
                  No overlays yet. Add one to display text at specific times.
                </div>
              ) : (
                <div className="space-y-2">
                  {nodeData.overlays.map((overlay, index) => (
                    <div key={overlay.id} className="p-2 bg-neutral-900/50 rounded border border-neutral-700 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-neutral-400">Overlay {index + 1}</span>
                        <button
                          onClick={() => handleRemoveOverlay(overlay.id)}
                          className="nodrag text-[9px] text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>

                      <input
                        type="text"
                        value={overlay.text}
                        onChange={(e) => handleUpdateOverlay(overlay.id, { text: e.target.value })}
                        placeholder="Text"
                        className="nodrag w-full text-[10px] py-1 px-2 border border-neutral-700 rounded bg-neutral-800 text-neutral-300"
                      />

                      <div className="grid grid-cols-3 gap-1">
                        <div>
                          <label className="text-[8px] text-neutral-500">Start (s)</label>
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={overlay.startTime}
                            onChange={(e) => handleUpdateOverlay(overlay.id, { startTime: parseFloat(e.target.value) || 0 })}
                            className="nodrag w-full text-[9px] py-1 px-1 border border-neutral-700 rounded bg-neutral-800 text-neutral-300"
                          />
                        </div>
                        <div>
                          <label className="text-[8px] text-neutral-500">Duration</label>
                          <input
                            type="number"
                            min={0.1}
                            step={0.1}
                            value={overlay.duration}
                            onChange={(e) => handleUpdateOverlay(overlay.id, { duration: parseFloat(e.target.value) || 1 })}
                            className="nodrag w-full text-[9px] py-1 px-1 border border-neutral-700 rounded bg-neutral-800 text-neutral-300"
                          />
                        </div>
                        <div>
                          <label className="text-[8px] text-neutral-500">Size</label>
                          <input
                            type="number"
                            min={20}
                            max={120}
                            value={overlay.fontSize || 56}
                            onChange={(e) => handleUpdateOverlay(overlay.id, { fontSize: parseInt(e.target.value) || 56 })}
                            className="nodrag w-full text-[9px] py-1 px-1 border border-neutral-700 rounded bg-neutral-800 text-neutral-300"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1">
                        <select
                          value={overlay.animation}
                          onChange={(e) => handleUpdateOverlay(overlay.id, { animation: e.target.value as RemotionOverlayAnimation })}
                          className="nodrag text-[9px] py-1 px-1 border border-neutral-700 rounded bg-neutral-800 text-neutral-300"
                        >
                          {ANIMATIONS.map(a => (
                            <option key={a.value} value={a.value}>{a.label}</option>
                          ))}
                        </select>
                        <select
                          value={overlay.position}
                          onChange={(e) => handleUpdateOverlay(overlay.id, { position: e.target.value as RemotionOverlayPosition })}
                          className="nodrag text-[9px] py-1 px-1 border border-neutral-700 rounded bg-neutral-800 text-neutral-300"
                        >
                          {POSITIONS.map(p => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Outro Tab */}
          {activeTab === "outro" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] text-neutral-500 uppercase tracking-wider">Template</label>
                <select
                  value={nodeData.outro.template}
                  onChange={(e) => handleOutroTemplateChange(e.target.value as RemotionOutroTemplate)}
                  className="nodrag w-full text-[10px] py-1.5 px-2 border border-neutral-700 rounded bg-neutral-900/50 text-neutral-300"
                >
                  {OUTRO_TEMPLATES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {nodeData.outro.template !== "none" && (
                <>
                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase tracking-wider">Duration (seconds)</label>
                    <input
                      type="number"
                      min={0.5}
                      max={10}
                      step={0.5}
                      value={nodeData.outro.duration}
                      onChange={(e) => handleOutroDurationChange(parseFloat(e.target.value) || 3)}
                      className="nodrag w-full text-[10px] py-1.5 px-2 border border-neutral-700 rounded bg-neutral-900/50 text-neutral-300"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase tracking-wider">Main Text</label>
                    <input
                      type="text"
                      value={nodeData.outro.text || ""}
                      onChange={(e) => handleOutroTextChange(e.target.value)}
                      placeholder="FOLLOW FOR MORE"
                      className="nodrag w-full text-[10px] py-1.5 px-2 border border-neutral-700 rounded bg-neutral-900/50 text-neutral-300"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-neutral-500 uppercase tracking-wider">Handle / Username</label>
                    <input
                      type="text"
                      value={nodeData.outro.handle || ""}
                      onChange={(e) => handleOutroHandleChange(e.target.value)}
                      placeholder="@username"
                      className="nodrag w-full text-[10px] py-1.5 px-2 border border-neutral-700 rounded bg-neutral-900/50 text-neutral-300"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Render Button */}
        <button
          onClick={handleRender}
          disabled={!canRender}
          className="nodrag w-full py-2.5 text-[10px] font-medium bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white transition-colors"
        >
          {isRendering ? "Rendering..." : "Render Video"}
        </button>

        {/* Error Display */}
        {nodeData.status === "error" && nodeData.error && (
          <div className="p-2 bg-red-900/30 border border-red-700/50 rounded">
            <p className="text-[9px] text-red-400">{nodeData.error}</p>
          </div>
        )}

        {/* Loading Indicator */}
        {nodeData.status === "loading" && (
          <div className="flex items-center justify-center gap-2 p-3 bg-purple-900/30 border border-purple-700/50 rounded">
            <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-[9px] text-purple-400">Rendering with Remotion...</span>
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
              <span className="absolute top-1 right-1 text-[8px] bg-purple-600/80 px-1.5 py-0.5 rounded text-white">
                Processed
              </span>
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
});

RemotionNode.displayName = "RemotionNode";
