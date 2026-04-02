"use client";

import { useMemo, useState } from "react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip,
} from "recharts";
import { ActivityStat } from "./LongitudinalChart";

type Activity = {
  id: string;
  name: string;
  start_time: number;
  day_code: string | null;
};

type Props = {
  activities: Activity[];
  stats: ActivityStat[];
};

type CompareMode = "group" | "self";

const METRICS: { key: keyof ActivityStat; label: string }[] = [
  { key: "total_distance", label: "Total Distance" },
  { key: "high_speed_distance", label: "High Speed Dist." },
  { key: "high_speed_percentage", label: "HSR %" },
];

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return parseFloat((((value - min) / (max - min)) * 100).toFixed(1));
}

// Aggregate stats per player across a set of activity IDs
function aggregatePlayer(playerStats: ActivityStat[]): Record<string, number> {
  if (playerStats.length === 0) return { total_distance: 0, high_speed_distance: 0, high_speed_percentage: 0 };
  const totDist = playerStats.reduce((s, r) => s + r.total_distance, 0);
  const totHSD = playerStats.reduce((s, r) => s + r.high_speed_distance, 0);
  const avgHSR = playerStats.reduce((s, r) => s + r.high_speed_percentage, 0) / playerStats.length;
  return { total_distance: totDist, high_speed_distance: totHSD, high_speed_percentage: avgHSR };
}

export default function PlayerRadarChart({ activities, stats }: Props) {
  const allAthletes = useMemo(
    () => Array.from(new Set(stats.map((s) => s.athlete_name))).sort(),
    [stats]
  );

  const [selectedAthlete, setSelectedAthlete] = useState<string>(allAthletes[0] ?? "");
  const [compareMode, setCompareMode] = useState<CompareMode>("group");

  // Keep selection valid when stats change
  useMemo(() => {
    if (!allAthletes.includes(selectedAthlete)) setSelectedAthlete(allAthletes[0] ?? "");
  }, [allAthletes, selectedAthlete]);

  // Sort activities by time for "last 5" logic
  const sortedActivityIds = useMemo(
    () => [...activities].sort((a, b) => b.start_time - a.start_time).map((a) => a.id),
    [activities]
  );

  const chartData = useMemo(() => {
    if (!selectedAthlete) return [];

    // Subject: aggregate across ALL fetched activities
    const subjectStats = stats.filter((s) => s.athlete_name === selectedAthlete);
    const subject = aggregatePlayer(subjectStats);

    // Baseline: group average OR self last-5
    let baseline: Record<string, number>;
    let baselineLabel: string;

    if (compareMode === "group") {
      const others = allAthletes.filter((a) => a !== selectedAthlete);
      if (others.length === 0) {
        baseline = subject;
      } else {
        const perAthlete = others.map((a) => aggregatePlayer(stats.filter((s) => s.athlete_name === a)));
        baseline = {
          total_distance: perAthlete.reduce((s, r) => s + r.total_distance, 0) / perAthlete.length,
          high_speed_distance: perAthlete.reduce((s, r) => s + r.high_speed_distance, 0) / perAthlete.length,
          high_speed_percentage: perAthlete.reduce((s, r) => s + r.high_speed_percentage, 0) / perAthlete.length,
        };
      }
      baselineLabel = "Group Average";
    } else {
      // Self last 5 activities within the fetched range
      const last5Ids = sortedActivityIds.slice(0, 5);
      const last5Stats = stats.filter((s) => s.athlete_name === selectedAthlete && last5Ids.includes(s.activity_id));
      baseline = aggregatePlayer(last5Stats.length > 0 ? last5Stats : subjectStats);
      baselineLabel = "Self (Last 5)";
    }

    // Compute min/max across both values for normalization per metric
    return METRICS.map(({ key, label }) => {
      const sVal = subject[key as string] as number;
      const bVal = baseline[key as string] as number;
      const min = Math.min(sVal, bVal) * 0.8;
      const max = Math.max(sVal, bVal) * 1.2;
      return {
        metric: label,
        [selectedAthlete]: normalize(sVal, min, max),
        [baselineLabel]: normalize(bVal, min, max),
        // keep raw for tooltip
        [`${selectedAthlete}_raw`]: parseFloat(sVal.toFixed(1)),
        [`${baselineLabel}_raw`]: parseFloat(bVal.toFixed(1)),
      };
    });
  }, [stats, selectedAthlete, compareMode, allAthletes, sortedActivityIds]);

  const baselineLabel = compareMode === "group" ? "Group Average" : "Self (Last 5)";

  const btnBase = "px-3 py-1.5 text-xs rounded border transition-colors";
  const btnActive = "border-[var(--bp-accent)] text-[var(--bp-accent)] bg-[var(--bp-accent)]/10";
  const btnInactive = "border-[var(--bp-border)] text-[var(--bp-muted)] hover:border-[var(--bp-accent)]/50";

  return (
    <div className="bg-[var(--bp-surface)] border border-[var(--bp-border)] rounded-lg p-5">
      <h2 className="text-sm uppercase tracking-widest text-[var(--bp-muted)] mb-4">Load Profile — Radar</h2>

      <div className="flex flex-wrap gap-4 mb-6 items-start">
        <div>
          <p className="text-xs text-[var(--bp-muted)] uppercase tracking-wider mb-1.5">Player</p>
          <select
            value={selectedAthlete}
            onChange={(e) => setSelectedAthlete(e.target.value)}
            className="bg-[var(--bp-bg)] border border-[var(--bp-border)] text-[var(--bp-text)] text-sm rounded px-3 py-2 focus:outline-none focus:border-[var(--bp-accent)]"
          >
            {allAthletes.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs text-[var(--bp-muted)] uppercase tracking-wider mb-1.5">Compare vs</p>
          <div className="flex gap-1">
            <button onClick={() => setCompareMode("group")} className={`${btnBase} ${compareMode === "group" ? btnActive : btnInactive}`}>Group Average</button>
            <button onClick={() => setCompareMode("self")} className={`${btnBase} ${compareMode === "self" ? btnActive : btnInactive}`}>Self (Last 5)</button>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <RadarChart data={chartData} margin={{ top: 10, right: 40, bottom: 10, left: 40 }}>
          <PolarGrid stroke="var(--bp-border)" />
          <PolarAngleAxis dataKey="metric" tick={{ fill: "var(--bp-text)", fontSize: 12 }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "var(--bp-muted)", fontSize: 10 }} tickCount={4} />
          <Radar
            name={selectedAthlete}
            dataKey={selectedAthlete}
            stroke="#38bdf8"
            fill="#38bdf8"
            fillOpacity={0.25}
            strokeWidth={2}
          />
          <Radar
            name={baselineLabel}
            dataKey={baselineLabel}
            stroke="#f472b6"
            fill="#f472b6"
            fillOpacity={0.15}
            strokeWidth={2}
            strokeDasharray="5 3"
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "var(--bp-muted)" }} />
          <Tooltip
            contentStyle={{ background: "var(--bp-surface)", border: "1px solid var(--bp-border)", borderRadius: 6 }}
            labelStyle={{ color: "var(--bp-text)", marginBottom: 4 }}
            formatter={(value, name, props) => {
              const raw = props.payload[`${name}_raw`];
              return [raw !== undefined ? raw : value, name];
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
      <p className="text-xs text-[var(--bp-muted)] mt-2 text-center">Values normalized per metric for shape comparison. Hover for raw values.</p>
    </div>
  );
}
