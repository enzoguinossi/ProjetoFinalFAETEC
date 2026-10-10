"use client";

import { useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
}

export default function Modal({ open, onClose, title, children, width }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-[rgba(0,0,0,0.4)] flex items-center justify-center z-[1000]"
      onClick={onClose}
    >
      <div
        className="bg-white border-t-[13px] border-[#1b9956] rounded-[26px] w-[728px] max-h-[90vh] flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.15)] overflow-hidden"
        style={width ? { width } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between pt-4 px-5 shrink-0">
            <h2 className="font-display text-[1.25rem] [font-weight:590] tracking-[-0.028125rem] leading-[1.5625rem] m-0 text-ink-strong">
              {title}
            </h2>
            <button
              className="flex items-center justify-center w-8 h-8 border-none rounded-md bg-transparent cursor-pointer text-ink hover:bg-[#f2f4f8]"
              onClick={onClose}
              type="button"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
        <div className="overflow-y-auto p-8">{children}</div>
      </div>
    </div>
  );
}
