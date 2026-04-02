"use client";

import { useEffect, useRef, useState } from "react";
import { ActivityStat } from "./LongitudinalChart";

type Activity = {
  id: string;
  name: string;
  start_time: number;
  day_code: string | null;
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Props = {
  activities: Activity[];
  stats: ActivityStat[];
  selectedActivityId: string;
  isOpen: boolean;
  onClose: () => void;
};

function buildContext(activities: Activity[], stats: ActivityStat[], selectedActivityId: string): string {
  if (activities.length === 0) return "No activities are currently loaded.";

  const selectedActivity = activities.find((a) => a.id === selectedActivityId);
  const selectedDate = selectedActivity
    ? new Date(selectedActivity.start_time * 1000).toLocaleDateString("en-GB")
    : null;

  // Stats for the currently selected activity
  const selectedStats = stats.filter((s) => s.activity_id === selectedActivityId);
  const selectedLines = selectedStats.length > 0
    ? selectedStats
        .sort((a, b) => b.total_distance - a.total_distance)
        .map((s) => `  - ${s.athlete_name}: total_distance=${Math.round(s.total_distance)}m, high_speed_distance=${Math.round(s.high_speed_distance)}m, hsr=${s.high_speed_percentage.toFixed(1)}%`)
        .join("\n")
    : "  No stats available.";

  // Aggregated totals across all loaded activities
  const byAthlete = new Map<string, { total_distance: number; high_speed_distance: number; hsr_values: number[]; sessions: number }>();
  stats.forEach((s) => {
    if (!byAthlete.has(s.athlete_name)) {
      byAthlete.set(s.athlete_name, { total_distance: 0, high_speed_distance: 0, hsr_values: [], sessions: 0 });
    }
    const entry = byAthlete.get(s.athlete_name)!;
    entry.total_distance += s.total_distance;
    entry.high_speed_distance += s.high_speed_distance;
    entry.hsr_values.push(s.high_speed_percentage);
    entry.sessions += 1;
  });

  const allTimeLines = Array.from(byAthlete.entries())
    .sort((a, b) => b[1].total_distance - a[1].total_distance)
    .map(([name, d]) => {
      const avgHSR = d.hsr_values.reduce((a, b) => a + b, 0) / d.hsr_values.length;
      return `  - ${name}: total_distance=${Math.round(d.total_distance)}m, high_speed_distance=${Math.round(d.high_speed_distance)}m, avg_hsr=${avgHSR.toFixed(1)}%, sessions=${d.sessions}`;
    })
    .join("\n");

  const activityList = activities
    .map((a) => {
      const date = new Date(a.start_time * 1000).toLocaleDateString("en-GB");
      return `  - ${a.name} (${date}${a.day_code ? `, DayCode: ${a.day_code}` : ""})${a.id === selectedActivityId ? " ← CURRENTLY SELECTED" : ""}`;
    })
    .join("\n");

  return [
    `CURRENTLY SELECTED ACTIVITY: ${selectedActivity?.name ?? "None"} (${selectedDate ?? "—"})`,
    `PLAYER STATS FOR SELECTED ACTIVITY:\n${selectedLines}`,
    `ALL LOADED ACTIVITIES (${activities.length}):\n${activityList}`,
    `PLAYER TOTALS ACROSS ALL LOADED ACTIVITIES:\n${allTimeLines}`,
  ].join("\n\n");
}

export default function ChatPanel({ activities, stats, selectedActivityId, isOpen, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: newMessages,
        context: buildContext(activities, stats, selectedActivityId),
      }),
    });

    const data = await res.json();
    setMessages([...newMessages, { role: "assistant", content: data.reply }]);
    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md z-40 flex flex-col
          bg-[var(--bp-surface)] border-l border-[var(--bp-border)]
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--bp-border)]">
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--bp-muted)]">AI Assistant</p>
            <p className="text-sm font-medium text-[var(--bp-text)]">Hamish</p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--bp-muted)] hover:text-[var(--bp-text)] transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {messages.length === 0 && (
            <div className="text-[var(--bp-muted)] text-sm mt-4 space-y-2">
              <p>Ask questions about your loaded data, for example:</p>
              <ul className="space-y-1 list-disc list-inside text-xs">
                <li>Who covered the most distance?</li>
                <li>Which player had the highest HSR%?</li>
                <li>Compare the top 3 players by high speed distance</li>
                <li>What was the average total distance across all sessions?</li>
              </ul>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[85%] px-4 py-2.5 rounded-lg text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "self-end bg-[var(--bp-accent)]/20 text-[var(--bp-text)] border border-[var(--bp-accent)]/30"
                  : "self-start bg-[var(--bp-bg)] text-[var(--bp-text)] border border-[var(--bp-border)]"
              }`}
            >
              {msg.content}
            </div>
          ))}
          {loading && (
            <div className="self-start bg-[var(--bp-bg)] border border-[var(--bp-border)] px-4 py-2.5 rounded-lg text-sm text-[var(--bp-muted)]">
              Thinking…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-5 py-4 border-t border-[var(--bp-border)]">
          {activities.length === 0 && (
            <p className="text-xs text-[var(--bp-muted)] mb-2">Fetch some activities first to give the assistant data to work with.</p>
          )}
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Ask a question… (Enter to send)"
              disabled={loading}
              className="flex-1 bg-[var(--bp-bg)] border border-[var(--bp-border)] text-[var(--bp-text)] text-sm rounded px-3 py-2 resize-none focus:outline-none focus:border-[var(--bp-accent)] placeholder:text-[var(--bp-muted)] disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="px-4 py-2 rounded text-sm font-medium bg-[var(--bp-accent)] text-[var(--bp-bg)] hover:bg-[var(--bp-accent-dim)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors self-end"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
