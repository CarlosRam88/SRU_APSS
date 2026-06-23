"use client";

import { useEffect, useRef, useState } from "react";
import { METRICS, ALL_METRIC_KEYS, MetricKey } from "./metrics";

type Props = {
  selected: MetricKey[];
  onChange: (next: MetricKey[]) => void;
};

// Touch-friendly multi-select dropdown for choosing which metrics populate the
// dashboard. At least one metric must always remain selected.
export default function MetricSelector({ selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(key: MetricKey) {
    if (selected.includes(key)) {
      if (selected.length === 1) return; // keep at least one selected
      onChange(selected.filter((k) => k !== key));
    } else {
      onChange([...selected, key]);
    }
  }

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs uppercase tracking-wider text-[var(--bp-muted)] mb-1.5">
        Metrics
      </label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between gap-3 bg-[var(--bp-bg)] border border-[var(--bp-border)] text-[var(--bp-text)] text-sm rounded px-3 py-2 min-w-44 focus:outline-none focus:border-[var(--bp-accent)] hover:border-[var(--bp-accent)]/50 transition-colors"
      >
        <span>{selected.length} of {METRICS.length} selected</span>
        <span className="text-[var(--bp-muted)]">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-60 rounded-lg border border-[var(--bp-border)] bg-[var(--bp-surface)] shadow-xl">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--bp-border)]">
            <button
              type="button"
              onClick={() => onChange([...ALL_METRIC_KEYS])}
              className="text-xs text-[var(--bp-accent)] hover:underline"
            >
              Select all
            </button>
            <span className="text-xs text-[var(--bp-muted)]">{selected.length} selected</span>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {METRICS.map((m) => {
              const active = selected.includes(m.key);
              const isLastSelected = active && selected.length === 1;
              return (
                <label
                  key={m.key}
                  className={`flex items-center gap-2.5 px-3 py-2 text-sm select-none transition-colors ${
                    isLastSelected
                      ? "opacity-60 cursor-not-allowed"
                      : "cursor-pointer hover:bg-[var(--bp-border)]/20"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    disabled={isLastSelected}
                    onChange={() => toggle(m.key)}
                    className="accent-[var(--bp-accent)] w-4 h-4"
                  />
                  <span className="text-[var(--bp-text)]">{m.shortLabel}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
