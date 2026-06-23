"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MetricKey, orderMetrics, formatTable, buildMedalMap,
} from "./metrics";

type Player = {
  athlete_name: string;
  total_distance: number;
  running_distance?: number;
  high_speed_distance?: number;
  high_speed_percentage?: number;
  total_player_load?: number;
  rhie_bout_count?: number;
  contactinvolvement_total_count?: number;
  percentage_max_velocity?: number;
  max_vel?: number;
  position?: string | null;
};

type SessionTableProps = {
  sessions: Player[];
  visibleMetrics: MetricKey[];
};

type SortColumn = "athlete_name" | MetricKey;

const MEDALS = ["🥇", "🥈", "🥉"];

export default function SessionTable({ sessions, visibleMetrics }: SessionTableProps) {
  const columns = useMemo(() => orderMetrics(visibleMetrics), [visibleMetrics]);

  const [sortColumn, setSortColumn] = useState<SortColumn>("total_distance");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // If the active sort column is a metric that's no longer visible, fall back to
  // the first visible metric (or the player name).
  useEffect(() => {
    if (sortColumn !== "athlete_name" && !visibleMetrics.includes(sortColumn)) {
      setSortColumn(visibleMetrics[0] ?? "athlete_name");
      setSortDirection("desc");
    }
  }, [visibleMetrics, sortColumn]);

  // Medal ranking per visible numeric column (0=gold, 1=silver, 2=bronze).
  const medalMap = useMemo(
    () => buildMedalMap(sessions, visibleMetrics),
    [sessions, visibleMetrics]
  );

  function getMedal(col: MetricKey, value: number | undefined): string {
    if (value === undefined || value === 0) return "";
    const rank = medalMap[col]?.get(value);
    return rank !== undefined ? MEDALS[rank] : "";
  }

  const sortedSessions = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => {
      if (sortColumn === "athlete_name") {
        return (a.athlete_name ?? "").localeCompare(b.athlete_name ?? "");
      }
      return ((a[sortColumn] as number) ?? 0) - ((b[sortColumn] as number) ?? 0);
    });
    return sortDirection === "asc" ? sorted : sorted.reverse();
  }, [sessions, sortColumn, sortDirection]);

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection(column === "athlete_name" ? "asc" : "desc");
    }
  }

  function arrow(column: SortColumn) {
    if (sortColumn !== column) return <span className="text-[var(--bp-border)] ml-1">↕</span>;
    return <span className="text-[var(--bp-accent)] ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>;
  }

  if (sessions.length === 0) {
    return <p className="text-[var(--bp-muted)] text-sm">No player data available.</p>;
  }

  const thClass = "px-4 py-3 text-left text-xs uppercase tracking-wider text-[var(--bp-muted)] cursor-pointer select-none hover:text-[var(--bp-accent)] transition-colors border-b border-[var(--bp-border)]";
  const tdClass = "px-4 py-3 text-sm border-b border-[var(--bp-border)]";

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[var(--bp-bg)]">
            <th className={thClass} onClick={() => handleSort("athlete_name")}>
              Player{arrow("athlete_name")}
            </th>
            {columns.map((col) => (
              <th key={col.key} className={thClass} onClick={() => handleSort(col.key)}>
                {col.tableLabel}{arrow(col.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedSessions.map((player, index) => (
            <tr key={index} className="hover:bg-[var(--bp-border)]/20 transition-colors">
              <td className={`${tdClass} text-[var(--bp-text)] font-medium`}>
                {player.athlete_name}
                {player.position && (
                  <span className="ml-2 text-[10px] text-[var(--bp-muted)] uppercase tracking-wider">
                    {player.position}
                  </span>
                )}
              </td>
              {columns.map((col) => {
                const value = player[col.key] as number | undefined;
                return (
                  <td
                    key={col.key}
                    className={`${tdClass} ${col.accent ? "text-[var(--bp-accent)]" : "text-[var(--bp-text)]"}`}
                  >
                    {value !== undefined ? (
                      <>
                        {formatTable(col, value)}
                        <span className="ml-1">{getMedal(col.key, value)}</span>
                      </>
                    ) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
