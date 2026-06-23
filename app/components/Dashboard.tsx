"use client";

import { useEffect, useMemo, useState } from "react";
import ActivityDropdown from "./ActivityDropdown";
import SessionTable from "./SessionTable";
import MetricSelector from "./MetricSelector";
import { MetricKey, ALL_METRIC_KEYS, METRICS, orderMetrics, formatCard, formatCsv } from "./metrics";

type Activity = {
  id: string;
  name: string;
  start_time: number;
  day_code: string | null;
};

type PlayerStat = {
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

type DashboardProps = {
  activities: Activity[];
  hasFetched: boolean;
  loading: boolean;
  onActivityChange?: (activityId: string) => void;
};

export default function Dashboard({ activities, hasFetched, loading, onActivityChange }: DashboardProps) {
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [sessions, setSessions] = useState<PlayerStat[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>([...ALL_METRIC_KEYS]);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (activities.length > 0) {
      setSelectedActivityId(activities[0].id);
      onActivityChange?.(activities[0].id);
    } else {
      setSelectedActivityId("");
      onActivityChange?.("");
      setSessions([]);
    }
  }, [activities, onActivityChange]);

  useEffect(() => {
    if (!selectedActivityId) return;
    setSessionsLoading(true);
    Promise.all([
      fetch(`/api/sessions?activityId=${selectedActivityId}`).then((r) => r.json()),
      fetch(`/api/activity-athletes?activityIds=${selectedActivityId}`).then((r) => r.json()),
    ]).then(([sessionsData, athletesData]) => {
      const positionMap = new Map<string, string>();
      if (Array.isArray(athletesData)) {
        athletesData.forEach((a: any) => {
          if (a.position) positionMap.set(a.athlete_name, a.position);
        });
      }
      const enriched = Array.isArray(sessionsData)
        ? sessionsData.map((s: PlayerStat) => ({
            ...s,
            position: positionMap.get(s.athlete_name) ?? null,
          }))
        : [];
      setSessions(enriched);
      setSessionsLoading(false);
    });
  }, [selectedActivityId]);

  // Reset position filter when session changes
  useEffect(() => {
    setSelectedPositions([]);
  }, [selectedActivityId]);

  const allPositions = useMemo(() => {
    const positions = sessions
      .map((s) => s.position)
      .filter((p): p is string => !!p);
    return Array.from(new Set(positions)).sort();
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    if (selectedPositions.length === 0) return sessions;
    return sessions.filter((s) => s.position && selectedPositions.includes(s.position));
  }, [sessions, selectedPositions]);

  const squadSummary = useMemo(() => {
    const rows = filteredSessions;
    if (rows.length === 0) return null;
    const avg = (key: MetricKey) => {
      const vals = rows.map((r) => r[key] as number).filter((v) => v != null && !isNaN(v));
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };
    const averages = {} as Record<MetricKey, number>;
    METRICS.forEach((m) => { averages[m.key] = avg(m.key); });
    return { players: rows.length, averages };
  }, [filteredSessions]);

  // Summary cards follow the selected metrics (Players is always shown).
  const summaryCards = useMemo(() => {
    if (!squadSummary) return [];
    return [
      { label: "Players", text: String(squadSummary.players) },
      ...orderMetrics(selectedMetrics).map((m) => ({
        label: m.cardLabel,
        text: formatCard(m, squadSummary.averages[m.key]),
      })),
    ];
  }, [squadSummary, selectedMetrics]);

  function exportCSV() {
    const activity = activities.find((a: Activity) => a.id === selectedActivityId);
    const cols = orderMetrics(selectedMetrics);
    const headers = ["Player", "Position", ...cols.map((m) => m.tableLabel)];
    const rows = filteredSessions.map((s) => [
      s.athlete_name,
      s.position ?? "",
      ...cols.map((m) => {
        const v = s[m.key] as number | undefined;
        return v !== undefined ? formatCsv(m, v) : "";
      }),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activity?.name ?? "session"}.csv`.replace(/[^a-z0-9.\-_]/gi, "_");
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPDF() {
    if (pdfLoading) return;
    setPdfLoading(true);
    try {
      const activity = activities.find((a: Activity) => a.id === selectedActivityId);
      const activityDate = activity
        ? new Date(activity.start_time * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
        : "—";
      const positionsLabel =
        selectedPositions.length === 0 ? "All positions" : selectedPositions.join(", ");

      // Lazy-load the renderer (and its ~heavy deps) only when actually exporting.
      const { generateGpsReportBlob } = await import("./gpsReport");
      const blob = await generateGpsReportBlob({
        title: "GPS Report",
        activityName: activity?.name ?? "Session",
        activityDate,
        positionsLabel,
        generatedAt: new Date().toLocaleDateString("en-GB"),
        players: squadSummary?.players ?? filteredSessions.length,
        averages: squadSummary?.averages ?? null,
        metrics: selectedMetrics,
        rows: filteredSessions,
        logoUrl: "/Scotlandlogo.png",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GPS-Report-${activity?.name ?? "session"}.pdf`.replace(/[^a-z0-9.\-_]/gi, "_");
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("Sorry — the PDF export failed. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  }

  function togglePosition(pos: string) {
    setSelectedPositions((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  }

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

  const btnBase = "px-2.5 py-1 text-xs rounded border transition-colors";
  const btnActive = "border-[var(--bp-accent)] text-[var(--bp-accent)] bg-[var(--bp-accent)]/10";
  const btnInactive = "border-[var(--bp-border)] text-[var(--bp-muted)] hover:border-[var(--bp-accent)]/50";

  return (
    <div>
      <div className="flex flex-wrap gap-4 items-end mb-6">
        <ActivityDropdown
          activities={activities}
          selectedActivityId={selectedActivityId}
          onSelectActivity={(id) => { setSelectedActivityId(id); onActivityChange?.(id); }}
        />
        <MetricSelector selected={selectedMetrics} onChange={setSelectedMetrics} />
      </div>

      {/* Squad summary bar — cards follow the selected metrics */}
      {squadSummary && !sessionsLoading && (
        <div
          className="grid gap-3 mb-4"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))" }}
        >
          {summaryCards.map(({ label, text }) => (
            <div key={label} className="bg-[var(--bp-surface)] border border-[var(--bp-border)] rounded-lg px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-widest text-[var(--bp-muted)] mb-1">{label}</p>
              <p className="text-lg font-semibold text-[var(--bp-accent)]">{text}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-[var(--bp-surface)] border border-[var(--bp-border)] rounded-lg p-5">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <h2 className="text-sm uppercase tracking-widest text-[var(--bp-muted)]">Player Stats</h2>
          {allPositions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-[var(--bp-muted)] uppercase tracking-wider mr-1">Position:</span>
              <button
                onClick={() => setSelectedPositions([])}
                className={`${btnBase} ${selectedPositions.length === 0 ? btnActive : btnInactive}`}
              >
                All
              </button>
              {allPositions.map((pos) => (
                <button
                  key={pos}
                  onClick={() => togglePosition(pos)}
                  className={`${btnBase} ${selectedPositions.includes(pos) ? btnActive : btnInactive}`}
                >
                  {pos}
                </button>
              ))}
            </div>
          )}
          {filteredSessions.length > 0 && (
            <div className="ml-auto flex gap-2">
              <button
                onClick={exportCSV}
                className="px-3 py-1.5 text-xs rounded border border-[var(--bp-border)] text-[var(--bp-muted)] hover:border-[var(--bp-accent)]/50 hover:text-[var(--bp-accent)] transition-colors"
              >
                ↓ Export CSV
              </button>
              <button
                onClick={exportPDF}
                disabled={pdfLoading}
                className="px-3 py-1.5 text-xs rounded border border-[var(--bp-border)] text-[var(--bp-muted)] hover:border-[var(--bp-accent)]/50 hover:text-[var(--bp-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pdfLoading ? "Generating…" : "↓ Export PDF"}
              </button>
            </div>
          )}
        </div>
        {sessionsLoading ? (
          <p className="text-[var(--bp-muted)] text-sm">Loading session data…</p>
        ) : (
          <SessionTable sessions={filteredSessions} visibleMetrics={selectedMetrics} />
        )}
      </div>
    </div>
  );
}
