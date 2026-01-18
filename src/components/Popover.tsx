"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";

interface PopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}

export function Popover({ trigger, children, isOpen, onOpenChange, className = "" }: PopoverProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update position when opening
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverHeight = 300; // Estimate
      const spaceBelow = window.innerHeight - rect.bottom;

      // Account for scroll position
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;

      if (spaceBelow < popoverHeight && rect.top > popoverHeight) {
        // Position above
        setPosition({
          top: rect.top + scrollY - popoverHeight - 4,
          left: rect.left + scrollX,
        });
      } else {
        // Position below
        setPosition({
          top: rect.bottom + scrollY + 4,
          left: rect.left + scrollX,
        });
      }
    }
  }, [isOpen]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onOpenChange(false);
      }
    };

    if (isOpen) {
      // Delay to prevent immediate close on the same click that opened it
      setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 0);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onOpenChange]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onOpenChange]);

  return (
    <>
      <div ref={triggerRef} onClick={() => onOpenChange(!isOpen)}>
        {trigger}
      </div>
      {mounted && isOpen && createPortal(
        <div
          ref={popoverRef}
          className={`absolute z-[9999] ${className}`}
          style={{ top: position.top, left: position.left }}
        >
          {children}
        </div>,
        document.body
      )}
    </>
  );
}
