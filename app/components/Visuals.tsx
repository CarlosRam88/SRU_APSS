"use client";

import { useMemo, useState } from "react";
import LongitudinalChart, { ActivityStat } from "./LongitudinalChart";
import PlayerRadarChart from "./PlayerRadarChart";

type Activity = {
  id: string;
  name: string;
  start_time: number;
  day_code: string | null;
};

type Props = {
  activities: Activity[];
  stats: ActivityStat[];
  hasFetched: boolean;
  loading: boolean;
};

function toDateString(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

export default function Visuals({ activities, stats, hasFetched, loading }: Props) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedDayCodes, setSelectedDayCodes] = useState<string[]>([]);

  const dataRange = useMemo(() => {
    if (activities.length === 0) return null;
    const timestamps = activities.map((a) => a.start_time);
    return {
      min: toDateString(Math.min(...timestamps)),
      max: toDateString(Math.max(...timestamps)),
    };
  }, [activities]);

  const allDayCodes = useMemo(() => {
    const codes = activities.map((a) => a.day_code).filter((c): c is string => !!c);
    return Array.from(new Set(codes)).sort();
  }, [activities]);

  const filteredActivities = useMemo(() => {
    return activities.filter((a) => {
      const d = toDateString(a.start_time);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      if (selectedDayCodes.length > 0 && (!a.day_code || !selectedDayCodes.includes(a.day_code))) return false;
      return true;
    });
  }, [activities, fromDate, toDate, selectedDayCodes]);

  const filteredStats = useMemo(() => {
    const ids = new Set(filteredActivities.map((a) => a.id));
    return stats.filter((s) => ids.has(s.activity_id));
  }, [stats, filteredActivities]);

  function toggleDayCode(code: string) {
    setSelectedDayCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  const hasFilters = fromDate || toDate || selectedDayCodes.length > 0;

  if (!hasFetched || loading) {
    return (
      <p className="text-[var(--bp-muted)] text-sm">
        {loading ? "Loading activities…" : "Use the filters above to fetch activities."}
      </p>
    );
  }

  if (activities.length === 0) {
    return <p className="text-[var(--bp-muted)] text-sm">No activities found for the selected filters.</p>;
  }

  if (stats.length === 0) {
    return <p className="text-[var(--bp-muted)] text-sm">Loading stats…</p>;
  }

  const inputClass = "bg-[var(--bp-bg)] border border-[var(--bp-border)] text-[var(--bp-text)] text-sm rounded px-3 py-2 focus:outline-none focus:border-[var(--bp-accent)] cursor-pointer";
  const labelClass = "text-xs uppercase tracking-wider text-[var(--bp-muted)]";
  const btnBase = "px-2.5 py-1 text-xs rounded border transition-colors";
  const btnActive = "border-[var(--bp-accent)] text-[var(--bp-accent)] bg-[var(--bp-accent)]/10";
  const btnInactive = "border-[var(--bp-border)] text-[var(--bp-muted)] hover:border-[var(--bp-accent)]/50";

  return (
    <div className="flex flex-col gap-6">
      {/* Filters */}
      <div className="bg-[var(--bp-surface)] border border-[var(--bp-border)] rounded-lg p-4 flex flex-wrap gap-5 items-end">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>From</label>
          <input
            type="date"
            value={fromDate}
            min={dataRange?.min}
            max={toDate || dataRange?.max}
            onChange={(e) => setFromDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>To</label>
          <input
            type="date"
            value={toDate}
            min={fromDate || dataRange?.min}
            max={dataRange?.max}
            onChange={(e) => setToDate(e.target.value)}
            className={inputClass}
          />
        </div>
        {allDayCodes.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Day Code</span>
            <div className="flex flex-wrap gap-1.5">
              {allDayCodes.map((code) => (
                <button
                  key={code}
                  onClick={() => toggleDayCode(code)}
                  className={`${btnBase} ${selectedDayCodes.includes(code) ? btnActive : btnInactive}`}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center gap-3">
          {hasFilters && (
            <button
              onClick={() => { setFromDate(""); setToDate(""); setSelectedDayCodes([]); }}
              className={`${btnBase} ${btnInactive}`}
            >
              Clear all
            </button>
          )}
          <p className="text-xs text-[var(--bp-muted)]">
            {filteredActivities.length} of {activities.length} activities
          </p>
        </div>
      </div>

      <LongitudinalChart activities={filteredActivities} stats={filteredStats} />
      <PlayerRadarChart activities={filteredActivities} stats={filteredStats} />
    </div>
  );
}
