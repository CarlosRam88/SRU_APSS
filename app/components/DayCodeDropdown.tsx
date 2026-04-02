type DayCodeDropdownProps = {
  dayCodes: string[];
  selectedDayCode: string;
  onSelectDayCode: (dayCode: string) => void;
};

export default function DayCodeDropdown({
  dayCodes,
  selectedDayCode,
  onSelectDayCode,
}: DayCodeDropdownProps) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-[var(--bp-muted)] mb-1.5">
        Day Code
      </label>
      <select
        value={selectedDayCode}
        onChange={(e) => onSelectDayCode(e.target.value)}
        className="bg-[var(--bp-bg)] border border-[var(--bp-border)] text-[var(--bp-text)] text-sm rounded px-3 py-2 min-w-40 focus:outline-none focus:border-[var(--bp-accent)]"
      >
        <option value="All">All</option>
        {dayCodes.map((dayCode) => (
          <option key={dayCode} value={dayCode}>
            {dayCode}
          </option>
        ))}
      </select>
    </div>
  );
}
