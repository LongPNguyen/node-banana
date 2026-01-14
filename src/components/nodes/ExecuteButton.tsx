"use client";

import { useCallback, memo } from "react";
import { useWorkflowStore } from "@/store/workflowStore";

interface ExecuteButtonProps {
  nodeId: string;
}

export const ExecuteButton = memo(({ nodeId }: ExecuteButtonProps) => {
  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const currentNodeId = useWorkflowStore((state) => state.currentNodeId);

  const isThisNodeRunning = isRunning && currentNodeId === nodeId;

  const handleExecute = useCallback(() => {
    regenerateNode(nodeId);
  }, [nodeId, regenerateNode]);

  return (
    <button
      onClick={handleExecute}
      disabled={isRunning}
      className="w-full py-1.5 text-[11px] font-medium bg-green-600 hover:bg-green-500 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white rounded flex items-center justify-center gap-1.5 transition-colors shrink-0 mt-1"
      title={isRunning ? "Workflow running..." : "Execute this node"}
    >
      {isThisNodeRunning ? (
        <>
          <svg
            className="w-3.5 h-3.5 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Running...</span>
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          <span>Execute</span>
        </>
      )}
    </button>
  );
});

ExecuteButton.displayName = "ExecuteButton";
