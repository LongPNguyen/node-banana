"use client";

import { useSettingsStore } from "@/store/settingsStore";

export function Header() {
  const setSettingsOpen = useSettingsStore((state) => state.setSettingsOpen);

  return (
    <header className="h-11 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-2">
        <img src="/banana_icon.png" alt="Banana" className="w-6 h-6" />
        <h1 className="text-2xl font-semibold text-neutral-100 tracking-tight">Node Banana</h1>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-1.5 hover:bg-neutral-800 rounded transition-colors text-neutral-400 hover:text-neutral-200"
          title="Settings"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <a
          href="https://x.com/ReflctWillie"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          Made by Willie
        </a>
      </div>
    </header>
  );
}
