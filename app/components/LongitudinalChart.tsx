"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";

export type ActivityStat = {
  activity_id: string;
  athlete_name: string;
  position: string | null;
  total_distance: number;
  high_speed_distance: number;
  high_speed_percentage: number;
  total_player_load: number;
  rhie_bout_count: number;
  percentage_max_velocity: number;
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

type Metric = keyof Omit<ActivityStat, "activity_id" | "athlete_name" | "position">;
type TimeMode = "daily" | "weekly";
type Aggregation = "sum" | "average" | "rolling7" | "group_avg" | "position";
type RefLineKey = "mean" | "median" | "sd_upper" | "sd_lower" | "q1" | "q3" | "p10" | "p90" | "max" | "min";

const REF_LINE_LABELS: Record<RefLineKey, string> = {
  mean:     "Mean",
  median:   "Median",
  sd_upper: "+1 SD",
  sd_lower: "−1 SD",
  q3:       "Upper Quartile",
  q1:       "Lower Quartile",
  p90:      "90th Percentile",
  p10:      "10th Percentile",
  max:      "Max",
  min:      "Min",
};

const REF_LINE_COLORS: Record<RefLineKey, string> = {
  mean:     "#facc15",
  median:   "#34d399",
  sd_upper: "#fb923c",
  sd_lower: "#fb923c",
  q3:       "#a78bfa",
  q1:       "#a78bfa",
  p90:      "#f472b6",
  p10:      "#f472b6",
  max:      "#f87171",
  min:      "#2dd4bf",
};

function computeRefLines(values: number[]): Record<RefLineKey, number> {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const sd = Math.sqrt(variance);
  const percentile = (p: number) => {
    const idx = (p / 100) * (n - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  return {
    mean:     parseFloat(mean.toFixed(1)),
    median:   parseFloat(percentile(50).toFixed(1)),
    sd_upper: parseFloat((mean + sd).toFixed(1)),
    sd_lower: parseFloat((mean - sd).toFixed(1)),
    q3:       parseFloat(percentile(75).toFixed(1)),
    q1:       parseFloat(percentile(25).toFixed(1)),
    p90:      parseFloat(percentile(90).toFixed(1)),
    p10:      parseFloat(percentile(10).toFixed(1)),
    max:      sorted[n - 1],
    min:      sorted[0],
  };
}

const METRIC_LABELS: Record<Metric, string> = {
  total_distance: "Total Distance (m)",
  high_speed_distance: "HSD (m)",
  high_speed_percentage: "HSR %",
  total_player_load: "Player Load",
  rhie_bout_count: "RHIE Bouts",
  percentage_max_velocity: "% Max Velocity",
};

// Metrics where averaging makes more sense than summing
const RATIO_METRICS: Metric[] = ["high_speed_percentage", "percentage_max_velocity"];

const AGGREGATION_LABELS: Record<Aggregation, string> = {
  sum: "Sum",
  average: "Average",
  rolling7: "Rolling 7-day",
  group_avg: "Group Average",
  position: "By Position",
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

function aggregateValues(vals: number[], metric: Metric, method: "sum" | "average"): number {
  if (vals.length === 0) return 0;
  if (method === "average" || RATIO_METRICS.includes(metric)) {
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  return vals.reduce((a, b) => a + b, 0);
}

export default function LongitudinalChart({ activities, stats }: Props) {
  const allAthletes = useMemo(
    () => Array.from(new Set(stats.map((s) => s.athlete_name))).sort(),
    [stats]
  );

  const allPositions = useMemo(
    () => Array.from(new Set(stats.map((s) => s.position).filter(Boolean) as string[])).sort(),
    [stats]
  );


  // Group athletes by their most common position across loaded stats
  const athletesByPosition = useMemo(() => {
    const posMap = new Map<string, string>();
    stats.forEach((s) => {
      if (s.position && !posMap.has(s.athlete_name)) posMap.set(s.athlete_name, s.position);
    });
    const groups = new Map<string, string[]>();
    allAthletes.forEach((name) => {
      const pos = posMap.get(name) ?? "Unknown";
      if (!groups.has(pos)) groups.set(pos, []);
      groups.get(pos)!.push(name);
    });
    return groups;
  }, [allAthletes, stats]);

  const [metric, setMetric] = useState<Metric>("total_distance");
  const [timeMode, setTimeMode] = useState<TimeMode>("daily");
  const [aggregation, setAggregation] = useState<Aggregation>("sum");
  const [selectedAthletes, setSelectedAthletes] = useState<string[]>([]);
  const [activeRefLines, setActiveRefLines] = useState<RefLineKey[]>([]);
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(new Set());

  // Keep selection in sync when stats change (drop any athletes no longer in the data)
  useEffect(() => {
    setSelectedAthletes((prev) => prev.filter((a) => allAthletes.includes(a)));
  }, [allAthletes]);

  // Rolling 7-day only makes sense in daily mode
  const effectiveAggregation: Aggregation =
    timeMode === "weekly" && aggregation === "rolling7" ? "sum" : aggregation;

  const activityById = useMemo(() => {
    const map = new Map<string, Activity>();
    activities.forEach((a) => map.set(a.id, a));
    return map;
  }, [activities]);

  const chartData = useMemo(() => {
    const isIndividual = effectiveAggregation === "sum" || effectiveAggregation === "average";
    const relevantStats = isIndividual
      ? stats.filter((s) => selectedAthletes.includes(s.athlete_name))
      : stats;

    if (timeMode === "daily") {
      // Collect all data points with timestamps
      type DayEntry = { date: string; timestamp: number; byKey: Map<string, number[]> };
      const byDate = new Map<string, DayEntry>();

      relevantStats.forEach((s) => {
        const act = activityById.get(s.activity_id);
        if (!act) return;
        const date = new Date(act.start_time * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
        if (!byDate.has(date)) byDate.set(date, { date, timestamp: act.start_time, byKey: new Map() });
        const entry = byDate.get(date)!;

        const key =
          effectiveAggregation === "position" ? (s.position ?? "Unknown") :
          effectiveAggregation === "group_avg" ? "Group Average" :
          s.athlete_name;

        if (!entry.byKey.has(key)) entry.byKey.set(key, []);
        entry.byKey.get(key)!.push(s[metric]);
      });

      const rows = Array.from(byDate.values()).sort((a, b) => a.timestamp - b.timestamp);
      const baseMethod = effectiveAggregation === "average" ? "average" : "sum";

      if (effectiveAggregation === "rolling7") {
        // Build per-athlete daily values first, then apply rolling window
        const athleteDays = new Map<string, { date: string; timestamp: number; value: number }[]>();
        rows.forEach(({ date, timestamp, byKey }) => {
          byKey.forEach((vals, athlete) => {
            if (!athleteDays.has(athlete)) athleteDays.set(athlete, []);
            athleteDays.get(athlete)!.push({ date, timestamp, value: aggregateValues(vals, metric, "sum") });
          });
        });

        // For each date, compute rolling 7-day sum per athlete
        return rows.map(({ date, timestamp }) => {
          const row: Record<string, string | number> = { date };
          const cutoff = timestamp - 7 * 86400;
          selectedAthletes.forEach((athlete) => {
            const days = athleteDays.get(athlete) ?? [];
            const window = days.filter((d) => d.timestamp >= cutoff && d.timestamp <= timestamp);
            row[athlete] = parseFloat(aggregateValues(window.map((d) => d.value), metric, RATIO_METRICS.includes(metric) ? "average" : "sum").toFixed(1));
          });
          return row;
        });
      }

      if (effectiveAggregation === "group_avg") {
        return rows.map(({ date, byKey }) => {
          const perAthlete = Array.from(byKey.values()).map((v) => aggregateValues(v, metric, baseMethod));
          const avg = perAthlete.length > 0 ? perAthlete.reduce((a, b) => a + b, 0) / perAthlete.length : 0;
          return { date, "Group Average": parseFloat(avg.toFixed(1)) };
        });
      }

      return rows.map(({ date, byKey }) => {
        const row: Record<string, string | number> = { date };
        byKey.forEach((vals, key) => {
          row[key] = parseFloat(aggregateValues(vals, metric, baseMethod).toFixed(1));
        });
        return row;
      });

    } else {
      // Weekly
      type WeekEntry = { week: string; byKey: Map<string, number[]> };
      const byWeek = new Map<string, WeekEntry>();

      relevantStats.forEach((s) => {
        const act = activityById.get(s.activity_id);
        if (!act) return;
        const week = getISOWeek(new Date(act.start_time * 1000));
        if (!byWeek.has(week)) byWeek.set(week, { week, byKey: new Map() });
        const entry = byWeek.get(week)!;

        const key =
          effectiveAggregation === "position" ? (s.position ?? "Unknown") :
          effectiveAggregation === "group_avg" ? "Group Average" :
          s.athlete_name;

        if (!entry.byKey.has(key)) entry.byKey.set(key, []);
        entry.byKey.get(key)!.push(s[metric]);
      });

      const rows = Array.from(byWeek.values()).sort((a, b) => a.week.localeCompare(b.week));
      const baseMethod = effectiveAggregation === "average" ? "average" : "sum";

      if (effectiveAggregation === "group_avg") {
        return rows.map(({ week, byKey }) => {
          const perAthlete = Array.from(byKey.values()).map((v) => aggregateValues(v, metric, baseMethod));
          const avg = perAthlete.length > 0 ? perAthlete.reduce((a, b) => a + b, 0) / perAthlete.length : 0;
          return { date: week, "Group Average": parseFloat(avg.toFixed(1)) };
        });
      }

      return rows.map(({ week, byKey }) => {
        const row: Record<string, string | number> = { date: week };
        byKey.forEach((vals, key) => {
          row[key] = parseFloat(aggregateValues(vals, metric, baseMethod).toFixed(1));
        });
        return row;
      });
    }
  }, [stats, activities, metric, timeMode, effectiveAggregation, selectedAthletes, activityById]);

  // IMPORTANT: lineKeys must be derived from ALL rows, not just chartData[0].
  // Players who weren't active on the earliest date won't appear in the first row,
  // so reading keys from chartData[0] only would silently drop their <Line> entirely.
  // This caused a bug where selecting certain player combinations rendered only one line.
  const lineKeys = useMemo(() => {
    const keys = new Set<string>();
    chartData.forEach((row) => Object.keys(row).forEach((k) => { if (k !== "date") keys.add(k); }));
    return Array.from(keys);
  }, [chartData]);

  // Compute reference line values from all numeric values in the current chart
  const refLineValues = useMemo(() => {
    const allVals = chartData.flatMap((row) =>
      lineKeys.map((k) => (row as Record<string, unknown>)[k]).filter((v): v is number => typeof v === "number" && v > 0)
    );
    if (allVals.length < 2) return null;
    return computeRefLines(allVals);
  }, [chartData, lineKeys]);

  function toggleAthlete(name: string) {
    setSelectedAthletes((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
  }

  const showPlayerSelector = effectiveAggregation === "sum" || effectiveAggregation === "average" || effectiveAggregation === "rolling7";

  const btnBase = "px-3 py-1.5 text-xs rounded border transition-colors";
  const btnActive = "border-[var(--bp-accent)] text-[var(--bp-accent)] bg-[var(--bp-accent)]/10";
  const btnInactive = "border-[var(--bp-border)] text-[var(--bp-muted)] hover:border-[var(--bp-accent)]/50";
  const btnDisabled = "border-[var(--bp-border)] text-[var(--bp-border)] cursor-not-allowed opacity-40";

  return (
    <div className="bg-[var(--bp-surface)] border border-[var(--bp-border)] rounded-lg p-5">
      <h2 className="text-sm uppercase tracking-widest text-[var(--bp-muted)] mb-4">Longitudinal Load</h2>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-5 items-start">
        {/* Metric */}
        <div>
          <p className="text-xs text-[var(--bp-muted)] uppercase tracking-wider mb-1.5">Metric</p>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(METRIC_LABELS) as Metric[]).map((m) => (
              <button key={m} onClick={() => setMetric(m)} className={`${btnBase} ${metric === m ? btnActive : btnInactive}`}>
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        {/* Time */}
        <div>
          <p className="text-xs text-[var(--bp-muted)] uppercase tracking-wider mb-1.5">Time</p>
          <div className="flex gap-1">
            {(["daily", "weekly"] as TimeMode[]).map((t) => (
              <button key={t} onClick={() => setTimeMode(t)} className={`${btnBase} capitalize ${timeMode === t ? btnActive : btnInactive}`}>{t}</button>
            ))}
          </div>
        </div>

        {/* Aggregation */}
        <div>
          <p className="text-xs text-[var(--bp-muted)] uppercase tracking-wider mb-1.5">Aggregation</p>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(AGGREGATION_LABELS) as Aggregation[]).map((a) => {
              const disabled = a === "rolling7" && timeMode === "weekly";
              return (
                <button
                  key={a}
                  onClick={() => !disabled && setAggregation(a)}
                  className={`${btnBase} ${disabled ? btnDisabled : aggregation === a ? btnActive : btnInactive}`}
                  title={disabled ? "Not available in weekly view" : undefined}
                >
                  {AGGREGATION_LABELS[a]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Player selector grouped by position */}
      {showPlayerSelector && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 mb-5">
          {Array.from(athletesByPosition.entries()).map(([position, names]) => {
            const expanded = expandedPositions.has(position);
            const activeCount = names.filter((n) => selectedAthletes.includes(n)).length;
            return (
              <div key={position}>
                <button
                  onClick={() => setExpandedPositions((prev: Set<string>) => {
                    const next = new Set(prev);
                    next.has(position) ? next.delete(position) : next.add(position);
                    return next;
                  })}
                  className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[var(--bp-muted)] hover:text-[var(--bp-accent)] transition-colors mb-1.5"
                >
                  <span>{expanded ? "▼" : "▶"}</span>
                  {position}
                  <span className="text-[var(--bp-border)]">({activeCount}/{names.length})</span>
                </button>
                {expanded && (
                  <div className="flex flex-wrap gap-1.5">
                    {names.map((name) => {
                      const active = selectedAthletes.includes(name);
                      return (
                        <button
                          key={name}
                          onClick={() => toggleAthlete(name)}
                          className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                            active ? "border-[var(--bp-accent)] bg-[var(--bp-accent)]/20 text-[var(--bp-accent)]" : "border-[var(--bp-border)] text-[var(--bp-muted)]"
                          }`}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reference lines */}
      {refLineValues && (
        <div className="mb-5">
          <p className="text-xs text-[var(--bp-muted)] uppercase tracking-wider mb-1.5">Reference Lines</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(REF_LINE_LABELS) as RefLineKey[]).map((key) => {
              const active = activeRefLines.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => setActiveRefLines((prev) =>
                    prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                  )}
                  className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                    active ? "border-transparent text-[var(--bp-bg)]" : "border-[var(--bp-border)] text-[var(--bp-muted)] hover:border-[var(--bp-accent)]/50"
                  }`}
                  style={active ? { backgroundColor: REF_LINE_COLORS[key] } : {}}
                >
                  {REF_LINE_LABELS[key]} ({refLineValues[key]})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Position info */}
      {effectiveAggregation === "position" && allPositions.length === 0 && (
        <p className="text-xs text-[var(--bp-muted)] mb-4">No position data available for these activities.</p>
      )}

      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={chartData} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--bp-border)" />
          <XAxis dataKey="date" tick={{ fill: "var(--bp-muted)", fontSize: 11 }} />
          <YAxis tick={{ fill: "var(--bp-muted)", fontSize: 11 }} width={65} />
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
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
          {refLineValues && activeRefLines.map((key) => (
            <ReferenceLine
              key={key}
              y={refLineValues[key]}
              stroke={REF_LINE_COLORS[key]}
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{ value: `${REF_LINE_LABELS[key]}: ${refLineValues[key]}`, fill: REF_LINE_COLORS[key], fontSize: 10, position: "insideTopRight" }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
