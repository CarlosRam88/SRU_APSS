"use client";

import { useEffect, useMemo, useState } from "react";
import ActivityDropdown from "./ActivityDropdown";
import DayCodeDropdown from "./DayCodeDropdown";
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
  const [selectedDayCode, setSelectedDayCode] = useState("All");
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [sessions, setSessions] = useState<PlayerStat[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);

  const dayCodes = useMemo(() => {
    const codes = activities.map((a) => a.day_code).filter((c): c is string => !!c);
    return Array.from(new Set(codes)).sort();
  }, [activities]);

  const filteredActivities = useMemo(() => {
    if (selectedDayCode === "All") return activities;
    return activities.filter((a) => a.day_code === selectedDayCode);
  }, [activities, selectedDayCode]);

  useEffect(() => {
    if (filteredActivities.length > 0) {
      setSelectedActivityId(filteredActivities[0].id);
      onActivityChange?.(filteredActivities[0].id);
    } else {
      setSelectedActivityId("");
      onActivityChange?.("");
      setSessions([]);
    }
  }, [selectedDayCode, filteredActivities]);

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
        <DayCodeDropdown
          dayCodes={dayCodes}
          selectedDayCode={selectedDayCode}
          onSelectDayCode={setSelectedDayCode}
        />
        <ActivityDropdown
          activities={filteredActivities}
          selectedActivityId={selectedActivityId}
          onSelectActivity={(id) => { setSelectedActivityId(id); onActivityChange?.(id); }}
        />
      </div>

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
