type Activity = {
  id: string;
  name: string;
  start_time: number;
  day_code: string | null;
};

type ActivityDropdownProps = {
  activities: Activity[];
  selectedActivityId: string;
  onSelectActivity: (activityId: string) => void;
};

export default function ActivityDropdown({
  activities,
  selectedActivityId,
  onSelectActivity,
}: ActivityDropdownProps) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-[var(--bp-muted)] mb-1.5">
        Activity
      </label>
      <select
        value={selectedActivityId}
        onChange={(e) => onSelectActivity(e.target.value)}
        className="bg-[var(--bp-bg)] border border-[var(--bp-border)] text-[var(--bp-text)] text-sm rounded px-3 py-2 min-w-72 focus:outline-none focus:border-[var(--bp-accent)]"
      >
        {activities.map((activity) => (
          <option key={activity.id} value={activity.id}>
            {activity.name} — {new Date(activity.start_time * 1000).toLocaleDateString()}
            {activity.day_code ? ` — ${activity.day_code}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
