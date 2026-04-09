"use client";

import { useEffect, useMemo, useState } from "react";
import ActivityDropdown from "./ActivityDropdown";
import SessionTable from "./SessionTable";

type Activity = {
  id: string;
  name: string;
  start_time: number;
  day_code: string | null;
};

type PlayerStat = {
  athlete_name: string;
  total_distance: number;
  high_speed_distance?: number;
  high_speed_percentage?: number;
  total_player_load?: number;
  rhie_bout_count?: number;
  percentage_max_velocity?: number;
  position?: string | null;
};

type DashboardProps = {
  activities: Activity[];
  hasFetched: boolean;
  loading: boolean;
  onActivityChange?: (activityId: string) => void;
};

export default function Dashboard({ activities, hasFetched, loading, onActivityChange }: DashboardProps) {
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [sessions, setSessions] = useState<PlayerStat[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);

  useEffect(() => {
    if (activities.length > 0) {
      setSelectedActivityId(activities[0].id);
      onActivityChange?.(activities[0].id);
    } else {
      setSelectedActivityId("");
      onActivityChange?.("");
      setSessions([]);
    }
  }, [activities, onActivityChange]);

  useEffect(() => {
    if (!selectedActivityId) return;
    setSessionsLoading(true);
    Promise.all([
      fetch(`/api/sessions?activityId=${selectedActivityId}`).then((r) => r.json()),
      fetch(`/api/activity-athletes?activityIds=${selectedActivityId}`).then((r) => r.json()),
    ]).then(([sessionsData, athletesData]) => {
      const positionMap = new Map<string, string>();
      if (Array.isArray(athletesData)) {
        athletesData.forEach((a: any) => {
          if (a.position) positionMap.set(a.athlete_name, a.position);
        });
      }
      const enriched = Array.isArray(sessionsData)
        ? sessionsData.map((s: PlayerStat) => ({
            ...s,
            position: positionMap.get(s.athlete_name) ?? null,
          }))
        : [];
      setSessions(enriched);
      setSessionsLoading(false);
    });
  }, [selectedActivityId]);

  // Reset position filter when session changes
  useEffect(() => {
    setSelectedPositions([]);
  }, [selectedActivityId]);

  const allPositions = useMemo(() => {
    const positions = sessions
      .map((s) => s.position)
      .filter((p): p is string => !!p);
    return Array.from(new Set(positions)).sort();
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    if (selectedPositions.length === 0) return sessions;
    return sessions.filter((s) => s.position && selectedPositions.includes(s.position));
  }, [sessions, selectedPositions]);

  const squadSummary = useMemo(() => {
    const rows = filteredSessions;
    if (rows.length === 0) return null;
    const avg = (key: keyof PlayerStat) => {
      const vals = rows.map((r) => r[key] as number).filter((v) => v != null && !isNaN(v));
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };
    return {
      players: rows.length,
      avg_distance: avg("total_distance"),
      avg_hsd: avg("high_speed_distance"),
      avg_hsr: avg("high_speed_percentage"),
      avg_load: avg("total_player_load"),
      avg_rhie: avg("rhie_bout_count"),
      avg_max_vel: avg("percentage_max_velocity"),
    };
  }, [filteredSessions]);

  function exportCSV() {
    const activity = activities.find((a: Activity) => a.id === selectedActivityId);
    const headers = ["Player", "Position", "Total Distance (m)", "HSD (m)", "HSR %", "Player Load", "RHIE Bouts", "% Max Vel."];
    const rows = filteredSessions.map((s) => [
      s.athlete_name,
      s.position ?? "",
      Math.round(s.total_distance),
      s.high_speed_distance !== undefined ? Math.round(s.high_speed_distance) : "",
      s.high_speed_percentage !== undefined ? s.high_speed_percentage.toFixed(1) : "",
      s.total_player_load !== undefined ? s.total_player_load.toFixed(1) : "",
      s.rhie_bout_count ?? "",
      s.percentage_max_velocity !== undefined ? s.percentage_max_velocity.toFixed(1) : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activity?.name ?? "session"}.csv`.replace(/[^a-z0-9.\-_]/gi, "_");
    a.click();
    URL.revokeObjectURL(url);
  }

  function togglePosition(pos: string) {
    setSelectedPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  }

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

  const btnBase = "px-2.5 py-1 text-xs rounded border transition-colors";
  const btnActive = "border-[var(--bp-accent)] text-[var(--bp-accent)] bg-[var(--bp-accent)]/10";
  const btnInactive = "border-[var(--bp-border)] text-[var(--bp-muted)] hover:border-[var(--bp-accent)]/50";

  return (
    <div>
      <div className="flex flex-wrap gap-4 items-end mb-6">
        <ActivityDropdown
          activities={activities}
          selectedActivityId={selectedActivityId}
          onSelectActivity={(id) => { setSelectedActivityId(id); onActivityChange?.(id); }}
        />
      </div>

      {/* Squad summary bar */}
      {squadSummary && !sessionsLoading && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
          {[
            { label: "Players", value: squadSummary.players, decimals: 0, unit: "" },
            { label: "Avg Distance", value: squadSummary.avg_distance, decimals: 0, unit: "m" },
            { label: "Avg HSD", value: squadSummary.avg_hsd, decimals: 0, unit: "m" },
            { label: "Avg HSR %", value: squadSummary.avg_hsr, decimals: 1, unit: "%" },
            { label: "Avg PL", value: squadSummary.avg_load, decimals: 1, unit: "" },
            { label: "Avg RHIE", value: squadSummary.avg_rhie, decimals: 1, unit: "" },
          ].map(({ label, value, decimals, unit }) => (
            <div key={label} className="bg-[var(--bp-surface)] border border-[var(--bp-border)] rounded-lg px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-widest text-[var(--bp-muted)] mb-1">{label}</p>
              <p className="text-lg font-semibold text-[var(--bp-accent)]">
                {decimals === 0 ? Math.round(value) : value.toFixed(decimals)}{unit}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-[var(--bp-surface)] border border-[var(--bp-border)] rounded-lg p-5">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <h2 className="text-sm uppercase tracking-widest text-[var(--bp-muted)]">Player Stats</h2>
          {allPositions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-[var(--bp-muted)] uppercase tracking-wider mr-1">Position:</span>
              <button
                onClick={() => setSelectedPositions([])}
                className={`${btnBase} ${selectedPositions.length === 0 ? btnActive : btnInactive}`}
              >
                All
              </button>
              {allPositions.map((pos) => (
                <button
                  key={pos}
                  onClick={() => togglePosition(pos)}
                  className={`${btnBase} ${selectedPositions.includes(pos) ? btnActive : btnInactive}`}
                >
                  {pos}
                </button>
              ))}
            </div>
          )}
          {filteredSessions.length > 0 && (
            <button
              onClick={exportCSV}
              className="ml-auto px-3 py-1.5 text-xs rounded border border-[var(--bp-border)] text-[var(--bp-muted)] hover:border-[var(--bp-accent)]/50 hover:text-[var(--bp-accent)] transition-colors"
            >
              ↓ Export CSV
            </button>
          )}
        </div>
        {sessionsLoading ? (
          <p className="text-[var(--bp-muted)] text-sm">Loading session data…</p>
        ) : (
          <SessionTable sessions={filteredSessions} />
        )}
      </div>
    </div>
  );
}
