"use client";

import { useMemo, useRef } from "react";
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
  MetricKey, MetricDef, SortColumn, pickMetrics, formatTable, buildMedalMap,
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
  // Already sorted by the parent (so the table, CSV and PDF share one order).
  sessions: Player[];
  visibleMetrics: MetricKey[];
  sortColumn: SortColumn;
  sortDirection: "asc" | "desc";
  onSort: (column: SortColumn) => void;
  onReorder: (next: MetricKey[]) => void;
};

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

export default function SessionTable({
  sessions, visibleMetrics, sortColumn, sortDirection, onSort, onReorder,
}: SessionTableProps) {
  const columns = useMemo(() => pickMetrics(visibleMetrics), [visibleMetrics]);
  const justDragged = useRef(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
                onClick={() => onSort("athlete_name")}
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
                    onSort={onSort}
                    justDragged={justDragged}
                  />
                ))}
              </SortableContext>
            </tr>
          </thead>
          <tbody>
            {sessions.map((player, index) => (
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
