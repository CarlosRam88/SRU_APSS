"use client";

// GPS Report — PDF rendering of the Dashboard view (summary cards + player table).
// Reproduces the app's "blueprint" dark theme: palette from globals.css, the faint
// cyan grid, and the Scotland logo. Rendered with @react-pdf/renderer (vector output,
// device-independent layout). This module is imported lazily from Dashboard so the
// renderer never ships in the main bundle. Columns/cards follow the user's selected
// metrics, sharing the same config as the on-screen view (./metrics).

import {
  Document, Page, View, Text, Image, StyleSheet, pdf,
} from "@react-pdf/renderer";
import {
  MetricKey, pickMetrics, formatTable, formatCard, buildMedalMap,
} from "./metrics";

// Palette — mirrors :root in globals.css
const C = {
  bg: "#080e1a",
  surface: "#0d1730",
  border: "#1a3a5c",
  accent: "#38bdf8",
  text: "#cde4f5",
  muted: "#5a7fa0",
  grid: "#0f1d30", // 5% cyan over bg, flattened (rgba alpha is unreliable in react-pdf)
};

// Medal colours (gold/silver/bronze) — replaces the 🥇🥈🥉 emoji, which colour fonts
// don't render in PDF. Top-3 values per numeric column are tinted instead.
const MEDAL = ["#facc15", "#cbd5e1", "#d8964e"];

export type ReportRow = {
  athlete_name: string;
  position?: string | null;
  total_distance: number;
  running_distance?: number;
  high_speed_distance?: number;
  high_speed_percentage?: number;
  total_player_load?: number;
  rhie_bout_count?: number;
  contactinvolvement_total_count?: number;
  percentage_max_velocity?: number;
  max_vel?: number;
};

export type GpsReportProps = {
  title: string;
  activityName: string;
  activityDate: string;
  positionsLabel: string;
  generatedAt: string;
  players: number;
  averages: Record<MetricKey, number> | null;
  metrics: MetricKey[];
  rows: ReportRow[];
  logoUrl: string;
};

const styles = StyleSheet.create({
  page: { backgroundColor: C.bg, color: C.text, fontFamily: "Helvetica", fontSize: 8 },
  // Full-bleed grid layer, repeated on every page via `fixed`.
  gridLayer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  gridLine: { position: "absolute", backgroundColor: C.grid },
  content: { paddingHorizontal: 28, paddingTop: 24, paddingBottom: 36 },

  header: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 12, marginBottom: 14,
  },
  logo: { height: 46 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", color: C.accent, letterSpacing: 0.5 },
  subhead: { fontSize: 10, color: C.text, marginTop: 3 },
  meta: { fontSize: 8, color: C.muted, marginTop: 2 },

  cardsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  card: {
    flexGrow: 1, flexBasis: 90, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 5, paddingVertical: 8, paddingHorizontal: 4, alignItems: "center",
  },
  cardLabel: { fontSize: 6, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 },
  cardValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.accent },

  sectionTitle: { fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  table: { borderWidth: 1, borderColor: C.border, borderRadius: 5, overflow: "hidden" },
  headerRow: { flexDirection: "row", backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border },
  th: { fontSize: 7, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4, paddingVertical: 6, paddingHorizontal: 5 },
  td: { fontSize: 8, color: C.text, paddingVertical: 5, paddingHorizontal: 5 },
  playerCell: { flex: 2 },
  numCell: { flex: 1, textAlign: "right" },
  playerName: { color: C.text, fontFamily: "Helvetica-Bold", fontSize: 8 },
  playerPos: { color: C.muted, fontSize: 6, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 1 },

  footer: {
    position: "absolute", bottom: 16, left: 28, right: 28,
    flexDirection: "row", justifyContent: "space-between",
    fontSize: 7, color: C.muted, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 6,
  },
});

// A4 landscape ≈ 842 × 595 pt; 40pt grid to match the on-screen 40px cells.
const PAGE_W = 842;
const PAGE_H = 595;
const GRID_STEP = 40;

function GridLayer() {
  const vLines = [];
  for (let x = GRID_STEP; x < PAGE_W; x += GRID_STEP) {
    vLines.push(<View key={`v${x}`} style={[styles.gridLine, { left: x, top: 0, bottom: 0, width: 1 }]} />);
  }
  const hLines = [];
  for (let y = GRID_STEP; y < PAGE_H; y += GRID_STEP) {
    hLines.push(<View key={`h${y}`} style={[styles.gridLine, { top: y, left: 0, right: 0, height: 1 }]} />);
  }
  return <View style={styles.gridLayer} fixed>{vLines}{hLines}</View>;
}

function GpsReport(props: GpsReportProps) {
  const { title, activityName, activityDate, positionsLabel, generatedAt, players, averages, metrics, rows, logoUrl } = props;
  const columns = pickMetrics(metrics);
  const medalMap = buildMedalMap(rows, metrics);

  const cards = [
    { label: "Players", text: String(players) },
    ...(averages
      ? columns.map((m) => ({ label: m.cardLabel, text: formatCard(m, averages[m.key]) }))
      : []),
  ];

  return (
    <Document title={`${title} — ${activityName}`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <GridLayer />
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={logoUrl} style={styles.logo} />
            <View>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subhead}>{activityName}</Text>
              <Text style={styles.meta}>
                {activityDate} · {players} players · {positionsLabel}
              </Text>
            </View>
          </View>

          {/* Summary cards */}
          <View style={styles.cardsRow}>
            {cards.map((c) => (
              <View key={c.label} style={styles.card}>
                <Text style={styles.cardLabel}>{c.label}</Text>
                <Text style={styles.cardValue}>{c.text}</Text>
              </View>
            ))}
          </View>

          {/* Player table */}
          <Text style={styles.sectionTitle}>Player Stats</Text>
          <View style={styles.table}>
            <View style={styles.headerRow} fixed>
              <Text style={[styles.th, styles.playerCell]}>Player</Text>
              {columns.map((col) => (
                <Text key={col.key} style={[styles.th, styles.numCell]}>{col.tableLabel}</Text>
              ))}
            </View>
            {rows.map((r, i) => (
              <View key={i} style={styles.row} wrap={false}>
                <View style={[styles.td, styles.playerCell]}>
                  <Text style={styles.playerName}>{r.athlete_name}</Text>
                  {r.position ? <Text style={styles.playerPos}>{r.position}</Text> : null}
                </View>
                {columns.map((col) => {
                  const v = r[col.key] as number | undefined;
                  if (v === undefined) {
                    return <Text key={col.key} style={[styles.td, styles.numCell, { color: C.muted }]}>—</Text>;
                  }
                  const rank = v > 0 ? medalMap[col.key]?.get(v) : undefined;
                  const color = rank !== undefined ? MEDAL[rank] : col.accent ? C.accent : C.text;
                  return (
                    <Text key={col.key} style={[styles.td, styles.numCell, { color }]}>
                      {formatTable(col, v)}
                    </Text>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>Scottish Rugby — Athletic Performance &amp; Sport Science</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Generated ${generatedAt}  ·  Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

export async function generateGpsReportBlob(props: GpsReportProps): Promise<Blob> {
  return pdf(<GpsReport {...props} />).toBlob();
}
