"use client";

import { memo, useState, useCallback } from "react";
import { useWorkflowStore } from "@/store/workflowStore";
import { WorkflowMetadata } from "@/types";

export const WorkflowSidebar = memo(() => {
  const sidebarOpen = useWorkflowStore((state) => state.sidebarOpen);
  const setSidebarOpen = useWorkflowStore((state) => state.setSidebarOpen);
  const workflowList = useWorkflowStore((state) => state.workflowList);
  const currentWorkflowId = useWorkflowStore((state) => state.currentWorkflowId);
  const createNewWorkflow = useWorkflowStore((state) => state.createNewWorkflow);
  const switchWorkflow = useWorkflowStore((state) => state.switchWorkflow);
  const deleteWorkflow = useWorkflowStore((state) => state.deleteWorkflow);
  const renameWorkflow = useWorkflowStore((state) => state.renameWorkflow);
  const saveWorkflow = useWorkflowStore((state) => state.saveWorkflow);
  const isRunning = useWorkflowStore((state) => state.isRunning);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreateNew = useCallback(() => {
    createNewWorkflow();
  }, [createNewWorkflow]);

  const handleSaveToFile = useCallback(() => {
    const currentWorkflow = workflowList.find((w) => w.id === currentWorkflowId);
    saveWorkflow(currentWorkflow?.name);
  }, [saveWorkflow, workflowList, currentWorkflowId]);

  const handleSwitch = useCallback(
    (id: string) => {
      if (id !== currentWorkflowId && !isRunning) {
        switchWorkflow(id);
      }
    },
    [currentWorkflowId, switchWorkflow, isRunning]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (workflowList.length <= 1) return; // Don't delete last workflow
      if (confirm("Delete this workflow?")) {
        deleteWorkflow(id);
      }
    },
    [workflowList.length, deleteWorkflow]
  );

  const handleStartRename = useCallback(
    (e: React.MouseEvent, workflow: WorkflowMetadata) => {
      e.stopPropagation();
      setEditingId(workflow.id);
      setEditName(workflow.name);
    },
    []
  );

  const handleFinishRename = useCallback(() => {
    if (editingId && editName.trim()) {
      renameWorkflow(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName("");
  }, [editingId, editName, renameWorkflow]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleFinishRename();
      } else if (e.key === "Escape") {
        setEditingId(null);
        setEditName("");
      }
    },
    [handleFinishRename]
  );

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Closed state - just show toggle button
  if (!sidebarOpen) {
    return (
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed left-3 top-16 z-40 w-9 h-9 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
        title="Open workflows"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"
          />
        </svg>
      </button>
    );
  }

  // Open state - show sidebar panel
  return (
    <div className="fixed left-0 top-12 bottom-0 w-64 bg-neutral-900 border-r border-neutral-700 z-30 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-neutral-700">
        <h2 className="text-sm font-medium text-neutral-200">Workflows</h2>
        <div className="flex gap-1">
          <button
            onClick={handleCreateNew}
            className="w-7 h-7 bg-green-600 hover:bg-green-500 rounded flex items-center justify-center text-white transition-colors"
            title="New workflow"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
          <button
            onClick={handleSaveToFile}
            className="w-7 h-7 bg-blue-600 hover:bg-blue-500 rounded flex items-center justify-center text-white transition-colors"
            title="Save workflow to file"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="w-7 h-7 bg-neutral-700 hover:bg-neutral-600 rounded flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
            title="Close sidebar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Workflow List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {workflowList.map((workflow) => (
          <div
            key={workflow.id}
            onClick={() => handleSwitch(workflow.id)}
            className={`group p-2.5 rounded-lg cursor-pointer transition-colors ${
              workflow.id === currentWorkflowId
                ? "bg-blue-600/30 border border-blue-500/50"
                : "bg-neutral-800/50 border border-transparent hover:bg-neutral-800 hover:border-neutral-700"
            } ${isRunning && workflow.id !== currentWorkflowId ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {editingId === workflow.id ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleFinishRename}
                onKeyDown={handleKeyDown}
                className="w-full text-sm bg-neutral-700 border border-neutral-600 rounded px-2 py-1 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-neutral-200 truncate">{workflow.name}</div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">{formatDate(workflow.updatedAt)}</div>
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                  <button
                    onClick={(e) => handleStartRename(e, workflow)}
                    className="w-5 h-5 bg-neutral-700/80 hover:bg-blue-600/80 rounded flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                    title="Rename"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                      />
                    </svg>
                  </button>
                  {workflowList.length > 1 && (
                    <button
                      onClick={(e) => handleDelete(e, workflow.id)}
                      className="w-5 h-5 bg-neutral-700/80 hover:bg-red-600/80 rounded flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                      title="Delete"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <div className="p-2 border-t border-neutral-700">
        <div className="text-[10px] text-neutral-500 text-center">
          {workflowList.length} workflow{workflowList.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
});

WorkflowSidebar.displayName = "WorkflowSidebar";
