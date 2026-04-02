"use client";

import { useMemo, useState } from "react";

type Player = {
  athlete_name: string;
  total_distance: number;
  high_speed_distance?: number;
  high_speed_percentage?: number;
  total_player_load?: number;
};

type SessionTableProps = {
  sessions: Player[];
};

type SortColumn =
  | "athlete_name"
  | "total_distance"
  | "high_speed_distance"
  | "high_speed_percentage"
  | "total_player_load";

export default function SessionTable({ sessions }: SessionTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("total_distance");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

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
              High Speed Distance (m){arrow("high_speed_distance")}
            </th>
            <th className={thClass} onClick={() => handleSort("high_speed_percentage")}>
              HSR %{arrow("high_speed_percentage")}
            </th>
            <th className={thClass} onClick={() => handleSort("total_player_load")}>
              Player Load{arrow("total_player_load")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedSessions.map((player, index) => (
            <tr key={index} className="hover:bg-[var(--bp-border)]/20 transition-colors">
              <td className={`${tdClass} text-[var(--bp-text)] font-medium`}>{player.athlete_name}</td>
              <td className={`${tdClass} text-[var(--bp-accent)]`}>{Math.round(player.total_distance)}</td>
              <td className={`${tdClass} text-[var(--bp-text)]`}>
                {player.high_speed_distance !== undefined
                  ? Math.round(player.high_speed_distance)
                  : "—"}
              </td>
              <td className={`${tdClass} text-[var(--bp-text)]`}>
                {player.high_speed_percentage !== undefined
                  ? `${player.high_speed_percentage.toFixed(1)}%`
                  : "—"}
              </td>
              <td className={`${tdClass} text-[var(--bp-text)]`}>
                {player.total_player_load !== undefined
                  ? Math.round(player.total_player_load)
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
