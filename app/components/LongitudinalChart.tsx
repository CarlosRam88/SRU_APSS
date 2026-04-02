"use client";

import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";

export type ActivityStat = {
  activity_id: string;
  athlete_name: string;
  total_distance: number;
  high_speed_distance: number;
  high_speed_percentage: number;
};

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

type Metric = "total_distance" | "high_speed_distance" | "high_speed_percentage";
type GroupMode = "individual" | "group";
type TimeMode = "daily" | "weekly";

const METRIC_LABELS: Record<Metric, string> = {
  total_distance: "Total Distance (m)",
  high_speed_distance: "High Speed Distance (m)",
  high_speed_percentage: "HSR %",
};

const LINE_COLORS = [
  "#38bdf8", "#f472b6", "#34d399", "#fb923c",
  "#a78bfa", "#facc15", "#f87171", "#2dd4bf",
];

function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export default function LongitudinalChart({ activities, stats }: Props) {
  const allAthletes = useMemo(
    () => Array.from(new Set(stats.map((s) => s.athlete_name))).sort(),
    [stats]
  );

  const [metric, setMetric] = useState<Metric>("total_distance");
  const [timeMode, setTimeMode] = useState<TimeMode>("daily");
  const [groupMode, setGroupMode] = useState<GroupMode>("individual");
  const [selectedAthletes, setSelectedAthletes] = useState<string[]>(allAthletes.slice(0, 5));

  // Keep selection in sync when stats change
  useMemo(() => {
    setSelectedAthletes((prev) => {
      const valid = prev.filter((a) => allAthletes.includes(a));
      return valid.length > 0 ? valid : allAthletes.slice(0, 5);
    });
  }, [allAthletes]);

  const activityById = useMemo(() => {
    const map = new Map<string, Activity>();
    activities.forEach((a) => map.set(a.id, a));
    return map;
  }, [activities]);

  // Build chart data
  const chartData = useMemo(() => {
    const relevantStats = stats.filter((s) => selectedAthletes.includes(s.athlete_name));

    if (timeMode === "daily") {
      // Group by activity date
      const byDate = new Map<string, { date: string; timestamp: number; byAthlete: Map<string, number> }>();

      relevantStats.forEach((s) => {
        const act = activityById.get(s.activity_id);
        if (!act) return;
        const date = new Date(act.start_time * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
        if (!byDate.has(date)) {
          byDate.set(date, { date, timestamp: act.start_time, byAthlete: new Map() });
        }
        const entry = byDate.get(date)!;
        // If multiple sessions on same date, sum distances / average HSR%
        const prev = entry.byAthlete.get(s.athlete_name) ?? 0;
        entry.byAthlete.set(
          s.athlete_name,
          metric === "high_speed_percentage" ? (prev + s[metric]) / (prev === 0 ? 1 : 2) : prev + s[metric]
        );
      });

      const rows = Array.from(byDate.values()).sort((a, b) => a.timestamp - b.timestamp);

      if (groupMode === "group") {
        return rows.map(({ date, byAthlete }) => {
          const vals = Array.from(byAthlete.values());
          const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
          return { date, "Group Average": parseFloat(avg.toFixed(1)) };
        });
      }

      return rows.map(({ date, byAthlete }) => {
        const row: Record<string, string | number> = { date };
        selectedAthletes.forEach((athlete) => {
          row[athlete] = parseFloat((byAthlete.get(athlete) ?? 0).toFixed(1));
        });
        return row;
      });

    } else {
      // Weekly: sum per athlete per week, then average across athletes
      const byWeek = new Map<string, { week: string; byAthlete: Map<string, number[]> }>();

      relevantStats.forEach((s) => {
        const act = activityById.get(s.activity_id);
        if (!act) return;
        const week = getISOWeek(new Date(act.start_time * 1000));
        if (!byWeek.has(week)) {
          byWeek.set(week, { week, byAthlete: new Map() });
        }
        const entry = byWeek.get(week)!;
        if (!entry.byAthlete.has(s.athlete_name)) entry.byAthlete.set(s.athlete_name, []);
        entry.byAthlete.get(s.athlete_name)!.push(s[metric]);
      });

      const rows = Array.from(byWeek.values()).sort((a, b) => a.week.localeCompare(b.week));

      if (groupMode === "group") {
        return rows.map(({ week, byAthlete }) => {
          const athleteTotals = Array.from(byAthlete.entries()).map(([, vals]) => {
            // Sum for distances, average for HSR%
            return metric === "high_speed_percentage"
              ? vals.reduce((a, b) => a + b, 0) / vals.length
              : vals.reduce((a, b) => a + b, 0);
          });
          const avg = athleteTotals.length > 0
            ? athleteTotals.reduce((a, b) => a + b, 0) / athleteTotals.length
            : 0;
          return { date: week, "Group Average": parseFloat(avg.toFixed(1)) };
        });
      }

      return rows.map(({ week, byAthlete }) => {
        const row: Record<string, string | number> = { date: week };
        selectedAthletes.forEach((athlete) => {
          const vals = byAthlete.get(athlete) ?? [];
          const val = vals.length === 0 ? 0
            : metric === "high_speed_percentage"
            ? vals.reduce((a, b) => a + b, 0) / vals.length
            : vals.reduce((a, b) => a + b, 0);
          row[athlete] = parseFloat(val.toFixed(1));
        });
        return row;
      });
    }
  }, [stats, activities, metric, timeMode, groupMode, selectedAthletes, activityById]);

  const lineKeys = groupMode === "group" ? ["Group Average"] : selectedAthletes;

  function toggleAthlete(name: string) {
    setSelectedAthletes((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
  }

  const btnBase = "px-3 py-1.5 text-xs rounded border transition-colors";
  const btnActive = "border-[var(--bp-accent)] text-[var(--bp-accent)] bg-[var(--bp-accent)]/10";
  const btnInactive = "border-[var(--bp-border)] text-[var(--bp-muted)] hover:border-[var(--bp-accent)]/50";

  return (
    <div className="bg-[var(--bp-surface)] border border-[var(--bp-border)] rounded-lg p-5">
      <h2 className="text-sm uppercase tracking-widest text-[var(--bp-muted)] mb-4">Longitudinal Load</h2>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-6 items-start">
        <div>
          <p className="text-xs text-[var(--bp-muted)] uppercase tracking-wider mb-1.5">Metric</p>
          <div className="flex gap-1">
            {(Object.keys(METRIC_LABELS) as Metric[]).map((m) => (
              <button key={m} onClick={() => setMetric(m)} className={`${btnBase} ${metric === m ? btnActive : btnInactive}`}>
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-[var(--bp-muted)] uppercase tracking-wider mb-1.5">View</p>
          <div className="flex gap-1">
            {(["daily", "weekly"] as TimeMode[]).map((t) => (
              <button key={t} onClick={() => setTimeMode(t)} className={`${btnBase} capitalize ${timeMode === t ? btnActive : btnInactive}`}>{t}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-[var(--bp-muted)] uppercase tracking-wider mb-1.5">Mode</p>
          <div className="flex gap-1">
            {(["individual", "group"] as GroupMode[]).map((g) => (
              <button key={g} onClick={() => setGroupMode(g)} className={`${btnBase} capitalize ${groupMode === g ? btnActive : btnInactive}`}>{g}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Player selector (individual mode only) */}
      {groupMode === "individual" && (
        <div className="flex flex-wrap gap-2 mb-5">
          {allAthletes.map((name, i) => (
            <button
              key={name}
              onClick={() => toggleAthlete(name)}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                selectedAthletes.includes(name)
                  ? "border-transparent text-[var(--bp-bg)]"
                  : "border-[var(--bp-border)] text-[var(--bp-muted)]"
              }`}
              style={selectedAthletes.includes(name) ? { backgroundColor: LINE_COLORS[i % LINE_COLORS.length] } : {}}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={chartData} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--bp-border)" />
          <XAxis dataKey="date" tick={{ fill: "var(--bp-muted)", fontSize: 11 }} />
          <YAxis tick={{ fill: "var(--bp-muted)", fontSize: 11 }} width={60} />
          <Tooltip
            contentStyle={{ background: "var(--bp-surface)", border: "1px solid var(--bp-border)", borderRadius: 6 }}
            labelStyle={{ color: "var(--bp-text)", marginBottom: 4 }}
            itemStyle={{ color: "var(--bp-text)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "var(--bp-muted)" }} />
          {lineKeys.map((key, i) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={groupMode === "group" ? "var(--bp-accent)" : LINE_COLORS[allAthletes.indexOf(key) % LINE_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
