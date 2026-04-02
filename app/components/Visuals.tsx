"use client";

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

export default function Visuals({ activities, stats, hasFetched, loading }: Props) {
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

  return (
    <div className="flex flex-col gap-6">
      <LongitudinalChart activities={activities} stats={stats} />
      <PlayerRadarChart activities={activities} stats={stats} />
    </div>
  );
}
