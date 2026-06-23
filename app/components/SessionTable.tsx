"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext, closestCenter, MouseSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, horizontalListSortingStrategy, useSortable,
  sortableKeyboardCoordinates, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
  MetricKey, MetricDef, pickMetrics, formatTable, buildMedalMap,
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
  onReorder: (next: MetricKey[]) => void;
};

type SortColumn = "athlete_name" | MetricKey;

const MEDALS = ["🥇", "🥈", "🥉"];

const thClass = "px-4 py-3 text-left text-xs uppercase tracking-wider text-[var(--bp-muted)] select-none hover:text-[var(--bp-accent)] transition-colors border-b border-[var(--bp-border)]";
const tdClass = "px-4 py-3 text-sm border-b border-[var(--bp-border)]";

function SortArrow({ active, direction }: { active: boolean; direction: "asc" | "desc" }) {
  if (!active) return <span className="text-[var(--bp-border)] ml-1">↕</span>;
  return <span className="text-[var(--bp-accent)] ml-1">{direction === "asc" ? "↑" : "↓"}</span>;
}

// A draggable, sortable metric column header. Long-press (touch) or click-drag (mouse)
// to reposition; a plain click sorts. `justDragged` suppresses the click that fires
// right after a drag so a reorder doesn't also trigger a sort.
function SortableHeader({
  col, sortColumn, sortDirection, onSort, justDragged,
}: {
  col: MetricDef;
  sortColumn: SortColumn;
  sortDirection: "asc" | "desc";
  onSort: (key: MetricKey) => void;
  justDragged: React.RefObject<boolean>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.key });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    cursor: "grab",
    touchAction: "none",
  };
  return (
    <th
      ref={setNodeRef}
      style={style}
      className={thClass}
      {...attributes}
      {...listeners}
      onClick={() => { if (!justDragged.current) onSort(col.key); }}
    >
      <span className="inline-flex items-center gap-1.5">
        <span className="text-[var(--bp-border)] text-[10px] leading-none" aria-hidden>⠿</span>
        {col.tableLabel}
        <SortArrow active={sortColumn === col.key} direction={sortDirection} />
      </span>
    </th>
  );
}

export default function SessionTable({ sessions, visibleMetrics, onReorder }: SessionTableProps) {
  const columns = useMemo(() => pickMetrics(visibleMetrics), [visibleMetrics]);

  const [sortColumn, setSortColumn] = useState<SortColumn>("total_distance");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const justDragged = useRef(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  function handleDragStart() {
    justDragged.current = true;
  }

  function handleDragEnd(event: DragEndEvent) {
    // Clear on the next tick — after the click that follows pointer-up has been
    // suppressed — so the next genuine click can sort again.
    setTimeout(() => { justDragged.current = false; }, 0);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = visibleMetrics.indexOf(active.id as MetricKey);
      const newIndex = visibleMetrics.indexOf(over.id as MetricKey);
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(arrayMove(visibleMetrics, oldIndex, newIndex));
      }
    }
  }

  if (sessions.length === 0) {
    return <p className="text-[var(--bp-muted)] text-sm">No player data available.</p>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToHorizontalAxis]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setTimeout(() => { justDragged.current = false; }, 0)}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[var(--bp-bg)]">
              <th
                className={`${thClass} cursor-pointer`}
                onClick={() => handleSort("athlete_name")}
              >
                Player<SortArrow active={sortColumn === "athlete_name"} direction={sortDirection} />
              </th>
              <SortableContext items={columns.map((c) => c.key)} strategy={horizontalListSortingStrategy}>
                {columns.map((col) => (
                  <SortableHeader
                    key={col.key}
                    col={col}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    justDragged={justDragged}
                  />
                ))}
              </SortableContext>
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
    </DndContext>
  );
}
