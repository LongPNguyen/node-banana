"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface FontPickerProps {
  value: string;
  onChange: (font: string) => void;
  fonts: string[];
  className?: string;
}

const CUSTOM_FONTS_KEY = "nodemango-custom-fonts";

// Load a Google Font dynamically and return a promise
function loadGoogleFont(fontName: string): Promise<void> {
  return new Promise((resolve) => {
    const formattedName = fontName.replace(/ /g, "+");
    const linkId = `google-font-${formattedName}`;

    // Check if already loaded
    if (document.getElementById(linkId)) {
      resolve();
      return;
    }

    const link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${formattedName}:wght@400;700;900&display=swap`;

    link.onload = () => {
      // Wait a bit for the font to be applied
      setTimeout(resolve, 100);
    };
    link.onerror = () => resolve();

    document.head.appendChild(link);
  });
}

export function FontPicker({ value, onChange, fonts, className = "" }: FontPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);
  const [customFonts, setCustomFonts] = useState<string[]>([]);
  const [newFontName, setNewFontName] = useState("");
  const [showAddInput, setShowAddInput] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(0); // Counter to force re-render
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    // Load custom fonts from localStorage
    try {
      const stored = localStorage.getItem(CUSTOM_FONTS_KEY);
      if (stored) {
        const storedFonts = JSON.parse(stored) as string[];
        setCustomFonts(storedFonts);
        // Load each custom font and trigger re-render when done
        Promise.all(storedFonts.map(loadGoogleFont)).then(() => {
          setFontsLoaded(prev => prev + 1);
        });
      }
    } catch {
      // Ignore
    }
  }, []);

  // Load current font if it's a custom one
  useEffect(() => {
    if (value && !fonts.includes(value)) {
      loadGoogleFont(value);
    }
  }, [value, fonts]);

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
        setShowAddInput(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleFontSelect = (font: string) => {
    onChange(font);
    setIsOpen(false);
    setShowAddInput(false);
  };

  const handleAddFont = useCallback(async () => {
    const fontName = newFontName.trim();
    if (!fontName) return;

    // Check if already exists
    if (fonts.includes(fontName) || customFonts.includes(fontName)) {
      setNewFontName("");
      setShowAddInput(false);
      return;
    }

    // Load the font and wait for it
    await loadGoogleFont(fontName);

    // Add to custom fonts
    const updated = [...customFonts, fontName];
    setCustomFonts(updated);

    // Save to localStorage
    try {
      localStorage.setItem(CUSTOM_FONTS_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }

    // Force re-render to show font properly
    setFontsLoaded(prev => prev + 1);

    // Select the new font
    onChange(fontName);
    setNewFontName("");
    setShowAddInput(false);
    setIsOpen(false);
  }, [newFontName, fonts, customFonts, onChange]);

  const handleRemoveCustomFont = useCallback((fontName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customFonts.filter(f => f !== fontName);
    setCustomFonts(updated);
    try {
      localStorage.setItem(CUSTOM_FONTS_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  }, [customFonts]);

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverHeight = 320;
      const spaceBelow = window.innerHeight - rect.bottom;

      if (spaceBelow < popoverHeight && rect.top > popoverHeight) {
        setPosition({
          top: rect.top - Math.min(popoverHeight, rect.top - 10),
          left: rect.left,
          width: Math.max(rect.width, 200),
        });
      } else {
        setPosition({
          top: rect.bottom + 4,
          left: rect.left,
          width: Math.max(rect.width, 200),
        });
      }
    }
    setIsOpen(!isOpen);
    if (isOpen) {
      setShowAddInput(false);
    }
  };

  const allFonts = [...fonts, ...customFonts];

  const popoverContent = (
    <div
      ref={popoverRef}
      className="bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl flex flex-col"
      style={{ position: "fixed", top: position.top, left: position.left, width: position.width, maxHeight: 320, zIndex: 99999 }}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Add Google Font Button/Input */}
      <div className="p-2 border-b border-neutral-700">
        {showAddInput ? (
          <div className="flex gap-1">
            <input
              ref={inputRef}
              type="text"
              value={newFontName}
              onChange={(e) => setNewFontName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddFont();
                if (e.key === "Escape") {
                  setShowAddInput(false);
                  setNewFontName("");
                }
              }}
              placeholder="e.g. Poppins, Roboto..."
              className="flex-1 px-2 py-1 text-[10px] bg-neutral-900 border border-neutral-600 rounded text-neutral-200 placeholder-neutral-500"
              autoFocus
            />
            <button
              onClick={handleAddFont}
              className="px-2 py-1 text-[9px] bg-green-600 hover:bg-green-500 rounded text-white"
            >
              Add
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setShowAddInput(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            className="w-full py-1.5 text-[9px] text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 rounded transition-colors flex items-center justify-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Google Font
          </button>
        )}
      </div>

      {/* Font List */}
      <div className="overflow-y-auto flex-1">
        {/* Custom Fonts Section */}
        {customFonts.length > 0 && (
          <>
            <div className="px-2 py-1 text-[8px] text-neutral-500 uppercase tracking-wider bg-neutral-900/50">
              Custom Fonts
            </div>
            {customFonts.map((font) => (
              <div
                key={font}
                className={`flex items-center justify-between hover:bg-neutral-700 ${
                  value === font ? "bg-amber-600/30" : ""
                }`}
              >
                <button
                  onClick={() => handleFontSelect(font)}
                  className={`nodrag flex-1 py-2 px-3 text-left text-[11px] transition-colors ${
                    value === font ? "text-amber-300" : "text-neutral-300"
                  }`}
                  style={{ fontFamily: font }}
                >
                  {font}
                </button>
                <button
                  onClick={(e) => handleRemoveCustomFont(font, e)}
                  className="px-2 text-neutral-500 hover:text-red-400"
                  title="Remove font"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </>
        )}

        {/* Built-in Fonts */}
        <div className="px-2 py-1 text-[8px] text-neutral-500 uppercase tracking-wider bg-neutral-900/50">
          Built-in Fonts
        </div>
        {fonts.map((font) => (
          <button
            key={font}
            onClick={() => handleFontSelect(font)}
            className={`nodrag w-full py-2 px-3 text-left text-[11px] transition-colors hover:bg-neutral-700 ${
              value === font ? "bg-amber-600/30 text-amber-300" : "text-neutral-300"
            }`}
            style={{ fontFamily: font }}
          >
            {font}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className={`relative flex-1 ${className}`}>
      {/* Font Button - shows current font in its style */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="nodrag w-full py-1 px-2 text-left text-[10px] bg-neutral-900 border border-neutral-600 rounded hover:border-neutral-500 transition-colors flex items-center justify-between"
        style={{ fontFamily: value }}
      >
        <span className="truncate">{value}</span>
        <svg
          className={`w-3 h-3 text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown via Portal */}
      {mounted && isOpen && createPortal(popoverContent, document.body)}
    </div>
  );
}
