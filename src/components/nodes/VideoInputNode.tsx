"use client";

import { useCallback, useRef, memo, useEffect } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { VideoInputNodeData } from "@/types";

type VideoInputNodeType = Node<VideoInputNodeData, "videoInput">;

export const VideoInputNode = memo(({ id, data, selected }: NodeProps<VideoInputNodeType>) => {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Extract last frame when video loads
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !nodeData.video) return;

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
          const lastFrameDataUrl = canvas.toDataURL("image/jpeg", 0.9);
          if (lastFrameDataUrl && lastFrameDataUrl.length > 100) {
            updateNodeData(id, { lastFrame: lastFrameDataUrl });
          }
        }
      } catch (e) {
        console.error("Failed to extract last frame:", e);
      }
      video.currentTime = 0;
    };

    const extractLastFrame = () => {
      if (hasExtracted) return;
      video.currentTime = video.duration;
    };

    const handleMetadata = () => {
      updateNodeData(id, { duration: video.duration });
      extractLastFrame();
    };

    video.addEventListener("loadedmetadata", handleMetadata);
    video.addEventListener("seeked", captureFrame);

    if (video.readyState >= 1 && video.duration > 0) {
      updateNodeData(id, { duration: video.duration });
      extractLastFrame();
    }

    return () => {
      video.removeEventListener("loadedmetadata", handleMetadata);
      video.removeEventListener("seeked", captureFrame);
    };
  }, [nodeData.video, id, updateNodeData]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("video/")) {
        alert("Please select a video file.");
        return;
      }

      if (file.size > 100 * 1024 * 1024) {
        alert("Video too large. Maximum size is 100MB.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        updateNodeData(id, {
          video: base64,
          filename: file.name,
          lastFrame: null,
          duration: null,
        });
      };
      reader.readAsDataURL(file);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [id, updateNodeData]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const file = e.dataTransfer.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("video/")) {
        alert("Please drop a video file.");
        return;
      }

      if (file.size > 100 * 1024 * 1024) {
        alert("Video too large. Maximum size is 100MB.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        updateNodeData(id, {
          video: base64,
          filename: file.name,
          lastFrame: null,
          duration: null,
        });
      };
      reader.readAsDataURL(file);
    },
    [id, updateNodeData]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleRemove = useCallback(() => {
    updateNodeData(id, {
      video: null,
      filename: null,
      duration: null,
      lastFrame: null,
    });
  }, [id, updateNodeData]);

  return (
    <BaseNode
      id={id}
      title="Video Input"
      customTitle={nodeData.customTitle}
      comment={nodeData.comment}
      onCustomTitleChange={(title) => updateNodeData(id, { customTitle: title || undefined })}
      onCommentChange={(comment) => updateNodeData(id, { comment: comment || undefined })}
      selected={selected}
      minWidth={320}
      minHeight={280}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {nodeData.video ? (
        <div className="relative group flex-1 flex flex-col min-h-0 gap-2">
          <video
            ref={videoRef}
            src={nodeData.video}
            controls
            className="w-full flex-1 min-h-0 object-contain rounded bg-black"
            crossOrigin="anonymous"
          />
          <button
            onClick={handleRemove}
            className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Last frame preview */}
          {nodeData.lastFrame && (
            <div className="flex items-center gap-2 p-1.5 rounded border bg-green-900/20 border-green-700/50">
              <div className="w-10 h-10 rounded border border-neutral-600/50 overflow-hidden flex-shrink-0 bg-black">
                <img src={nodeData.lastFrame} className="w-full h-full object-cover" alt="Last frame" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[9px] text-green-400 block">Last Frame Ready</span>
                <span className="text-[8px] text-neutral-500">Connect to next video's start frame</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between shrink-0">
            <span className="text-[10px] text-neutral-400 truncate max-w-[150px]">
              {nodeData.filename}
            </span>
            {nodeData.duration && (
              <span className="text-[10px] text-neutral-500">
                {Math.round(nodeData.duration)}s
              </span>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="w-full flex-1 min-h-[140px] border border-dashed border-neutral-600 rounded flex flex-col items-center justify-center cursor-pointer hover:border-neutral-500 hover:bg-neutral-700/50 transition-colors"
        >
          <svg className="w-6 h-6 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <span className="text-[10px] text-neutral-400 mt-1">
            Drop video or click
          </span>
          <span className="text-[8px] text-neutral-500">
            MP4, WebM, MOV (max 100MB)
          </span>
        </div>
      )}

      {/* Video output - red */}
      <Handle
        type="source"
        position={Position.Right}
        id="video"
        style={{ top: "30%", background: "#ef4444" }}
        data-handletype="video"
      />
      {/* Last frame output - green */}
      <Handle
        type="source"
        position={Position.Right}
        id="image"
        style={{ top: "70%", background: "#22c55e" }}
        data-handletype="image"
      />
    </BaseNode>
  );
});

VideoInputNode.displayName = "VideoInputNode";
