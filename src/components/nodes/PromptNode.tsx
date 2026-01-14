"use client";

import { useCallback, useState, memo } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { PromptNodeData } from "@/types";
import { useToast } from "@/components/Toast";

type PromptNodeType = Node<PromptNodeData, "prompt">;

export const PromptNode = memo(({ id, data, selected }: NodeProps<PromptNodeType>) => {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const { show: showToast } = useToast();
  const [isCopying, setIsCopying] = useState(false);

  const handleCopy = useCallback(() => {
    if (nodeData.prompt) {
      navigator.clipboard.writeText(nodeData.prompt);
      setIsCopying(true);
      showToast("Prompt copied to clipboard", "success");
      setTimeout(() => setIsCopying(false), 2000);
    }
  }, [nodeData.prompt, showToast]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { prompt: e.target.value });
    },
    [id, updateNodeData]
  );

  return (
    <BaseNode id={id} title="Prompt" selected={selected}>
      <div className="relative group flex-1 flex flex-col">
        <textarea
          value={nodeData.prompt}
          onChange={handleChange}
          placeholder="Describe what to generate..."
          className="nodrag nopan nowheel w-full flex-1 min-h-[70px] p-2 text-xs leading-relaxed text-neutral-100 border border-neutral-700 rounded bg-neutral-900/50 resize-none focus:outline-none focus:ring-1 focus:ring-neutral-600 focus:border-neutral-600 placeholder:text-neutral-500"
        />
        <button
          onClick={handleCopy}
          className={`absolute top-1 right-1 w-5 h-5 ${isCopying ? 'bg-green-600/80' : 'bg-neutral-900/80'} hover:bg-green-600/80 rounded opacity-0 group-hover:opacity-100 flex items-center justify-center text-neutral-400 hover:text-white transition-all`}
          title="Copy to clipboard"
        >
          {isCopying ? (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
            </svg>
          )}
        </button>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="text"
        data-handletype="text"
      />
    </BaseNode>
  );
});

PromptNode.displayName = "PromptNode";
