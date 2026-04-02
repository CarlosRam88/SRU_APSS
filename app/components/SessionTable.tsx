"use client";

import { useMemo, useState } from "react";

type Player = {
  athlete_name: string;
  total_distance: number;
  high_speed_distance?: number;
  high_speed_percentage?: number;
  total_player_load?: number;
  rhie_bout_count?: number;
  percentage_max_velocity?: number;
  position?: string | null;
};

type SessionTableProps = {
  sessions: Player[];
};

type SortColumn =
  | "athlete_name"
  | "total_distance"
  | "high_speed_distance"
  | "high_speed_percentage"
  | "total_player_load"
  | "rhie_bout_count"
  | "percentage_max_velocity";

const NUMERIC_COLS: SortColumn[] = [
  "total_distance",
  "high_speed_distance",
  "high_speed_percentage",
  "total_player_load",
  "rhie_bout_count",
  "percentage_max_velocity",
];

const MEDALS = ["🥇", "🥈", "🥉"];

export default function SessionTable({ sessions }: SessionTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("total_distance");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // For each numeric column, map value -> medal index (0=gold, 1=silver, 2=bronze)
  const medalMap = useMemo(() => {
    const result: Record<string, Map<number, number>> = {};
    NUMERIC_COLS.forEach((col) => {
      const vals = sessions
        .map((p) => p[col] as number | undefined)
        .filter((v): v is number => v !== undefined && v > 0)
        .sort((a, b) => b - a);
      const top3 = [...new Set(vals)].slice(0, 3);
      const map = new Map<number, number>();
      top3.forEach((v, i) => map.set(v, i));
      result[col] = map;
    });
    return result;
  }, [sessions]);

  function getMedal(col: SortColumn, value: number | undefined): string {
    if (value === undefined || value === 0) return "";
    const rank = medalMap[col]?.get(value);
    return rank !== undefined ? MEDALS[rank] : "";
  }

  const sortedSessions = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => {
      if (sortColumn === "athlete_name") {
        return (a.athlete_name ?? "").localeCompare(b.athlete_name ?? "");
      }
      return (a[sortColumn] ?? 0) - (b[sortColumn] ?? 0);
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
            <th className={thClass} onClick={() => handleSort("total_distance")}>
              Total Distance (m){arrow("total_distance")}
            </th>
            <th className={thClass} onClick={() => handleSort("high_speed_distance")}>
              HSD (m){arrow("high_speed_distance")}
            </th>
            <th className={thClass} onClick={() => handleSort("high_speed_percentage")}>
              HSR %{arrow("high_speed_percentage")}
            </th>
            <th className={thClass} onClick={() => handleSort("total_player_load")}>
              Player Load{arrow("total_player_load")}
            </th>
            <th className={thClass} onClick={() => handleSort("rhie_bout_count")}>
              RHIE Bouts{arrow("rhie_bout_count")}
            </th>
            <th className={thClass} onClick={() => handleSort("percentage_max_velocity")}>
              % Max Vel.{arrow("percentage_max_velocity")}
            </th>
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
              <td className={`${tdClass} text-[var(--bp-accent)]`}>
                {Math.round(player.total_distance)}
                <span className="ml-1">{getMedal("total_distance", player.total_distance)}</span>
              </td>
              <td className={`${tdClass} text-[var(--bp-text)]`}>
                {player.high_speed_distance !== undefined ? (
                  <>{Math.round(player.high_speed_distance)}<span className="ml-1">{getMedal("high_speed_distance", player.high_speed_distance)}</span></>
                ) : "—"}
              </td>
              <td className={`${tdClass} text-[var(--bp-text)]`}>
                {player.high_speed_percentage !== undefined ? (
                  <>{player.high_speed_percentage.toFixed(1)}%<span className="ml-1">{getMedal("high_speed_percentage", player.high_speed_percentage)}</span></>
                ) : "—"}
              </td>
              <td className={`${tdClass} text-[var(--bp-text)]`}>
                {player.total_player_load !== undefined ? (
                  <>{Math.round(player.total_player_load)}<span className="ml-1">{getMedal("total_player_load", player.total_player_load)}</span></>
                ) : "—"}
              </td>
              <td className={`${tdClass} text-[var(--bp-text)]`}>
                {player.rhie_bout_count !== undefined ? (
                  <>{player.rhie_bout_count}<span className="ml-1">{getMedal("rhie_bout_count", player.rhie_bout_count)}</span></>
                ) : "—"}
              </td>
              <td className={`${tdClass} text-[var(--bp-text)]`}>
                {player.percentage_max_velocity !== undefined ? (
                  <>{player.percentage_max_velocity.toFixed(1)}%<span className="ml-1">{getMedal("percentage_max_velocity", player.percentage_max_velocity)}</span></>
                ) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
