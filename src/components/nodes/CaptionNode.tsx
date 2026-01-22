"use client";

import { useCallback, memo, useRef, useEffect, useState } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { useSettingsStore } from "@/store/settingsStore";
import { CaptionNodeData, CaptionStyle, CaptionPosition, CaptionAnimation, HighlightStyle } from "@/types";
import { ColorPicker } from "@/components/ColorPicker";
import { FontPicker } from "@/components/FontPicker";

type CaptionNodeType = Node<CaptionNodeData, "caption">;

// Style presets like CapCut
const STYLE_PRESETS: Record<string, Partial<CaptionStyle>> = {
  classic: {
    fontFamily: "Arial",
    fontSize: 48,
    fontColor: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 3,
    backgroundColor: null,
    shadowColor: "#000000",
    shadowDepth: 2,
    glowColor: null,
    bold: true,
    italic: false,
    uppercase: false,
    animation: "none",
    highlightColor: "#FFFF00",
    highlightStyle: "color",
  },
  bold_yellow: {
    fontFamily: "Impact",
    fontSize: 56,
    fontColor: "#FFFF00",
    strokeColor: "#000000",
    strokeWidth: 4,
    backgroundColor: null,
    shadowColor: "#000000",
    shadowDepth: 3,
    glowColor: null,
    bold: true,
    italic: false,
    uppercase: true,
    animation: "pop",
    highlightColor: "#FF6600",
    highlightStyle: "color",
  },
  neon_glow: {
    fontFamily: "Arial",
    fontSize: 52,
    fontColor: "#00FFFF",
    strokeColor: "#000066",
    strokeWidth: 2,
    backgroundColor: null,
    shadowColor: null,
    shadowDepth: 0,
    glowColor: "#00FFFF",
    bold: true,
    italic: false,
    uppercase: false,
    animation: "fade",
    highlightColor: "#FF00FF",
    highlightStyle: "color",
  },
  boxed: {
    fontFamily: "Arial",
    fontSize: 44,
    fontColor: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 0,
    backgroundColor: "#000000",
    shadowColor: null,
    shadowDepth: 0,
    glowColor: null,
    bold: true,
    italic: false,
    uppercase: false,
    animation: "none",
    highlightColor: "#FFFF00",
    highlightStyle: "color",
  },
  karaoke: {
    fontFamily: "Arial",
    fontSize: 52,
    fontColor: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 3,
    backgroundColor: null,
    shadowColor: "#000000",
    shadowDepth: 2,
    glowColor: null,
    bold: true,
    italic: false,
    uppercase: false,
    animation: "karaoke",
    highlightColor: "#FFFF00",
    highlightStyle: "color",  // Color change like CapCut
  },
  capcut: {
    // CapCut style: Yellow fill (current word), pink stroke, no bg, black shadow
    // Non-highlighted words will be white automatically in karaoke mode
    fontFamily: "Arial Black",
    fontSize: 52,
    fontColor: "#FFD700",  // Yellow/gold - the highlighted word color
    strokeColor: "#FF1493",  // Pink stroke
    strokeWidth: 3,
    backgroundColor: null,  // No background
    shadowColor: "#000000",  // Black shadow
    shadowDepth: 2,
    glowColor: null,
    bold: true,
    italic: false,
    uppercase: true,
    animation: "karaoke",
    highlightColor: "#FFFFFF",  // Not used in new CapCut style
    highlightStyle: "color",
  },
  karaoke_color: {
    fontFamily: "Arial",
    fontSize: 52,
    fontColor: "#FF69B4",  // Pink
    strokeColor: "#FFFFFF",
    strokeWidth: 4,
    backgroundColor: null,
    shadowColor: "#000000",
    shadowDepth: 2,
    glowColor: null,
    bold: true,
    italic: false,
    uppercase: true,
    animation: "karaoke",
    highlightColor: "#00FF00",  // Green highlight color
    highlightStyle: "color",
  },
  minimal: {
    fontFamily: "Helvetica",
    fontSize: 40,
    fontColor: "#FFFFFF",
    strokeColor: "#333333",
    strokeWidth: 1,
    backgroundColor: null,
    shadowColor: null,
    shadowDepth: 0,
    glowColor: null,
    bold: false,
    italic: false,
    uppercase: false,
    animation: "fade",
    highlightColor: "#AAAAAA",
    highlightStyle: "color",
  },
  retro_red: {
    fontFamily: "Impact",
    fontSize: 54,
    fontColor: "#FF0000",
    strokeColor: "#000000",
    strokeWidth: 4,
    backgroundColor: null,
    shadowColor: "#000000",
    shadowDepth: 4,
    glowColor: "#FF0000",
    bold: true,
    italic: false,
    uppercase: true,
    animation: "pop",
    highlightColor: "#FFFF00",
    highlightStyle: "color",
  },
  subtitle: {
    fontFamily: "Arial",
    fontSize: 36,
    fontColor: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 2,
    backgroundColor: "#00000080",
    shadowColor: null,
    shadowDepth: 0,
    glowColor: null,
    bold: false,
    italic: false,
    uppercase: false,
    animation: "none",
    highlightColor: "#FFFF00",
    highlightStyle: "color",
  },
};

// Social media-friendly fonts (similar to CapCut's ZY Resolve style)
const FONT_FAMILIES = [
  // Sans-serif (clean, modern - best for social)
  "Arial Black",
  "Arial",
  "Helvetica Neue",
  "Helvetica",
  "Impact",
  "Futura",
  "Montserrat",
  "Oswald",
  // Bold/Display fonts (for emphasis)
  "Bebas Neue",
  "Anton",
  "Archivo Black",
  // Classic
  "Verdana",
  "Georgia",
  "Times New Roman",
  "Courier New",
  // Fun
  "Comic Sans MS",
];

const DEFAULT_STYLE: CaptionStyle = {
  preset: "classic",
  fontFamily: "Arial",
  fontSize: 48,
  fontColor: "#FFFFFF",
  strokeColor: "#000000",
  strokeWidth: 3,
  backgroundColor: null,
  shadowColor: "#000000",
  shadowDepth: 2,
  glowColor: null,
  bold: true,
  italic: false,
  uppercase: false,
  position: "bottom",
  animation: "none",
  wordsPerLine: 4,
  highlightColor: "#FFFF00",
  highlightStyle: "box",
};

export const CaptionNode = memo(({ id, data, selected }: NodeProps<CaptionNodeType>) => {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const edges = useWorkflowStore((state) => state.edges);
  const nodes = useWorkflowStore((state) => state.nodes);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isBurning, setIsBurning] = useState(false);
  const [activeTab, setActiveTab] = useState<"presets" | "style">("presets");

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

  // Auto-update input video when edges or upstream nodes change
  useEffect(() => {
    const inputVideo = getInputVideo();
    if (inputVideo !== nodeData.inputVideo) {
      updateNodeData(id, { inputVideo });
    }
  }, [edges, nodes, id, getInputVideo, nodeData.inputVideo, updateNodeData]);

  // Ensure style has defaults
  const style: CaptionStyle = { ...DEFAULT_STYLE, ...nodeData.style };

  const handlePresetSelect = useCallback((presetName: string) => {
    const preset = STYLE_PRESETS[presetName];
    if (preset) {
      updateNodeData(id, {
        style: { ...style, ...preset, preset: presetName },
      });
      // Switch to Custom Style tab so user can edit the preset values
      setActiveTab("style");
    }
  }, [id, style, updateNodeData]);

  const handleStyleChange = useCallback((key: keyof CaptionStyle, value: unknown) => {
    updateNodeData(id, {
      style: { ...style, [key]: value, preset: "custom" },
    });
  }, [id, style, updateNodeData]);

  const handleTranscribe = useCallback(async () => {
    const inputVideo = getInputVideo();
    if (!inputVideo || isTranscribing) return;

    setIsTranscribing(true);
    updateNodeData(id, { status: "loading", error: null });

    try {
      const { openaiApiKey } = useSettingsStore.getState();
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(openaiApiKey && { "x-openai-api-key": openaiApiKey }),
        },
        body: JSON.stringify({ video: inputVideo }),
      });

      const result = await response.json();
      if (result.success) {
        updateNodeData(id, {
          transcription: result.words,
          editedTranscript: result.text,
          status: "idle",
        });
        console.log(`[Caption] Transcribed ${result.words.length} words`);
      } else {
        updateNodeData(id, { status: "error", error: result.error });
        console.error("[Caption] Transcribe failed:", result.error);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      updateNodeData(id, { status: "error", error: errorMsg });
      console.error("[Caption] Transcribe error:", error);
    } finally {
      setIsTranscribing(false);
    }
  }, [id, getInputVideo, isTranscribing, updateNodeData]);

  const handleBurnCaptions = useCallback(async () => {
    const inputVideo = getInputVideo();
    if (!inputVideo || !nodeData.transcription || isBurning) return;

    setIsBurning(true);
    updateNodeData(id, { status: "loading", error: null });

    try {
      const response = await fetch("/api/caption-burn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video: inputVideo,
          words: nodeData.transcription,
          style,
        }),
      });

      const result = await response.json();
      if (result.success) {
        updateNodeData(id, {
          outputVideo: result.video,
          status: "complete",
        });
        console.log("[Caption] Captions burned successfully");
      } else {
        updateNodeData(id, { status: "error", error: result.error });
        console.error("[Caption] Burn failed:", result.error);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      updateNodeData(id, { status: "error", error: errorMsg });
      console.error("[Caption] Burn error:", error);
    } finally {
      setIsBurning(false);
    }
  }, [id, nodeData.transcription, style, getInputVideo, isBurning, updateNodeData]);

  const inputVideo = getInputVideo();
  const hasInput = !!inputVideo;
  const hasTranscription = !!nodeData.transcription && nodeData.transcription.length > 0;
  const hasOutput = !!nodeData.outputVideo;

  return (
    <BaseNode
      id={id}
      title="Captions"
      selected={selected}
      hasError={nodeData.status === "error"}
      minWidth={360}
      minHeight={hasOutput ? 780 : 620}
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
        title="Captioned video output"
      />

      <div className="space-y-2 p-1">
        {/* Input Preview */}
        <div className="space-y-1">
          <label className="text-[9px] text-neutral-500 uppercase tracking-wider">Input Video</label>
          {hasInput ? (
            <div className="relative bg-black rounded border border-neutral-700 overflow-hidden">
              <video src={inputVideo} className="w-full h-14 object-contain" muted playsInline />
            </div>
          ) : (
            <div className="h-10 bg-neutral-800/50 rounded border border-dashed border-neutral-700 flex items-center justify-center">
              <span className="text-[9px] text-neutral-500">Connect video input</span>
            </div>
          )}
        </div>

        {/* Transcribe Button */}
        <button
          onClick={handleTranscribe}
          disabled={!hasInput || isTranscribing}
          className="nodrag w-full py-1.5 text-[10px] font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white transition-colors"
        >
          {isTranscribing ? "Transcribing..." : "Transcribe Audio"}
        </button>

        {/* Editable Transcription */}
        {hasTranscription && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[9px] text-neutral-500 uppercase tracking-wider">
                Transcript ({nodeData.transcription!.length} words)
              </label>
              <span className="text-[7px] text-neutral-600">Edit to fix spelling/punctuation</span>
            </div>
            <textarea
              value={nodeData.transcription!.map(w => w.word).join(" ")}
              onChange={(e) => {
                const newWords = e.target.value.split(/\s+/).filter(w => w.length > 0);
                const oldTranscription = nodeData.transcription!;

                // Update words while preserving timing
                // If word count matches, just update the text
                // If different, redistribute timing proportionally
                if (newWords.length === oldTranscription.length) {
                  // Same count - just update word text
                  const updated = oldTranscription.map((t, i) => ({
                    ...t,
                    word: newWords[i] || t.word,
                  }));
                  updateNodeData(id, { transcription: updated });
                } else if (newWords.length > 0 && oldTranscription.length > 0) {
                  // Different count - redistribute timing
                  const totalDuration = oldTranscription[oldTranscription.length - 1].end - oldTranscription[0].start;
                  const startTime = oldTranscription[0].start;
                  const avgDuration = totalDuration / newWords.length;

                  const updated = newWords.map((word, i) => ({
                    word,
                    start: startTime + i * avgDuration,
                    end: startTime + (i + 1) * avgDuration,
                  }));
                  updateNodeData(id, { transcription: updated });
                }
              }}
              className="nodrag nowheel w-full h-16 text-[9px] text-neutral-300 bg-neutral-800/50 rounded border border-neutral-700 p-1.5 resize-none leading-relaxed focus:border-amber-600 focus:outline-none"
              onWheelCapture={(e) => e.stopPropagation()}
              placeholder="Transcript will appear here after transcription..."
            />
          </div>
        )}

        {/* Style Panel - Always visible so users can preset styles */}
        <div className="space-y-2">
          {/* Tab Buttons */}
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab("presets")}
              className={`nodrag flex-1 py-1 text-[9px] font-medium rounded transition-colors ${
                activeTab === "presets"
                  ? "bg-amber-600 text-white"
                  : "bg-neutral-700 text-neutral-400 hover:bg-neutral-600"
              }`}
            >
              Presets
            </button>
            <button
              onClick={() => setActiveTab("style")}
              className={`nodrag flex-1 py-1 text-[9px] font-medium rounded transition-colors ${
                activeTab === "style"
                  ? "bg-amber-600 text-white"
                  : "bg-neutral-700 text-neutral-400 hover:bg-neutral-600"
              }`}
            >
              Custom Style
            </button>
          </div>

            {/* Presets Grid */}
            {activeTab === "presets" && (
              <div className="grid grid-cols-4 gap-1">
                {Object.entries(STYLE_PRESETS).map(([name, preset]) => (
                  <button
                    key={name}
                    onClick={() => handlePresetSelect(name)}
                    className={`nodrag p-1.5 rounded text-[7px] font-bold transition-all ${
                      style.preset === name
                        ? "ring-2 ring-amber-500 ring-offset-1 ring-offset-neutral-900"
                        : "hover:ring-1 hover:ring-neutral-500"
                    }`}
                    style={{
                      backgroundColor: preset.backgroundColor || "#1a1a1a",
                      color: preset.fontColor,
                      textShadow: preset.strokeColor ? `1px 1px 0 ${preset.strokeColor}` : undefined,
                    }}
                    title={name.replace(/_/g, " ")}
                  >
                    {name === "karaoke" ? "ABC" : "Aa"}
                  </button>
                ))}
              </div>
            )}

            {/* Custom Style Controls - CapCut-style labels */}
            {activeTab === "style" && (
              <div
                className="nowheel space-y-2 p-2 bg-neutral-800/50 rounded border border-neutral-700 max-h-52 overflow-y-auto"
                onWheelCapture={(e) => e.stopPropagation()}
              >
                {/* Font Family */}
                <div className="flex items-center gap-2">
                  <label className="text-[8px] text-neutral-500 w-16">Font</label>
                  <FontPicker
                    value={style.fontFamily}
                    onChange={(font) => handleStyleChange("fontFamily", font)}
                    fonts={FONT_FAMILIES}
                  />
                </div>

                {/* Font Size */}
                <div className="flex items-center gap-2">
                  <label className="text-[8px] text-neutral-500 w-16">Size</label>
                  <input
                    type="range"
                    min="24"
                    max="72"
                    value={style.fontSize}
                    onChange={(e) => handleStyleChange("fontSize", parseInt(e.target.value))}
                    className="nodrag flex-1 h-1"
                  />
                  <span className="text-[8px] text-neutral-400 w-6">{style.fontSize}</span>
                </div>

                {/* Fill (Text Color) - CapCut style */}
                <div className="flex items-center gap-2">
                  <label className="text-[8px] text-neutral-500 w-16">Fill</label>
                  <ColorPicker
                    value={style.fontColor}
                    onChange={(color) => handleStyleChange("fontColor", color || "#FFFFFF")}
                    label="Fill color"
                    allowNone={false}
                  />
                </div>

                {/* Stroke (Outline) - CapCut style with None option */}
                <div className="flex items-center gap-2">
                  <label className="text-[8px] text-neutral-500 w-16">Stroke</label>
                  <ColorPicker
                    value={style.strokeWidth > 0 ? style.strokeColor : null}
                    onChange={(color) => {
                      if (color) {
                        handleStyleChange("strokeColor", color);
                        if (style.strokeWidth === 0) {
                          handleStyleChange("strokeWidth", 3);
                        }
                      } else {
                        handleStyleChange("strokeWidth", 0);
                      }
                    }}
                    label="Stroke color"
                    allowNone={true}
                  />
                  {style.strokeWidth > 0 && (
                    <>
                      <input
                        type="range"
                        min="1"
                        max="8"
                        value={style.strokeWidth}
                        onChange={(e) => handleStyleChange("strokeWidth", parseInt(e.target.value))}
                        className="nodrag flex-1 h-1"
                        title="Stroke width"
                      />
                      <span className="text-[8px] text-neutral-400 w-4">{style.strokeWidth}</span>
                    </>
                  )}
                </div>

                {/* Background - CapCut style with None option */}
                <div className="flex items-center gap-2">
                  <label className="text-[8px] text-neutral-500 w-16">Background</label>
                  <ColorPicker
                    value={style.backgroundColor}
                    onChange={(color) => handleStyleChange("backgroundColor", color)}
                    label="Background color"
                    allowNone={true}
                  />
                </div>

                {/* Shadow - CapCut style with None option */}
                <div className="flex items-center gap-2">
                  <label className="text-[8px] text-neutral-500 w-16">Shadow</label>
                  <ColorPicker
                    value={style.shadowColor}
                    onChange={(color) => {
                      handleStyleChange("shadowColor", color);
                      if (color && style.shadowDepth === 0) {
                        handleStyleChange("shadowDepth", 2);
                      }
                    }}
                    label="Shadow color"
                    allowNone={true}
                  />
                  {style.shadowColor && (
                    <>
                      <input
                        type="range"
                        min="1"
                        max="6"
                        value={style.shadowDepth}
                        onChange={(e) => handleStyleChange("shadowDepth", parseInt(e.target.value))}
                        className="nodrag flex-1 h-1"
                      />
                      <span className="text-[8px] text-neutral-400 w-4">{style.shadowDepth}</span>
                    </>
                  )}
                </div>

                {/* Glow - CapCut style with None option */}
                <div className="flex items-center gap-2">
                  <label className="text-[8px] text-neutral-500 w-16">Glow</label>
                  <ColorPicker
                    value={style.glowColor}
                    onChange={(color) => handleStyleChange("glowColor", color)}
                    label="Glow color"
                    allowNone={true}
                  />
                </div>


                {/* Text Style Toggles */}
                <div className="flex items-center gap-2">
                  <label className="text-[8px] text-neutral-500 w-16">Style</label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleStyleChange("bold", !style.bold)}
                      className={`nodrag px-2 py-0.5 text-[9px] font-bold rounded ${
                        style.bold ? "bg-amber-600 text-white" : "bg-neutral-700 text-neutral-400"
                      }`}
                    >
                      B
                    </button>
                    <button
                      onClick={() => handleStyleChange("italic", !style.italic)}
                      className={`nodrag px-2 py-0.5 text-[9px] italic rounded ${
                        style.italic ? "bg-amber-600 text-white" : "bg-neutral-700 text-neutral-400"
                      }`}
                    >
                      I
                    </button>
                    <button
                      onClick={() => handleStyleChange("uppercase", !style.uppercase)}
                      className={`nodrag px-2 py-0.5 text-[9px] rounded ${
                        style.uppercase ? "bg-amber-600 text-white" : "bg-neutral-700 text-neutral-400"
                      }`}
                    >
                      Aa
                    </button>
                  </div>
                </div>

                {/* Words Per Line */}
                <div className="flex items-center gap-2">
                  <label className="text-[8px] text-neutral-500 w-16">Words/Line</label>
                  <input
                    type="range"
                    min="2"
                    max="8"
                    value={style.wordsPerLine}
                    onChange={(e) => handleStyleChange("wordsPerLine", parseInt(e.target.value))}
                    className="nodrag flex-1 h-1"
                  />
                  <span className="text-[8px] text-neutral-400 w-4">{style.wordsPerLine}</span>
                </div>

                {/* Position */}
                <div className="flex items-center gap-2">
                  <label className="text-[8px] text-neutral-500 w-16">Position</label>
                  <select
                    value={style.position}
                    onChange={(e) => handleStyleChange("position", e.target.value as CaptionPosition)}
                    className="nodrag flex-1 text-[9px] py-0.5 px-1 border border-neutral-600 rounded bg-neutral-900 text-neutral-300"
                  >
                    <option value="top">Top</option>
                    <option value="center">Center</option>
                    <option value="bottom">Bottom</option>
                  </select>
                </div>

                {/* Animation/Effect */}
                <div className="flex items-center gap-2">
                  <label className="text-[8px] text-neutral-500 w-16">Effect</label>
                  <select
                    value={style.animation}
                    onChange={(e) => handleStyleChange("animation", e.target.value as CaptionAnimation)}
                    className="nodrag flex-1 text-[9px] py-0.5 px-1 border border-neutral-600 rounded bg-neutral-900 text-neutral-300"
                  >
                    <option value="none">None</option>
                    <option value="fade">Fade In/Out</option>
                    <option value="pop">Pop</option>
                    <option value="karaoke">Karaoke</option>
                  </select>
                </div>

                {/* Karaoke info - only show for karaoke */}
                {style.animation === "karaoke" && (
                  <div className="text-[8px] text-neutral-400 bg-neutral-700/50 rounded p-1.5">
                    CapCut style: Current word uses Fill color, other words are white
                  </div>
                )}

              </div>
            )}
          </div>

        {/* Generate Button */}
        {hasTranscription && (
          <button
            onClick={handleBurnCaptions}
            disabled={!hasInput || isBurning}
            className="nodrag w-full py-2 text-[10px] font-medium bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white transition-colors"
          >
            {isBurning ? "Burning Captions..." : "Generate Captions"}
          </button>
        )}

        {/* Error Display */}
        {nodeData.status === "error" && nodeData.error && (
          <div className="p-1.5 bg-red-900/30 border border-red-700/50 rounded">
            <p className="text-[8px] text-red-400">{nodeData.error}</p>
          </div>
        )}

        {/* Loading Indicator */}
        {nodeData.status === "loading" && (
          <div className="flex items-center justify-center gap-2 p-1.5 bg-blue-900/30 border border-blue-700/50 rounded">
            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-[8px] text-blue-400">
              {isTranscribing ? "Transcribing audio..." : "Burning captions..."}
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
                className="w-full h-36 object-contain"
                playsInline
              />
              <span className="absolute top-1 right-1 text-[7px] bg-green-600/80 px-1 rounded text-white">
                Captioned
              </span>
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
});

CaptionNode.displayName = "CaptionNode";
