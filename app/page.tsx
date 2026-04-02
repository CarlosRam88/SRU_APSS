"use client";

import { useEffect, useState } from "react";
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

  const ALLOWED_TEAMS = ["Scotland U18", "Scotland U20", "Scotland U20 Female", "Scotland 7s", "ScottishRU", "SW Performance Squad"];

  useEffect(() => {
    fetch("/api/teams")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTeams(data.filter((t: Team) => ALLOWED_TEAMS.includes(t.name)));
      });
  }, []);

  // Keep shared stats in sync when activities change (used by both Visuals and Chat)
  useEffect(() => {
    if (activities.length === 0) { setStats([]); return; }
    const params = new URLSearchParams();
    activities.forEach((a) => params.append("activityIds", a.id));
    fetch(`/api/stats-range?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setStats(data); });
  }, [activities]);

  async function handleFetch() {
    setLoading(true);
    setActivities([]);
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

  const inputClass = "bg-[var(--bp-bg)] border border-[var(--bp-border)] text-[var(--bp-text)] text-sm rounded px-3 py-2 focus:outline-none focus:border-[var(--bp-accent)]";
  const labelClass = "block text-xs uppercase tracking-wider text-[var(--bp-muted)] mb-1.5";

  return (
    <main className="min-h-screen px-6 py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 border-b border-[var(--bp-border)] pb-4 flex items-center gap-5">
        <img src="/Scotlandlogo.png" alt="Scottish Rugby" className="h-16 w-auto" />
        <div>
          <p className="text-xs uppercase tracking-widest text-[var(--bp-muted)] mb-1">Scottish Rugby Athletic Performance</p>
          <h1 className="text-3xl font-semibold text-[var(--bp-accent)] tracking-tight">
            Catapult Dashboard Prototype
          </h1>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-[var(--bp-surface)] border border-[var(--bp-border)] rounded-lg p-5 flex flex-wrap gap-5 items-end mb-6">
        <label className="cursor-pointer">
          <span className={labelClass}>From</span>
          <input id="date-from" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${inputClass} cursor-pointer`} />
        </label>
        <label className="cursor-pointer">
          <span className={labelClass}>To</span>
          <input id="date-to" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`${inputClass} cursor-pointer`} />
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
        <button
          onClick={handleFetch}
          disabled={loading}
          className="px-5 py-2 rounded text-sm font-medium tracking-wide transition-colors bg-[var(--bp-accent)] text-[var(--bp-bg)] hover:bg-[var(--bp-accent-dim)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Loading…" : "Fetch Activities"}
        </button>
      </div>

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
        <Dashboard activities={activities} hasFetched={hasFetched} loading={loading} onActivityChange={setSelectedActivityId} />
      )}
      {activeTab === "visuals" && (
        <Visuals activities={activities} stats={stats} hasFetched={hasFetched} loading={loading} />
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
        activities={activities}
        stats={stats}
        selectedActivityId={selectedActivityId}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </main>
  );
}
