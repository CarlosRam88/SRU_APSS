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
    fetch(`/api/sessions?activityId=${selectedActivityId}`)
      .then((r) => r.json())
      .then((data) => {
        setSessions(data);
        setSessionsLoading(false);
      });
  }, [selectedActivityId]);

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
        <h2 className="text-sm uppercase tracking-widest text-[var(--bp-muted)] mb-4">Player Stats</h2>
        {sessionsLoading ? (
          <p className="text-[var(--bp-muted)] text-sm">Loading session data…</p>
        ) : (
          <SessionTable sessions={sessions} />
        )}
      </div>
    </div>
  );
}
