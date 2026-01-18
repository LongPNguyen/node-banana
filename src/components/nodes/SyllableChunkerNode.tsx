"use client";

import { useCallback, memo, useState } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { ExecuteButton } from "./ExecuteButton";
import { useWorkflowStore } from "@/store/workflowStore";
import { SyllableChunkerNodeData } from "@/types";

type SyllableChunkerNodeType = Node<SyllableChunkerNodeData, "syllableChunker">;

// Helper to count syllables (same logic as in store, for display)
const countSyllables = (text: string): number => {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  let total = 0;

  for (const word of words) {
    const clean = word.replace(/[^a-z]/g, '');
    if (clean.length === 0) continue;

    const vowelGroups = clean.match(/[aeiouy]+/g) || [];
    let count = vowelGroups.length;

    if (clean.endsWith('e') && count > 1) count--;
    if (clean.match(/[^aeiou]le$/)) count++;

    total += Math.max(1, count);
  }

  return total;
};

// Chunk text by syllables without cutting mid-sentence
// Strict mode: never exceed target syllables per chunk
const chunkBySyllables = (text: string, targetSyllables: number, prefix: string = ""): string[] => {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = '';
  let currentSyllables = 0;

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    const sentenceSyllables = countSyllables(trimmedSentence);

    // Strict: only add if it won't exceed target
    if (currentSyllables + sentenceSyllables <= targetSyllables) {
      currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
      currentSyllables += sentenceSyllables;
    } else {
      // Push current chunk if it has content
      if (currentChunk) chunks.push(currentChunk);
      // Start new chunk with this sentence
      currentChunk = trimmedSentence;
      currentSyllables = sentenceSyllables;
    }
  }

  if (currentChunk) chunks.push(currentChunk);

  // Prepend prefix to each chunk if provided
  if (prefix) {
    return chunks.map(chunk => prefix + chunk);
  }

  return chunks;
};

const DEFAULT_CHUNK_PREFIX = "Dialogue: ";

export const SyllableChunkerNode = memo(({ id, data, selected }: NodeProps<SyllableChunkerNodeType>) => {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Use default prefix if not set (for backwards compatibility with existing nodes)
  const currentPrefix = nodeData.chunkPrefix ?? DEFAULT_CHUNK_PREFIX;

  const handleTargetChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTarget = parseInt(e.target.value, 10);
      // If we have input text, re-chunk automatically
      if (nodeData.inputScript) {
        const newChunks = chunkBySyllables(nodeData.inputScript, newTarget, currentPrefix);
        updateNodeData(id, {
          targetSyllables: newTarget,
          outputChunks: newChunks,
          selectedChunkIndex: Math.min(nodeData.selectedChunkIndex, newChunks.length - 1)
        });
      } else {
        updateNodeData(id, { targetSyllables: newTarget });
      }
    },
    [id, updateNodeData, nodeData.inputScript, nodeData.selectedChunkIndex, currentPrefix]
  );

  const handlePrefixChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newPrefix = e.target.value;
      // If we have output chunks, re-chunk with new prefix
      if (nodeData.inputScript) {
        const newChunks = chunkBySyllables(nodeData.inputScript, nodeData.targetSyllables, newPrefix);
        updateNodeData(id, {
          chunkPrefix: newPrefix,
          outputChunks: newChunks,
        });
      } else {
        updateNodeData(id, { chunkPrefix: newPrefix });
      }
    },
    [id, updateNodeData, nodeData.inputScript, nodeData.targetSyllables]
  );

  const handleChunkSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { selectedChunkIndex: parseInt(e.target.value, 10) });
    },
    [id, updateNodeData]
  );

  const handleClear = useCallback(() => {
    updateNodeData(id, { outputChunks: [], selectedChunkIndex: 0, status: "idle", error: null });
    setEditingIndex(null);
  }, [id, updateNodeData]);

  const handleCopyChunk = useCallback((idx: number, chunk: string) => {
    navigator.clipboard.writeText(chunk);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  }, []);

  const handleStartEdit = useCallback((idx: number, chunk: string) => {
    setEditingIndex(idx);
    setEditText(chunk);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingIndex === null) return;
    const newChunks = [...nodeData.outputChunks];
    newChunks[editingIndex] = editText;
    updateNodeData(id, { outputChunks: newChunks });
    setEditingIndex(null);
  }, [editingIndex, editText, nodeData.outputChunks, id, updateNodeData]);

  const handleCancelEdit = useCallback(() => {
    setEditingIndex(null);
    setEditText("");
  }, []);

  const hasOutput = nodeData.outputChunks && nodeData.outputChunks.length > 0;

  return (
    <BaseNode
      id={id}
      title="Syllable Chunker"
      selected={selected}
      hasError={nodeData.status === "error"}
      minWidth={340}
      minHeight={320}
    >
      {/* Text input handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="text"
        data-handletype="text"
      />

      {/* Text output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="text"
        data-handletype="text"
      />

      <div className="flex-1 flex flex-col min-h-0 gap-2">
        {/* Target syllables slider */}
        <div className="flex flex-col gap-1 shrink-0">
          <div className="flex justify-between items-center">
            <label className="text-[9px] text-neutral-500">Target Syllables</label>
            <span className="text-[10px] text-neutral-400 font-mono">{nodeData.targetSyllables}</span>
          </div>
          <input
            type="range"
            min="1"
            max="100"
            value={nodeData.targetSyllables}
            onChange={handleTargetChange}
            className="nodrag w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
        </div>

        {/* Chunk prefix input */}
        <div className="flex flex-col gap-1 shrink-0">
          <label className="text-[9px] text-neutral-500">Chunk Prefix</label>
          <input
            type="text"
            value={currentPrefix}
            onChange={handlePrefixChange}
            placeholder="e.g., Dialogue: "
            className="nodrag w-full p-1.5 text-[11px] bg-neutral-800 border border-neutral-700 rounded text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>

        {/* Chunk selector dropdown (only when chunks exist) */}
        {hasOutput && (
          <div className="flex flex-col gap-1 shrink-0">
            <label className="text-[9px] text-neutral-500">Output Chunk</label>
            <select
              value={nodeData.selectedChunkIndex}
              onChange={handleChunkSelect}
              className="nodrag w-full p-1.5 text-[11px] bg-neutral-800 border border-neutral-700 rounded text-neutral-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {nodeData.outputChunks.map((_, idx) => (
                <option key={idx} value={idx}>
                  Chunk {idx + 1} of {nodeData.outputChunks.length}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Chunks display area */}
        <div className="relative flex-1 min-h-[100px] border border-dashed border-neutral-600 rounded p-2 overflow-hidden">
          {nodeData.status === "loading" ? (
            <div className="h-full flex items-center justify-center">
              <svg className="w-5 h-5 animate-spin text-purple-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : nodeData.status === "error" ? (
            <div className="h-full flex items-center justify-center">
              <span className="text-[10px] text-red-400 text-center px-2">{nodeData.error || "Failed"}</span>
            </div>
          ) : hasOutput ? (
            <div className="nodrag nopan nowheel h-full overflow-y-auto space-y-1.5">
              {nodeData.outputChunks.map((chunk, idx) => {
                const syllables = countSyllables(chunk);
                const isSelected = idx === nodeData.selectedChunkIndex;
                const isEditing = editingIndex === idx;
                const isCopied = copiedIndex === idx;

                if (isEditing) {
                  return (
                    <div
                      key={idx}
                      className="p-1.5 rounded bg-purple-600/30 border border-purple-500/50"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] font-medium text-neutral-200">Editing Chunk {idx + 1}</span>
                        <span className="text-[8px] text-purple-300">
                          {countSyllables(editText)} syl
                        </span>
                      </div>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="nodrag w-full h-20 p-1.5 text-[9px] bg-neutral-900 border border-neutral-600 rounded text-neutral-200 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
                        autoFocus
                      />
                      <div className="flex gap-1 mt-1">
                        <button
                          onClick={handleSaveEdit}
                          className="flex-1 py-1 text-[8px] bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="flex-1 py-1 text-[8px] bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={idx}
                    onClick={() => updateNodeData(id, { selectedChunkIndex: idx })}
                    className={`group p-1.5 rounded text-[9px] cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-purple-600/30 border border-purple-500/50 text-neutral-200'
                        : 'bg-neutral-700/30 border border-transparent text-neutral-400 hover:bg-neutral-700/50'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="font-medium">Chunk {idx + 1}</span>
                      <div className="flex items-center gap-1">
                        <span className={`text-[8px] ${isSelected ? 'text-purple-300' : 'text-neutral-500'}`}>
                          {syllables} syl
                        </span>
                        {/* Copy button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyChunk(idx, chunk);
                          }}
                          className={`opacity-0 group-hover:opacity-100 w-4 h-4 rounded flex items-center justify-center transition-all ${
                            isCopied ? 'bg-green-600 text-white opacity-100' : 'bg-neutral-600 hover:bg-neutral-500 text-neutral-300'
                          }`}
                          title="Copy chunk"
                        >
                          {isCopied ? (
                            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                        {/* Edit button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(idx, chunk);
                          }}
                          className="opacity-0 group-hover:opacity-100 w-4 h-4 rounded bg-neutral-600 hover:bg-blue-600 flex items-center justify-center text-neutral-300 hover:text-white transition-all"
                          title="Edit chunk"
                        >
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="line-clamp-2 leading-relaxed">
                      {chunk}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <span className="text-neutral-500 text-[10px] text-center">
                Connect text input and run to chunk by syllables
              </span>
            </div>
          )}

          {/* Clear button */}
          {hasOutput && editingIndex === null && (
            <button
              onClick={handleClear}
              className="absolute top-1 right-1 w-5 h-5 bg-neutral-800/80 hover:bg-red-600/80 rounded flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
              title="Clear output"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Status bar */}
        {hasOutput && (
          <div className="text-[9px] text-neutral-500 shrink-0">
            {nodeData.outputChunks.length} chunks generated
          </div>
        )}

        {/* Execute button */}
        <ExecuteButton nodeId={id} />
      </div>
    </BaseNode>
  );
});

SyllableChunkerNode.displayName = "SyllableChunkerNode";
