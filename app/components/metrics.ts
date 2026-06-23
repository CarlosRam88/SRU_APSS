// Single source of truth for the dashboard's player metrics.
// Consumed by the metric selector, summary cards, session table, CSV export and
// PDF report so the "selected metrics" choice stays consistent everywhere.

export type MetricKey =
  | "total_distance"
  | "running_distance"
  | "high_speed_distance"
  | "high_speed_percentage"
  | "total_player_load"
  | "rhie_bout_count"
  | "contactinvolvement_total_count"
  | "percentage_max_velocity"
  | "max_vel";

export interface MetricDef {
  key: MetricKey;
  shortLabel: string; // dropdown / compact label
  tableLabel: string; // table + PDF column header (also used as CSV header)
  cardLabel: string;  // squad-summary card label ("Avg …")
  unit: string;       // card suffix; also drives inline "%" in table/PDF values
  tableDecimals: 0 | 1;
  cardDecimals: 0 | 1;
  csvDecimals: 0 | 1;
  accent?: boolean;   // rendered in accent colour (Total Distance)
}

// Canonical display order. Selecting/deselecting changes which appear, never the order.
export const METRICS: MetricDef[] = [
  { key: "total_distance",          shortLabel: "Total Distance",   tableLabel: "Total Distance (m)",   cardLabel: "Avg Distance",    unit: "m", tableDecimals: 0, cardDecimals: 0, csvDecimals: 0, accent: true },
  { key: "running_distance",        shortLabel: "Running Distance", tableLabel: "Running Distance (m)", cardLabel: "Avg Run Dist",    unit: "m", tableDecimals: 0, cardDecimals: 0, csvDecimals: 0 },
  { key: "high_speed_distance",     shortLabel: "HSD",              tableLabel: "HSD (m)",              cardLabel: "Avg HSD",         unit: "m", tableDecimals: 0, cardDecimals: 0, csvDecimals: 0 },
  { key: "high_speed_percentage",   shortLabel: "HSR %",            tableLabel: "HSR %",                cardLabel: "Avg HSR %",       unit: "%", tableDecimals: 1, cardDecimals: 1, csvDecimals: 1 },
  { key: "total_player_load",       shortLabel: "Player Load",      tableLabel: "Player Load",          cardLabel: "Avg PL",          unit: "",  tableDecimals: 0, cardDecimals: 1, csvDecimals: 1 },
  { key: "rhie_bout_count",         shortLabel: "RHIE Bouts",       tableLabel: "RHIE Bouts",           cardLabel: "Avg RHIE",        unit: "",    tableDecimals: 0, cardDecimals: 1, csvDecimals: 0 },
  { key: "contactinvolvement_total_count", shortLabel: "Contact Inv.", tableLabel: "Contact Inv.",       cardLabel: "Avg Contacts",    unit: "",    tableDecimals: 0, cardDecimals: 1, csvDecimals: 0 },
  { key: "percentage_max_velocity", shortLabel: "% Max Vel.",       tableLabel: "% Max Vel.",           cardLabel: "Avg % Max Vel",   unit: "%",   tableDecimals: 1, cardDecimals: 1, csvDecimals: 1 },
  { key: "max_vel",                 shortLabel: "Max Vel",          tableLabel: "Max Vel (m/s)",        cardLabel: "Avg Max Vel",     unit: "m/s", tableDecimals: 1, cardDecimals: 1, csvDecimals: 1 },
];

export const ALL_METRIC_KEYS: MetricKey[] = METRICS.map((m) => m.key);

const BY_KEY = new Map<MetricKey, MetricDef>(METRICS.map((m) => [m.key, m]));

export function metricDef(key: MetricKey): MetricDef {
  return BY_KEY.get(key)!;
}

// Resolve keys to their defs, preserving the given order (the user's column order).
// Unknown keys are dropped.
export function pickMetrics(keys: MetricKey[]): MetricDef[] {
  return keys
    .map((k) => BY_KEY.get(k))
    .filter((m): m is MetricDef => m !== undefined);
}

function fmtNum(v: number, decimals: 0 | 1): string {
  return decimals === 0 ? String(Math.round(v)) : v.toFixed(decimals);
}

// Table / PDF cell: value with inline "%" for ratio metrics (distances carry "(m)" in the header).
export function formatTable(m: MetricDef, v: number): string {
  return fmtNum(v, m.tableDecimals) + (m.unit === "%" ? "%" : "");
}

// Summary card: value with its unit suffix.
export function formatCard(m: MetricDef, v: number): string {
  return fmtNum(v, m.cardDecimals) + m.unit;
}

// CSV: bare number (unit lives in the header).
export function formatCsv(m: MetricDef, v: number): string {
  return fmtNum(v, m.csvDecimals);
}

// For each key, map value -> medal rank (0=gold, 1=silver, 2=bronze) over the top-3
// distinct positive values. Shared by the session table (emoji) and PDF (colour tint).
export function buildMedalMap(
  rows: Array<Record<string, unknown>>,
  keys: MetricKey[],
): Record<string, Map<number, number>> {
  const result: Record<string, Map<number, number>> = {};
  keys.forEach((key) => {
    const vals = rows
      .map((r) => r[key] as number | undefined)
      .filter((v): v is number => typeof v === "number" && v > 0)
      .sort((a, b) => b - a);
    const top3 = [...new Set(vals)].slice(0, 3);
    const map = new Map<number, number>();
    top3.forEach((v, i) => map.set(v, i));
    result[key] = map;
  });
  return result;
}
