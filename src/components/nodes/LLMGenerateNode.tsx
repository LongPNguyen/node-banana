"use client";

import { useCallback, useState, memo } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { ExecuteButton } from "./ExecuteButton";
import { useWorkflowStore } from "@/store/workflowStore";
import { LLMGenerateNodeData, LLMProvider, LLMModelType } from "@/types";
import { useToast } from "@/components/Toast";

const PROVIDERS: { value: LLMProvider; label: string }[] = [
  { value: "google", label: "Google" },
  { value: "openai", label: "OpenAI" },
];

const MODELS: Record<LLMProvider, { value: LLMModelType; label: string; supportsSearch?: boolean }[]> = {
  google: [
    { value: "gemini-3-flash", label: "⚡ Gemini 3 Flash", supportsSearch: true },
    { value: "gemini-3-pro", label: "🧠 Gemini 3 Pro", supportsSearch: true },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  ],
  openai: [
    { value: "gpt-4.1", label: "GPT-4.1" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
  ],
};

// Models that support Google Search
const SEARCH_SUPPORTED_MODELS = new Set(["gemini-3-flash", "gemini-3-pro"]);

type LLMGenerateNodeType = Node<LLMGenerateNodeData, "llmGenerate">;

export const LLMGenerateNode = memo(({ id, data, selected }: NodeProps<LLMGenerateNodeType>) => {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  const handleProviderChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newProvider = e.target.value as LLMProvider;
      const firstModelForProvider = MODELS[newProvider][0].value;
      updateNodeData(id, {
        provider: newProvider,
        model: firstModelForProvider
      });
    },
    [id, updateNodeData]
  );

  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { model: e.target.value as LLMModelType });
    },
    [id, updateNodeData]
  );

  const handleTemperatureChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { temperature: parseFloat(e.target.value) });
    },
    [id, updateNodeData]
  );

  const handleMaxTokensChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { maxTokens: parseInt(e.target.value, 10) });
    },
    [id, updateNodeData]
  );

  const handleSearchToggle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { useGoogleSearch: e.target.checked });
    },
    [id, updateNodeData]
  );

  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);

  const handleRegenerate = useCallback(() => {
    regenerateNode(id);
  }, [id, regenerateNode]);

  const handleClearOutput = useCallback(() => {
    updateNodeData(id, { outputText: null, status: "idle", error: null });
  }, [id, updateNodeData]);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { outputText: e.target.value });
    },
    [id, updateNodeData]
  );

  const { show: showToast } = useToast();
  const [isCopying, setIsCopying] = useState(false);

  const handleCopy = useCallback(() => {
    if (nodeData.outputText) {
      navigator.clipboard.writeText(nodeData.outputText);
      setIsCopying(true);
      showToast("Prompt copied to clipboard", "success");
      setTimeout(() => setIsCopying(false), 2000);
    }
  }, [nodeData.outputText, showToast]);

  const availableModels = MODELS[nodeData.provider];
  const showSearchToggle = nodeData.provider === "google" && SEARCH_SUPPORTED_MODELS.has(nodeData.model);

  return (
    <BaseNode
      id={id}
      title="LLM Generate"
      selected={selected}
      hasError={nodeData.status === "error"}
    >
      {/* Image input */}
      <Handle
        type="target"
        position={Position.Left}
        id="image"
        style={{ top: "20%" }}
        data-handletype="image"
      />
      {/* Text input (instruction/prompt) */}
      <Handle
        type="target"
        position={Position.Left}
        id="text"
        style={{ top: "50%" }}
        data-handletype="text"
      />
      {/* Context input (content to process) */}
      <Handle
        type="target"
        position={Position.Left}
        id="context"
        style={{ top: "80%" }}
        data-handletype="context"
      />
      {/* Image output (passthrough) */}
      <Handle
        type="source"
        position={Position.Right}
        id="image"
        style={{ top: "20%" }}
        data-handletype="image"
      />
      {/* Text output */}
      <Handle
        type="source"
        position={Position.Right}
        id="text"
        style={{ top: "50%" }}
        data-handletype="text"
      />

      {/* Handle labels */}
      <div className="absolute left-1 text-[8px] text-neutral-500 pointer-events-none" style={{ top: "18%" }}>img</div>
      <div className="absolute left-1 text-[8px] text-neutral-500 pointer-events-none" style={{ top: "48%" }}>text</div>
      <div className="absolute left-1 text-[8px] text-neutral-500 pointer-events-none" style={{ top: "78%" }}>ctx</div>

      <div className="flex-1 flex flex-col min-h-0 gap-2">
        {/* Image passthrough info */}
        <div className="text-[9px] text-neutral-500 shrink-0">
          Images in/out: {nodeData.outputImages?.length ?? 0}
        </div>
        {/* Output preview area */}
        <div className="relative group w-full flex-1 min-h-[80px] border border-dashed border-neutral-600 rounded p-2 overflow-auto">
          {nodeData.status === "loading" ? (
            <div className="h-full flex items-center justify-center">
              <svg
                className="w-4 h-4 animate-spin text-neutral-400"
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
            </div>
          ) : nodeData.status === "error" ? (
            <span className="text-[10px] text-red-400">
              {nodeData.error || "Failed"}
            </span>
          ) : nodeData.outputText !== null ? (
            <>
              <textarea
                value={nodeData.outputText}
                onChange={handleTextChange}
                className="nodrag nopan nowheel w-full h-full text-[10px] text-neutral-300 bg-transparent resize-none border-none outline-none pr-6"
                placeholder="Edit generated text..."
              />
              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={handleCopy}
                  className={`w-5 h-5 ${isCopying ? 'bg-green-600/80' : 'bg-neutral-900/80'} hover:bg-green-600/80 rounded flex items-center justify-center text-neutral-400 hover:text-white transition-colors`}
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
                  onClick={handleClearOutput}
                  className="w-5 h-5 bg-neutral-900/80 hover:bg-red-600/80 rounded flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                  title="Clear output"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center">
              <span className="text-neutral-500 text-[10px]">
                Run to generate
              </span>
            </div>
          )}
        </div>

        {/* Provider selector */}
        <select
          value={nodeData.provider}
          onChange={handleProviderChange}
          className="w-full text-[10px] py-1 px-1.5 border border-neutral-700 rounded bg-neutral-900/50 focus:outline-none focus:ring-1 focus:ring-neutral-600 text-neutral-300 shrink-0"
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        {/* Model selector */}
        <select
          value={nodeData.model}
          onChange={handleModelChange}
          className="w-full text-[10px] py-1 px-1.5 border border-neutral-700 rounded bg-neutral-900/50 focus:outline-none focus:ring-1 focus:ring-neutral-600 text-neutral-300 shrink-0"
        >
          {availableModels.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        {/* Google Search toggle (Gemini 3 only) */}
        {showSearchToggle && (
          <label className="flex items-center gap-1.5 text-[10px] text-neutral-400 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={nodeData.useGoogleSearch ?? false}
              onChange={handleSearchToggle}
              className="w-3 h-3 accent-blue-500 cursor-pointer"
            />
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
              </svg>
              Web Search
            </span>
          </label>
        )}

        {/* Temperature and Max Tokens row */}
        <div className="flex gap-1.5 shrink-0">
          <div className="flex-1 flex flex-col gap-0.5">
            <label className="text-[9px] text-neutral-500">Temp: {nodeData.temperature.toFixed(1)}</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={nodeData.temperature}
              onChange={handleTemperatureChange}
              className="w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-neutral-400"
            />
          </div>
          <select
            value={nodeData.maxTokens}
            onChange={handleMaxTokensChange}
            className="w-16 text-[10px] py-1 px-1 border border-neutral-700 rounded bg-neutral-900/50 focus:outline-none focus:ring-1 focus:ring-neutral-600 text-neutral-300"
            title="Max tokens"
          >
            <option value={256}>256</option>
            <option value={512}>512</option>
            <option value={1024}>1K</option>
            <option value={2048}>2K</option>
            <option value={4096}>4K</option>
          </select>
        </div>

        {/* Execute button */}
        <ExecuteButton nodeId={id} />
      </div>
    </BaseNode>
  );
});

LLMGenerateNode.displayName = "LLMGenerateNode";
