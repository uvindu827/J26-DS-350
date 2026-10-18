import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { Stack } from 'expo-router';
import api from '../services/api';
import CoastalMap from '../components/CoastalMap';

type Productivity = 'Low' | 'Medium' | 'High';
type Cell = {
  date: string; latitude: number; longitude: number;
  predicted_chl_mg_m3: number; actual_chl_mg_m3: number | null;
  productivity_class: Productivity; prediction_type: string;
};
type MapResponse = { date: string; count: number; cells: Cell[] };
type DatesResponse = { dates: string[] };

const colors = {
  navy: '#102A43', teal: '#087F83', ocean: '#EDF5F8',
  muted: '#687E8D', border: '#DFE8ED', low: '#3C86C8',
  medium: '#DEA446', high: '#16947B', white: '#FFFFFF',
};
const P33 = 0.2126709519;
const P66 = 0.4330995018;
const keyOf = (c: Pick<Cell, 'latitude' | 'longitude'>) =>
  `${c.latitude.toFixed(6)}:${c.longitude.toFixed(6)}`;
const fmt = (value: number | null | undefined, digits = 3) =>
  value == null ? '—' : value.toFixed(digits);
function categoryColor(p: Productivity) {
  return p === 'Low' ? colors.low : p === 'Medium' ? colors.medium : colors.high;
}
function validISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function shiftDate(value: string, delta: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}
function Btn({ title, onPress, active = false }: {
  title: string; onPress: () => void; active?: boolean;
}) {
  return (
    <TouchableOpacity accessibilityRole="button" onPress={onPress}
      style={[styles.button, active && styles.buttonActive]}>
      <Text style={[styles.buttonText, active && { color: '#FFFFFF' }]}>{title}</Text>
    </TouchableOpacity>
  );
}
function Panel({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}
export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 960;
  const [backend, setBackend] = useState('Checking connection');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [dateInput, setDateInput] = useState('2021-10-05');
  const [date, setDate] = useState('2021-10-05');
  const [dateError, setDateError] = useState('');
  const [cells, setCells] = useState<Cell[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [filter, setFilter] = useState<'All' | Productivity>('All');

  useEffect(() => {
    api.get('/health').then(r => setBackend(r.data.status))
      .catch(() => setBackend('Disconnected'));
    api.get<DatesResponse>('/api/forecast/dates')
      .then(r => setAvailableDates(r.data.dates))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setApiError('');
    setCells([]);
    api.get<MapResponse>('/api/forecast/map', { params: { date } })
      .then(r => {
        if (cancelled) return;
        const values = r.data.cells;
        setCells(values);
        setSelectedKey(previous =>
          values.some(v => keyOf(v) === previous) ? previous :
          values.length ? keyOf(values[0]) : null
        );
      })
      .catch(err => {
        if (!cancelled) setApiError(err?.response?.data?.detail || 'Could not load coastal data. Check FastAPI.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date]);

  const selected = cells.find(c => keyOf(c) === selectedKey) ?? null;
  const mapped = useMemo(() => cells.filter(c => filter === 'All' || c.productivity_class === filter), [cells, filter]);
  const stats = useMemo(() => ({
    Low: cells.filter(c => c.productivity_class === 'Low').length,
    Medium: cells.filter(c => c.productivity_class === 'Medium').length,
    High: cells.filter(c => c.productivity_class === 'High').length,
  }), [cells]);

  function applyDate() {
    const trimmed = dateInput.trim();
    if (!validISODate(trimmed)) {
      setDateError('Use a valid date in YYYY-MM-DD format.');
      return;
    }
    setDateError('');
    setDate(trimmed);
  }
  function changeDate(delta: number) {
    const shifted = shiftDate(date, delta);
    setDateInput(shifted);
    setDateError('');
    setDate(shifted);
  }
  function moveAvailable(delta: number) {
    const dates = availableDates;
    if (!dates.length) return;
    const pos = dates.indexOf(date);
    const nextIndex = pos < 0
      ? (delta > 0 ? dates.findIndex(x => x > date) : dates.reduce((acc, x, i) => x < date ? i : acc, -1))
      : pos + delta;
    if (nextIndex < 0 || nextIndex >= dates.length) return;
    setDateInput(dates[nextIndex]);
    setDate(dates[nextIndex]);
    setDateError('');
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 36 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>◈ FishGuard AI</Text>
          <Text style={styles.headerSubtitle}>COMPONENT 2  /  CHLOROPHYLL-A INTELLIGENCE</Text>
        </View>
        <Text style={styles.headerChip}>Western + Southern Sri Lanka</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.intro}>
          <Text style={styles.kickerLight}>COASTAL PRODUCTIVITY EXPLORER</Text>
          <Text style={styles.heroTitle}>Where is marine productivity potential higher?</Text>
          <Text style={styles.heroText}>
            Explore real coastal grid predictions from your trained XGBoost model,
            using a geographic map of Sri Lanka and training-derived CHL thresholds.
          </Text>
          
        </View>

        <Panel>
          <Text style={styles.sectionLabel}>HISTORICAL DATE</Text>
          <Text style={styles.panelTitle}>Choose the date you want to explore</Text>
          <View style={styles.controls}>
            <Btn title="−1 day" onPress={() => changeDate(-1)} />
            <TextInput accessibilityLabel="Date YYYY-MM-DD" value={dateInput}
              onChangeText={setDateInput} onSubmitEditing={applyDate}
              placeholder="YYYY-MM-DD" style={styles.dateInput} />
            <Btn title="Apply date" onPress={applyDate} active />
            <Btn title="+1 day" onPress={() => changeDate(1)} />
          </View>
          {availableDates.length > 0 && (
            <View style={styles.controls}>
              <Text style={styles.muted}>Browse available test dates:</Text>
              <Btn title="◀ Previous available" onPress={() => moveAvailable(-1)} />
              <Btn title="Next available ▶" onPress={() => moveAvailable(1)} />
              <Text style={styles.muted}>{availableDates.length} dates in local historical data</Text>
            </View>
          )}
          {dateError ? <Text style={styles.error}>{dateError}</Text> : null}
          <Text style={styles.muted}>Selected: {date}. No data will be invented for dates outside the historical test set.</Text>
        </Panel>

        <View style={[styles.layout, { flexDirection: wide ? 'row' : 'column' }]}>
          <Panel style={{ flex: wide ? 1.65 : undefined }}>
            <Text style={styles.sectionLabel}>INTERACTIVE COASTAL MAP</Text>
            <View style={styles.spaceBetween}>
              <Text style={styles.panelTitle}>Sri Lanka · CHL productivity cells</Text>
              <Text style={styles.muted}>{cells.length} cells on {date}</Text>
            </View>
            <Text style={styles.muted}>Real OpenStreetMap geography · select any colored offshore cell for its prediction.</Text>
            <View style={styles.mapBox}>
              <CoastalMap cells={mapped} selectedKey={selectedKey} onSelect={setSelectedKey} />
            </View>
            <View style={styles.legend}>
              {(['All', 'Low', 'Medium', 'High'] as const).map(level => (
                <Btn key={level} title={`${level}${level === 'All' ? ` ${cells.length}` : ` ${stats[level]}`}`}
                  active={filter === level} onPress={() => setFilter(level)} />
              ))}
            </View>
            <View style={styles.legend}>
              {(['Low', 'Medium', 'High'] as const).map(level => (
                <View key={level} style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: categoryColor(level) }]} />
                  <Text style={styles.muted}>{level} productivity</Text>
                </View>
              ))}
            </View>
            {loading && <ActivityIndicator color={colors.teal} style={{ marginTop: 12 }} />}
            {apiError ? <Text style={styles.error}>{String(apiError)}</Text> : null}
            {!loading && !apiError && cells.length === 0 && (
              <Text style={styles.notice}>No historical CHL records for {date}. Use “Next available” or choose another date.</Text>
            )}
            <Text style={styles.mapNote}>Map tiles © OpenStreetMap contributors. Colored markers represent test records, not continuous ocean measurements.</Text>
          </Panel>

          <Panel style={{ flex: wide ? 1 : undefined }}>
            <Text style={styles.sectionLabel}>SELECTED COASTAL CELL</Text>
            <Text style={styles.panelTitle}>Chlorophyll-a prediction</Text>
            {selected ? (
              <>
                <Text style={styles.coordinate}>{selected.latitude.toFixed(4)}° N · {selected.longitude.toFixed(4)}° E</Text>
                <Text style={styles.bigValue}>{fmt(selected.predicted_chl_mg_m3)}</Text>
                <Text style={styles.unit}>mg/m³ predicted CHL-a</Text>
                <View style={[styles.classBox, { borderColor: categoryColor(selected.productivity_class) }]}>
                  <Text style={[styles.classText, { color: categoryColor(selected.productivity_class) }]}>
                    ●  {selected.productivity_class} productivity potential
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.detail}><Text style={styles.muted}>Observed CHL</Text><Text style={styles.detailValue}>{fmt(selected.actual_chl_mg_m3)} mg/m³</Text></View>
                <View style={styles.detail}><Text style={styles.muted}>Absolute error</Text><Text style={styles.detailValue}>{selected.actual_chl_mg_m3 == null ? '—' : fmt(Math.abs(selected.actual_chl_mg_m3 - selected.predicted_chl_mg_m3))} mg/m³</Text></View>
                <View style={styles.detail}><Text style={styles.muted}>Prediction type</Text><Text style={styles.detailValue}>Historical test</Text></View>
                <View style={styles.divider} />
                <Text style={styles.sectionLabel}>TRAINING-ONLY PRODUCTIVITY THRESHOLDS</Text>
                <View style={styles.bar}><View style={[styles.barPart, { backgroundColor: colors.low }]} /><View style={[styles.barPart, { backgroundColor: colors.medium }]} /><View style={[styles.barPart, { backgroundColor: colors.high }]} /></View>
                <Text style={styles.rule}>Low: below {P33.toFixed(4)} mg/m³</Text>
                <Text style={styles.rule}>Medium: {P33.toFixed(4)}–{P66.toFixed(4)} mg/m³</Text>
                <Text style={styles.rule}>High: above {P66.toFixed(4)} mg/m³</Text>
                <Text style={styles.muted}>This is CHL-based productivity potential, not a prediction of fish abundance.</Text>
              </>
            ) : (
              <Text style={styles.notice}>{loading ? 'Loading CHL records…' : 'Choose a cell from the map or list below.'}</Text>
            )}
          </Panel>
        </View>

        <View style={[styles.layout, { flexDirection: wide ? 'row' : 'column' }]}>
          <Panel style={{ flex: 1 }}>
            <Text style={styles.sectionLabel}>REGIONAL SNAPSHOT</Text>
            <Text style={styles.panelTitle}>Productivity distribution</Text>
            <Text style={styles.muted}>Counts represent the selected date and all available test cells.</Text>
            <View style={styles.statsRow}>
              {(['Low', 'Medium', 'High'] as const).map(category => (
                <View style={styles.stat} key={category}>
                  <View style={[styles.dot, { backgroundColor: categoryColor(category) }]} />
                  <Text style={styles.statValue}>{stats[category]}</Text>
                  <Text style={styles.muted}>{category}</Text>
                </View>
              ))}
            </View>
          </Panel>
          <Panel style={{ flex: 1 }}>
            <Text style={styles.sectionLabel}>NUTRIENT-INFORMED INPUTS</Text>
            <Text style={styles.panelTitle}>From Component 1 to Component 2</Text>
            <Text style={styles.muted}>NO₃ · PO₄ · Si will support future prediction workflows alongside SST, SSS and historical CHL. Live nutrient API integration is pending.</Text>
            <View style={styles.nutrientRow}>{['Nitrate (NO₃)', 'Phosphate (PO₄)', 'Silicate (Si)'].map(x => <Text key={x} style={styles.nutrient}>{x}</Text>)}</View>
          </Panel>
        </View>

        <Panel>
          <Text style={styles.sectionLabel}>EXPLORE AVAILABLE COASTAL CELLS</Text>
          <Text style={styles.panelTitle}>Select a historical grid coordinate</Text>
          <Text style={styles.muted}>Showing the first 36 matching cells for convenient navigation. The map includes all returned cells.</Text>
          <View style={styles.cellList}>
            {mapped.slice(0, 36).map(c => (
              <TouchableOpacity key={keyOf(c)} onPress={() => setSelectedKey(keyOf(c))}
                style={[styles.cellItem, selectedKey === keyOf(c) && styles.cellActive]}>
                <View style={[styles.dot, { backgroundColor: categoryColor(c.productivity_class) }]} />
                <Text style={styles.cellText}>{c.latitude.toFixed(3)}, {c.longitude.toFixed(3)}  ·  {fmt(c.predicted_chl_mg_m3)} mg/m³</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Panel>

        
        <Text style={styles.footer}>FishGuard AI · Component 2 · Historical prototype for PP1 · SHAP, operational future forecasting and 3D mapping are future work</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ocean },
  header: { backgroundColor: colors.navy, paddingHorizontal: 26, paddingVertical: 18, flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  brand: { color: '#FFFFFF', fontSize: 23, fontWeight: '800' },
  headerSubtitle: { color: '#B7D6DE', letterSpacing: 1.1, fontSize: 10, marginTop: 6 },
  headerChip: { backgroundColor: '#24465A', color: '#DDF6F4', borderRadius: 10, padding: 10, fontWeight: '700', fontSize: 12 },
  body: { width: '100%', maxWidth: 1420, alignSelf: 'center', gap: 16, padding: 20 },
  intro: { backgroundColor: '#103B52', borderRadius: 18, padding: 25 },
  kickerLight: { color: '#75E0CB', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', marginTop: 13, lineHeight: 38 },
  heroText: { color: '#D0E6EA', marginTop: 10, lineHeight: 22, fontSize: 14, maxWidth: 840 },
  heroTags: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 20 },
  heroPill: { backgroundColor: '#24596A', color: '#D8F5F2', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 30, fontSize: 12, overflow: 'hidden' },
  panel: { backgroundColor: '#FFFFFF', borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 20, minWidth: 0 },
  sectionLabel: { color: colors.teal, fontWeight: '800', letterSpacing: 1, fontSize: 10, marginBottom: 9 },
  panelTitle: { color: colors.navy, fontSize: 19, fontWeight: '800', lineHeight: 26 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 7 },
  controls: { marginTop: 14, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 9 },
  dateInput: { backgroundColor: '#F5F9FA', borderWidth: 1, borderColor: colors.border, borderRadius: 9, color: colors.navy, paddingVertical: 11, paddingHorizontal: 13, fontSize: 14, minWidth: 155 },
  button: { borderWidth: 1, borderColor: '#D7E4EA', backgroundColor: '#F9FCFD', borderRadius: 9, paddingVertical: 11, paddingHorizontal: 13 },
  buttonActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  buttonText: { color: colors.navy, fontSize: 12, fontWeight: '700' },
  error: { color: '#BA443D', marginTop: 12, fontWeight: '600', fontSize: 13 },
  layout: { gap: 16, alignItems: 'stretch' },
  spaceBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  mapBox: { backgroundColor: '#E4F1F5', borderRadius: 14, marginTop: 15, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  legend: { flexDirection: 'row', gap: 9, flexWrap: 'wrap', alignItems: 'center', marginTop: 13 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 11, height: 11, borderRadius: 8 },
  mapNote: { color: colors.muted, fontSize: 11, marginTop: 15, lineHeight: 18 },
  notice: { paddingVertical: 28, color: colors.muted, lineHeight: 23, fontSize: 14 },
  coordinate: { color: colors.muted, marginTop: 10, fontSize: 13 },
  bigValue: { color: colors.teal, fontSize: 49, fontWeight: '800', marginTop: 24 },
  unit: { color: colors.muted, fontSize: 15 },
  classBox: { padding: 15, borderWidth: 1.5, borderRadius: 12, marginTop: 20 },
  classText: { fontWeight: '800', fontSize: 18 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 22 },
  detail: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', paddingVertical: 7 },
  detailValue: { color: colors.navy, fontWeight: '700', fontSize: 13 },
  bar: { flexDirection: 'row', height: 9, gap: 3, marginTop: 15, marginBottom: 10 },
  barPart: { flex: 1, borderRadius: 5 },
  rule: { fontSize: 12, color: '#365468', marginBottom: 7 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 13, marginTop: 18 },
  stat: { flexGrow: 1, flexBasis: 130, backgroundColor: '#F5F9FA', borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16, gap: 4 },
  statValue: { fontSize: 26, color: colors.navy, fontWeight: '800', marginTop: 5 },
  nutrientRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 17 },
  nutrient: { backgroundColor: '#EAF6F5', color: '#127B78', fontWeight: '700', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 9, overflow: 'hidden' },
  cellList: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 15 },
  cellItem: { borderColor: colors.border, borderWidth: 1, padding: 11, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FBFDFE' },
  cellActive: { backgroundColor: '#D9F2EF', borderColor: colors.teal },
  cellText: { color: '#294B5F', fontSize: 12, fontWeight: '600' },
  footer: { textAlign: 'center', fontSize: 11, color: colors.muted, marginTop: 8, padding: 9 },
});
