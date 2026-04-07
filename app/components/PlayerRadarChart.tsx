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

type CompareMode = "group" | "self" | "multi";
type AggMode = "sum" | "average";

type MetricKey = keyof Omit<ActivityStat, "activity_id" | "athlete_name" | "position">;

const ALL_METRICS: { key: MetricKey; label: string }[] = [
  { key: "total_distance", label: "Total Distance" },
  { key: "high_speed_distance", label: "HSD" },
  { key: "high_speed_percentage", label: "HSR %" },
  { key: "total_player_load", label: "Player Load" },
  { key: "rhie_bout_count", label: "RHIE Bouts" },
  { key: "percentage_max_velocity", label: "% Max Vel." },
];

const RADAR_COLORS = ["#38bdf8", "#f472b6", "#34d399", "#fb923c", "#a78bfa"];

// percentage_max_velocity uses MAX in sum mode (peak velocity hit across the period)
const MAX_METRICS: MetricKey[] = ["percentage_max_velocity"];
// Ratio metrics always use average regardless of aggregation mode
const ALWAYS_AVERAGE_METRICS: MetricKey[] = ["high_speed_percentage"];

function aggregatePlayer(playerStats: ActivityStat[], metrics: MetricKey[], aggMode: AggMode): Record<string, number> {
  if (playerStats.length === 0) return Object.fromEntries(metrics.map((k) => [k, 0]));
  return Object.fromEntries(
    metrics.map((k) => {
      const vals = playerStats.map((s) => s[k] as number);
      let val: number;
      if (aggMode === "average" || ALWAYS_AVERAGE_METRICS.includes(k)) {
        val = vals.reduce((a, b) => a + b, 0) / vals.length;
      } else if (MAX_METRICS.includes(k)) {
        val = Math.max(...vals);
      } else {
        val = vals.reduce((a, b) => a + b, 0);
      }
      return [k, val];
    })
  );
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return parseFloat((((value - min) / (max - min)) * 100).toFixed(1));
}

export default function PlayerRadarChart({ activities, stats }: Props) {
  const allAthletes = useMemo(
    () => Array.from(new Set(stats.map((s) => s.athlete_name))).sort(),
    [stats]
  );

  const [compareMode, setCompareMode] = useState<CompareMode>("group");
  const [aggMode, setAggMode] = useState<AggMode>("sum");
  const [selectedAthlete, setSelectedAthlete] = useState<string>(allAthletes[0] ?? "");
  const [playerA, setPlayerA] = useState<string>(allAthletes[0] ?? "");
  const [playerB, setPlayerB] = useState<string>(allAthletes[1] ?? "");
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(
    ALL_METRICS.slice(0, 3).map((m) => m.key)
  );

  const activeMetrics = ALL_METRICS.filter((m) => selectedMetrics.includes(m.key));

  useMemo(() => {
    if (!allAthletes.includes(selectedAthlete)) setSelectedAthlete(allAthletes[0] ?? "");
    if (!allAthletes.includes(playerA)) setPlayerA(allAthletes[0] ?? "");
    if (!allAthletes.includes(playerB)) setPlayerB(allAthletes[1] ?? "");
  }, [allAthletes]);

  const sortedActivityIds = useMemo(
    () => [...activities].sort((a, b) => b.start_time - a.start_time).map((a) => a.id),
    [activities]
  );

  const chartData = useMemo(() => {
    if (allAthletes.length === 0 || activeMetrics.length === 0) return [];
    const metricKeys = activeMetrics.map((m) => m.key);

    if (compareMode === "multi") {
      const aggregated = [playerA, playerB].map((athlete) => ({
        athlete,
        values: aggregatePlayer(stats.filter((s) => s.athlete_name === athlete), metricKeys, aggMode),
      }));

      return activeMetrics.map(({ key, label }) => {
        const allVals = aggregated.map((a) => a.values[key]);
        const min = Math.min(...allVals) * 0.8;
        const max = Math.max(...allVals) * 1.2;
        const row: Record<string, string | number> = { metric: label };
        aggregated.forEach(({ athlete, values }) => {
          row[athlete] = normalize(values[key], min, max);
          row[`${athlete}_raw`] = parseFloat((values[key] as number).toFixed(1));
        });
        return row;
      });
    }

    // Single player vs baseline
    const subjectStats = stats.filter((s) => s.athlete_name === selectedAthlete);
    const subject = aggregatePlayer(subjectStats, metricKeys, aggMode);

    let baseline: Record<string, number>;
    let baselineLabel: string;

    if (compareMode === "group") {
      const others = allAthletes.filter((a) => a !== selectedAthlete);
      if (others.length === 0) {
        baseline = subject;
      } else {
        const perAthlete = others.map((a) =>
          aggregatePlayer(stats.filter((s) => s.athlete_name === a), metricKeys, aggMode)
        );
        baseline = Object.fromEntries(
          metricKeys.map((k) => [
            k,
            perAthlete.reduce((s, r) => s + (r[k] as number), 0) / perAthlete.length,
          ])
        );
      }
      baselineLabel = "Group Average";
    } else {
      const last5Ids = sortedActivityIds.slice(0, 5);
      const last5Stats = stats.filter((s) => s.athlete_name === selectedAthlete && last5Ids.includes(s.activity_id));
      baseline = aggregatePlayer(last5Stats.length > 0 ? last5Stats : subjectStats, metricKeys, aggMode);
      baselineLabel = "Self (Last 5)";
    }

    return activeMetrics.map(({ key, label }) => {
      const sVal = subject[key] as number;
      const bVal = baseline[key] as number;
      const min = Math.min(sVal, bVal) * 0.8;
      const max = Math.max(sVal, bVal) * 1.2;
      return {
        metric: label,
        [selectedAthlete]: normalize(sVal, min, max),
        [baselineLabel]: normalize(bVal, min, max),
        [`${selectedAthlete}_raw`]: parseFloat(sVal.toFixed(1)),
        [`${baselineLabel}_raw`]: parseFloat(bVal.toFixed(1)),
      };
    });
  }, [stats, selectedAthlete, playerA, playerB, compareMode, aggMode, allAthletes, sortedActivityIds, activeMetrics]);

  function toggleMetric(key: MetricKey) {
    setSelectedMetrics((prev) => {
      if (prev.includes(key)) {
        return prev.length > 3 ? prev.filter((k) => k !== key) : prev;
      }
      return prev.length < 6 ? [...prev, key] : prev;
    });
  }

  const radarKeys = compareMode === "multi"
    ? [playerA, playerB]
    : [selectedAthlete, compareMode === "group" ? "Group Average" : "Self (Last 5)"];

  const selectClass = "bg-[var(--bp-bg)] border border-[var(--bp-border)] text-[var(--bp-text)] text-sm rounded px-3 py-2 focus:outline-none focus:border-[var(--bp-accent)]";
  const btnBase = "px-3 py-1.5 text-xs rounded border transition-colors";
  const btnActive = "border-[var(--bp-accent)] text-[var(--bp-accent)] bg-[var(--bp-accent)]/10";
  const btnInactive = "border-[var(--bp-border)] text-[var(--bp-muted)] hover:border-[var(--bp-accent)]/50";

  return (
    <div className="bg-[var(--bp-surface)] border border-[var(--bp-border)] rounded-lg p-5">
      <h2 className="text-sm uppercase tracking-widest text-[var(--bp-muted)] mb-4">Load Profile — Radar</h2>

      <div className="flex flex-wrap gap-4 mb-5 items-start">
        {/* Axes */}
        <div>
          <p className="text-xs text-[var(--bp-muted)] uppercase tracking-wider mb-1.5">Axes (3–6)</p>
          <div className="flex flex-wrap gap-1">
            {ALL_METRICS.map(({ key, label }) => {
              const active = selectedMetrics.includes(key);
              const canRemove = active && selectedMetrics.length > 3;
              const canAdd = !active && selectedMetrics.length < 6;
              const disabled = active ? !canRemove : !canAdd;
              return (
                <button
                  key={key}
                  onClick={() => !disabled && toggleMetric(key)}
                  className={`${btnBase} ${disabled ? "opacity-40 cursor-not-allowed border-[var(--bp-border)] text-[var(--bp-muted)]" : active ? btnActive : btnInactive}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Aggregation */}
        <div>
          <p className="text-xs text-[var(--bp-muted)] uppercase tracking-wider mb-1.5">Aggregation</p>
          <div className="flex gap-1">
            <button onClick={() => setAggMode("sum")} className={`${btnBase} ${aggMode === "sum" ? btnActive : btnInactive}`}>Accumulated Load</button>
            <button onClick={() => setAggMode("average")} className={`${btnBase} ${aggMode === "average" ? btnActive : btnInactive}`}>Avg per Session</button>
          </div>
        </div>

        {/* Mode */}
        <div>
          <p className="text-xs text-[var(--bp-muted)] uppercase tracking-wider mb-1.5">Mode</p>
          <div className="flex gap-1">
            <button onClick={() => setCompareMode("group")} className={`${btnBase} ${compareMode === "group" ? btnActive : btnInactive}`}>vs Group Avg</button>
            <button onClick={() => setCompareMode("self")} className={`${btnBase} ${compareMode === "self" ? btnActive : btnInactive}`}>vs Self (Last 5)</button>
            <button onClick={() => setCompareMode("multi")} className={`${btnBase} ${compareMode === "multi" ? btnActive : btnInactive}`}>Head-to-Head</button>
          </div>
        </div>

        {/* Player selector */}
        {compareMode !== "multi" ? (
          <div>
            <p className="text-xs text-[var(--bp-muted)] uppercase tracking-wider mb-1.5">Player</p>
            <select value={selectedAthlete} onChange={(e) => setSelectedAthlete(e.target.value)} className={selectClass}>
              {allAthletes.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        ) : (
          <div className="flex items-end gap-3">
            <div>
              <p className="text-xs text-[var(--bp-muted)] uppercase tracking-wider mb-1.5" style={{ color: RADAR_COLORS[0] }}>Player A</p>
              <select value={playerA} onChange={(e) => setPlayerA(e.target.value)} className={selectClass}>
                {allAthletes.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <span className="text-[var(--bp-muted)] text-sm pb-2">vs</span>
            <div>
              <p className="text-xs text-[var(--bp-muted)] uppercase tracking-wider mb-1.5" style={{ color: RADAR_COLORS[1] }}>Player B</p>
              <select value={playerB} onChange={(e) => setPlayerB(e.target.value)} className={selectClass}>
                {allAthletes.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={360}>
        <RadarChart data={chartData} margin={{ top: 10, right: 50, bottom: 10, left: 50 }}>
          <PolarGrid stroke="var(--bp-border)" />
          <PolarAngleAxis dataKey="metric" tick={{ fill: "var(--bp-text)", fontSize: 12 }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "var(--bp-muted)", fontSize: 10 }} tickCount={4} />
          {radarKeys.map((key, i) => (
            <Radar
              key={key}
              name={key}
              dataKey={key}
              stroke={RADAR_COLORS[i % RADAR_COLORS.length]}
              fill={RADAR_COLORS[i % RADAR_COLORS.length]}
              fillOpacity={i === 0 ? 0.25 : 0.15}
              strokeWidth={2}
              strokeDasharray={i > 0 && compareMode !== "multi" ? "5 3" : undefined}
            />
          ))}
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
