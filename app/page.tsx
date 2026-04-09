"use client";

import { useEffect, useMemo, useState } from "react";
import Dashboard from "./components/Dashboard";
import Visuals from "./components/Visuals";
import ChatPanel from "./components/ChatPanel";
import { ActivityStat } from "./components/LongitudinalChart";

type Activity = {
  id: string;
  name: string;
  start_time: number;
  day_code: string | null;
};

type Team = {
  id: string;
  name: string;
};

type Tab = "dashboard" | "visuals";

const FOUR_MONTHS_MS = 4 * 30 * 24 * 60 * 60 * 1000;

export default function Home() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [chatOpen, setChatOpen] = useState(false);
  const [stats, setStats] = useState<ActivityStat[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [showWarning, setShowWarning] = useState(false);
  const [selectedDayCodes, setSelectedDayCodes] = useState<string[]>([]);

  const ALLOWED_TEAMS = ["Scotland U18", "Scotland U20", "Scotland U20 Female", "Scotland7s", "ScottishRU", "SW Performance Squad"];

  useEffect(() => {
    fetch("/api/teams")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTeams(data.filter((t: Team) => ALLOWED_TEAMS.includes(t.name)));
      });
  }, []);

  // Fetch stats + positions in parallel, then join position onto each stat row
  useEffect(() => {
    if (activities.length === 0) { setStats([]); return; }
    const params = new URLSearchParams();
    activities.forEach((a) => params.append("activityIds", a.id));
    const qs = params.toString();
    Promise.all([
      fetch(`/api/stats-range?${qs}`).then((r) => r.json()),
      fetch(`/api/activity-athletes?${qs}`).then((r) => r.json()),
    ]).then(([statsData, athletesData]) => {
      if (!Array.isArray(statsData)) return;
      const positionMap = new Map<string, string>();
      if (Array.isArray(athletesData)) {
        athletesData.forEach((a: any) => {
          if (a.position) positionMap.set(`${a.activity_id}|${a.athlete_name}`, a.position);
        });
      }
      const enriched = statsData
        .map((s: ActivityStat) => ({
          ...s,
          position: positionMap.get(`${s.activity_id}|${s.athlete_name}`) ?? null,
        }))
        .filter((s: ActivityStat) => s.total_distance > 250); // exclude test/equipment check sessions
      setStats(enriched);
    });
  }, [activities]);

  function isLargeRange(): boolean {
    if (!startDate) return true; // no start date — could fetch everything
    const start = new Date(startDate).getTime();
    const end = endDate ? new Date(endDate).getTime() : Date.now();
    return end - start > FOUR_MONTHS_MS;
  }

  function handleFetchClick() {
    if (isLargeRange()) {
      setShowWarning(true);
    } else {
      doFetch();
    }
  }

  async function doFetch() {
    setShowWarning(false);
    setLoading(true);
    setActivities([]);
    setSelectedDayCodes([]);
    setHasFetched(true);
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    selectedTeamIds.forEach((id) => params.append("teamIds", id));
    const res = await fetch(`/api/activities?${params.toString()}`);
    const data = await res.json();
    setLoading(false);
    if (Array.isArray(data)) setActivities(data);
  }

  function toggleTeam(id: string) {
    setSelectedTeamIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  const allDayCodes = useMemo(() => {
    const codes = activities.map((a) => a.day_code).filter((c): c is string => !!c);
    return Array.from(new Set(codes)).sort();
  }, [activities]);

  const filteredActivities = useMemo(() => {
    if (selectedDayCodes.length === 0) return activities;
    return activities.filter((a) => a.day_code && selectedDayCodes.includes(a.day_code));
  }, [activities, selectedDayCodes]);

  const filteredStats = useMemo(() => {
    if (selectedDayCodes.length === 0) return stats;
    const ids = new Set(filteredActivities.map((a) => a.id));
    return stats.filter((s) => ids.has(s.activity_id));
  }, [stats, filteredActivities, selectedDayCodes]);

  const inputClass = "bg-[var(--bp-bg)] border border-[var(--bp-border)] text-[var(--bp-text)] text-sm rounded px-3 py-2 focus:outline-none focus:border-[var(--bp-accent)]";
  const labelClass = "block text-xs uppercase tracking-wider text-[var(--bp-muted)] mb-1.5";
  const btnBase = "px-2.5 py-1 text-xs rounded border transition-colors";
  const btnActive = "border-[var(--bp-accent)] text-[var(--bp-accent)] bg-[var(--bp-accent)]/10";
  const btnInactive = "border-[var(--bp-border)] text-[var(--bp-muted)] hover:border-[var(--bp-accent)]/50";

  return (
    <main className="min-h-screen px-6 py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 border-b border-[var(--bp-border)] pb-4 flex items-center gap-5">
        <img src="/Scotlandlogo.png" alt="Scottish Rugby" className="h-16 w-auto" />
        <div>
          <p className="text-xs uppercase tracking-widest text-[var(--bp-muted)] mb-1">Scottish Rugby Athletic Performance and Sport Science</p>
          <h1 className="text-3xl font-semibold text-[var(--bp-accent)] tracking-tight">
            Catapult Dashboard - Prototype
          </h1>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-[var(--bp-surface)] border border-[var(--bp-border)] rounded-lg p-5 flex flex-wrap gap-5 items-end mb-3">
        <label className="cursor-pointer">
          <span className={labelClass}>From</span>
          <input id="date-from" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setShowWarning(false); }} className={`${inputClass} cursor-pointer`} />
        </label>
        <label className="cursor-pointer">
          <span className={labelClass}>To</span>
          <input id="date-to" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setShowWarning(false); }} className={`${inputClass} cursor-pointer`} />
        </label>
        {teams.length > 0 && (
          <div>
            <label className={labelClass}>Teams</label>
            <div className="flex flex-wrap gap-3">
              {teams.map((team) => (
                <label key={team.id} className="flex items-center gap-2 text-sm text-[var(--bp-text)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedTeamIds.includes(team.id)}
                    onChange={() => toggleTeam(team.id)}
                    className="accent-[var(--bp-accent)] w-4 h-4"
                  />
                  {team.name}
                </label>
              ))}
            </div>
          </div>
        )}
        <div>
          <button
            onClick={handleFetchClick}
            disabled={loading || selectedTeamIds.length === 0}
            className="px-5 py-2 rounded text-sm font-medium tracking-wide transition-colors bg-[var(--bp-accent)] text-[var(--bp-bg)] hover:bg-[var(--bp-accent-dim)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Loading…" : "Fetch Activities"}
          </button>
          {selectedTeamIds.length === 0 && (
            <p className="text-xs text-[var(--bp-muted)] mt-1.5">Select at least one team to fetch.</p>
          )}
        </div>
      </div>

      {/* Large range warning */}
      {showWarning && (
        <div className="bg-[var(--bp-surface)] border border-amber-500/40 rounded-lg px-5 py-4 mb-3 flex flex-wrap items-center gap-4">
          <p className="text-sm text-amber-400 flex-1">
            ⚠ Fetching a large number of activities may impact dashboard performance. Consider narrowing your date range or filtering by day code after fetching. Continue?
          </p>
          <div className="flex gap-2">
            <button
              onClick={doFetch}
              className="px-4 py-1.5 text-xs rounded border border-amber-500/60 text-amber-400 hover:bg-amber-500/10 transition-colors"
            >
              Yes, continue
            </button>
            <button
              onClick={() => setShowWarning(false)}
              className={`${btnBase} ${btnInactive}`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Day code filter — appears after fetch */}
      {allDayCodes.length > 0 && (
        <div className="bg-[var(--bp-surface)] border border-[var(--bp-border)] rounded-lg px-5 py-3 mb-3 flex flex-wrap items-center gap-3">
          <span className="text-xs uppercase tracking-wider text-[var(--bp-muted)]">Day Code</span>
          <button
            onClick={() => setSelectedDayCodes([])}
            className={`${btnBase} ${selectedDayCodes.length === 0 ? btnActive : btnInactive}`}
          >
            All
          </button>
          {allDayCodes.map((code) => (
            <button
              key={code}
              onClick={() => setSelectedDayCodes((prev) =>
                prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
              )}
              className={`${btnBase} ${selectedDayCodes.includes(code) ? btnActive : btnInactive}`}
            >
              {code}
            </button>
          ))}
          <span className="text-xs text-[var(--bp-muted)] ml-auto">
            {filteredActivities.length} of {activities.length} activities
          </span>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 border-b border-[var(--bp-border)]">
        {(["dashboard", "visuals"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium tracking-wide capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-[var(--bp-accent)] text-[var(--bp-accent)]"
                : "border-transparent text-[var(--bp-muted)] hover:text-[var(--bp-text)]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "dashboard" && (
        <Dashboard activities={filteredActivities} hasFetched={hasFetched} loading={loading} onActivityChange={setSelectedActivityId} />
      )}
      {activeTab === "visuals" && (
        <Visuals activities={filteredActivities} stats={filteredStats} hasFetched={hasFetched} loading={loading} />
      )}

      {/* Floating chat button */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-6 right-6 z-20 flex items-center gap-2 px-4 py-3 rounded-full text-sm font-medium
          bg-[var(--bp-accent)] text-[var(--bp-bg)] shadow-lg hover:bg-[var(--bp-accent-dim)] transition-colors"
      >
        <span className="text-base">💬</span>
        Ask Hamish
      </button>

      {/* Chat panel */}
      <ChatPanel
        activities={filteredActivities}
        stats={filteredStats}
        selectedActivityId={selectedActivityId}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </main>
  );
}
