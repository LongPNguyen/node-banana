"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface ColorPickerProps {
  value: string | null;
  onChange: (color: string | null) => void;
  label: string;
  allowNone?: boolean;
  className?: string;
}

// Recommended colors palette (similar to CapCut)
const RECOMMENDED_COLORS = [
  // Row 1 - Light
  ["#FFFFFF", "#FF69B4", "#FFB6C1", "#FFDAB9", "#90EE90", "#ADD8E6", "#E6E6FA"],
  // Row 2 - Medium
  ["#808080", "#FF1493", "#FF6B6B", "#FFA500", "#32CD32", "#1E90FF", "#9370DB"],
  // Row 3 - Dark
  ["#000000", "#8B0000", "#C71585", "#B8860B", "#006400", "#00008B", "#4B0082"],
];

const STORAGE_KEY = "nodemango-recent-colors";

export function ColorPicker({ value, onChange, label, allowNone = true, className = "" }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load recent colors from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setRecentColors(JSON.parse(stored));
      }
    } catch {
      // Ignore errors
    }
  }, []);

  // Save recent color
  const addRecentColor = useCallback((color: string) => {
    setRecentColors(prev => {
      const filtered = prev.filter(c => c.toLowerCase() !== color.toLowerCase());
      const updated = [color, ...filtered].slice(0, 6);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore errors
      }
      return updated;
    });
  }, []);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleColorSelect = (color: string | null) => {
    onChange(color);
    if (color) {
      addRecentColor(color);
    }
    setIsOpen(false);
  };

  const handleCustomColor = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    onChange(color);
    addRecentColor(color);
  };

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverHeight = 280;
      const spaceBelow = window.innerHeight - rect.bottom;

      if (spaceBelow < popoverHeight && rect.top > popoverHeight) {
        setPosition({
          top: rect.top - popoverHeight - 4,
          left: rect.left,
        });
      } else {
        setPosition({
          top: rect.bottom + 4,
          left: rect.left,
        });
      }
    }
    setIsOpen(!isOpen);
  };

  const popoverContent = (
    <div
      ref={popoverRef}
      className="bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl p-3 min-w-[220px]"
      style={{ position: "fixed", top: position.top, left: position.left, zIndex: 99999 }}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header with current color */}
      <div className="flex items-center gap-2 pb-2 border-b border-neutral-700 mb-2">
        <div
          className="w-6 h-6 rounded-full border border-neutral-500"
          style={{ backgroundColor: value || "transparent" }}
        >
          {!value && (
            <svg className="w-6 h-6 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="4" x2="20" y2="20" />
            </svg>
          )}
        </div>
        <span className="text-[10px] text-neutral-300 font-medium">{label}</span>
        {/* Custom color picker */}
        <input
          type="color"
          value={value || "#ffffff"}
          onChange={handleCustomColor}
          className="nodrag ml-auto w-5 h-5 rounded cursor-pointer border-0"
          title="Pick custom color"
        />
      </div>

      {/* None option */}
      {allowNone && (
        <div className="mb-2">
          <button
            onClick={() => handleColorSelect(null)}
            className={`nodrag w-8 h-8 rounded border flex items-center justify-center transition-all ${
              !value ? "border-amber-500 ring-1 ring-amber-500" : "border-neutral-600 hover:border-neutral-500"
            }`}
            title="None"
          >
            <svg className="w-5 h-5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="4" x2="20" y2="20" />
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
          </button>
        </div>
      )}

      {/* Recent Colors */}
      {recentColors.length > 0 && (
        <div className="mb-2">
          <span className="text-[8px] text-neutral-500 uppercase tracking-wider">Recents</span>
          <div className="flex gap-1 mt-1">
            {recentColors.map((color, i) => (
              <button
                key={`${color}-${i}`}
                onClick={() => handleColorSelect(color)}
                className={`nodrag w-7 h-7 rounded border transition-all ${
                  value?.toLowerCase() === color.toLowerCase()
                    ? "border-amber-500 ring-1 ring-amber-500"
                    : "border-neutral-600 hover:border-neutral-500 hover:scale-110"
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recommended Colors */}
      <div>
        <span className="text-[8px] text-neutral-500 uppercase tracking-wider">Recommended</span>
        <div className="mt-1 space-y-1">
          {RECOMMENDED_COLORS.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-1">
              {row.map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorSelect(color)}
                  className={`nodrag w-7 h-7 rounded border transition-all ${
                    value?.toLowerCase() === color.toLowerCase()
                      ? "border-amber-500 ring-1 ring-amber-500"
                      : "border-neutral-600 hover:border-neutral-500 hover:scale-110"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`relative ${className}`}>
      {/* Color Button */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="nodrag w-7 h-6 rounded border border-neutral-600 flex items-center justify-center cursor-pointer hover:border-neutral-500 transition-colors"
        style={{ backgroundColor: value || "transparent" }}
        title={`${label}: ${value || "None"}`}
      >
        {!value && (
          <svg className="w-4 h-4 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="4" x2="20" y2="20" />
            <rect x="4" y="4" width="16" height="16" rx="2" />
          </svg>
        )}
      </button>

      {/* Popover via Portal */}
      {mounted && isOpen && createPortal(popoverContent, document.body)}
    </div>
  );
}
