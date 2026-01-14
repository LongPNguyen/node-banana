"use client";

import { useCallback, useRef, memo } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { ImageInputNodeData } from "@/types";

type ImageInputNodeType = Node<ImageInputNodeData, "imageInput">;

export const ImageInputNode = memo(({ id, data, selected }: NodeProps<ImageInputNodeType>) => {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const addNode = useWorkflowStore((state) => state.addNode);
  const getNodeById = useWorkflowStore((state) => state.getNodeById);
  const edges = useWorkflowStore((state) => state.edges);
  const onConnect = useWorkflowStore((state) => state.onConnect);
  const beginHistoryGroup = useWorkflowStore((state) => state.beginHistoryGroup);
  const endHistoryGroup = useWorkflowStore((state) => state.endHistoryGroup);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFileIntoNode = useCallback(
    (nodeId: string, file: File) => {
      console.log(`[ImageInput] Loading file "${file.name}" into node ${nodeId}`);
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        console.log(`[ImageInput] FileReader loaded, base64 length: ${base64?.length || 0}`);
        const img = new Image();
        img.onload = () => {
          console.log(`[ImageInput] Image loaded: ${img.width}x${img.height}`);
          updateNodeData(nodeId, {
            image: base64,
            filename: file.name,
            dimensions: { width: img.width, height: img.height },
          });
        };
        img.onerror = (err) => {
          console.error(`[ImageInput] Image load error:`, err);
        };
        img.src = base64;
      };
      reader.onerror = (err) => {
        console.error(`[ImageInput] FileReader error:`, err);
      };
      reader.readAsDataURL(file);
    },
    [updateNodeData]
  );

  const handleFiles = useCallback(
    (files: File[]) => {
      console.log(`[ImageInput] handleFiles called with ${files.length} file(s)`);
      const validFiles: File[] = [];
      let skippedUnsupported = 0;
      let skippedTooLarge = 0;

      files.forEach((file) => {
        // Support common image types including jpg alias
        if (!file.type.match(/^image\/(png|jpe?g|webp)$/)) {
          console.log(`[ImageInput] Skipped unsupported file: ${file.name} (${file.type})`);
          skippedUnsupported++;
          return;
        }
        if (file.size > 10 * 1024 * 1024) {
          skippedTooLarge++;
          return;
        }
        validFiles.push(file);
      });

      console.log(`[ImageInput] Valid files: ${validFiles.length}, skipped: ${skippedUnsupported} unsupported, ${skippedTooLarge} too large`);

      if (validFiles.length === 0) {
        if (skippedUnsupported > 0) {
          alert("Unsupported format. Use PNG, JPG, or WebP.");
        } else if (skippedTooLarge > 0) {
          alert("Image too large. Maximum size is 10MB.");
        }
        return;
      }

      if (skippedUnsupported > 0 || skippedTooLarge > 0) {
        const parts: string[] = [];
        if (skippedUnsupported > 0) parts.push(`${skippedUnsupported} unsupported`);
        if (skippedTooLarge > 0) parts.push(`${skippedTooLarge} too large (>10MB)`);
        alert(`Skipped ${parts.join(", ")} file(s).`);
      }

      const baseNode = getNodeById(id);
      const basePos = baseNode?.position ?? { x: 0, y: 0 };

      // If this node is already wired into a downstream node, mirror those connections
      // for any newly-created Image nodes so you can multi-upload into a single pipeline.
      const outgoingImageEdges = edges.filter(
        (edge) =>
          edge.source === id &&
          (edge.sourceHandle === "image" || !edge.sourceHandle) &&
          (edge.targetHandle === "image" || !edge.targetHandle)
      );

      // Keep in sync with default dimensions used in workflowStore
      const NODE_WIDTH = 300;
      const NODE_HEIGHT = 280;
      const GRID_GAP = 20;
      const GRID_COLS = 3;

      const shouldGroupHistory = validFiles.length > 1 || outgoingImageEdges.length > 0;
      if (shouldGroupHistory) beginHistoryGroup();
      try {
        validFiles.forEach((file, index) => {
          const col = index % GRID_COLS;
          const row = Math.floor(index / GRID_COLS);

          const nodeId =
            index === 0
              ? id
              : addNode("imageInput", {
                  x: basePos.x + col * (NODE_WIDTH + GRID_GAP),
                  y: basePos.y + row * (NODE_HEIGHT + GRID_GAP),
                });

          loadFileIntoNode(nodeId, file);

          // Mirror existing outgoing connections from the original node (only for newly-created nodes).
          if (index > 0 && outgoingImageEdges.length > 0) {
            outgoingImageEdges.forEach((edge) => {
              onConnect({
                source: nodeId,
                sourceHandle: "image",
                target: edge.target,
                targetHandle: edge.targetHandle ?? "image",
              });
            });
          }
        });
      } finally {
        if (shouldGroupHistory) endHistoryGroup();
      }
    },
    [
      addNode,
      getNodeById,
      id,
      loadFileIntoNode,
      edges,
      onConnect,
      beginHistoryGroup,
      endHistoryGroup,
    ]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      handleFiles(files);

      // Reset the input so selecting the same file(s) again still triggers onChange
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const files = Array.from(e.dataTransfer.files || []);
      console.log(`[ImageInput] Drop received ${files.length} file(s)`);
      if (files.length === 0) return;

      // Call handleFiles directly instead of using DataTransfer workaround
      handleFiles(files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleRemove = useCallback(() => {
    updateNodeData(id, {
      image: null,
      filename: null,
      dimensions: null,
    });
  }, [id, updateNodeData]);

  return (
    <BaseNode id={id} title="Image" selected={selected}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {nodeData.image ? (
        <div className="relative group flex-1 flex flex-col min-h-0">
          <img
            src={nodeData.image}
            alt={nodeData.filename || "Uploaded image"}
            className="w-full flex-1 min-h-0 object-contain rounded"
          />
          <button
            onClick={handleRemove}
            className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="mt-1.5 flex items-center justify-between shrink-0">
            <span className="text-[10px] text-neutral-400 truncate max-w-[120px]">
              {nodeData.filename}
            </span>
            {nodeData.dimensions && (
              <span className="text-[10px] text-neutral-500">
                {nodeData.dimensions.width}x{nodeData.dimensions.height}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="w-full flex-1 min-h-[112px] border border-dashed border-neutral-600 rounded flex flex-col items-center justify-center cursor-pointer hover:border-neutral-500 hover:bg-neutral-700/50 transition-colors"
        >
          <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span className="text-[10px] text-neutral-400 mt-1">
            Drop or click
          </span>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        id="image"
        data-handletype="image"
      />
    </BaseNode>
  );
});

ImageInputNode.displayName = "ImageInputNode";
