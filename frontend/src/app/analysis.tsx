import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Line, Polyline, Text as SvgText } from 'react-native-svg';
import api from '../services/api';

type EnvKey = 'sst' | 'sss' | 'nitrate' | 'phosphate' | 'silicate';
type RecordItem = {
  date: string;
  predicted_chl_mg_m3: number;
  actual_chl_mg_m3: number | null;
  absolute_error_mg_m3: number | null;
  productivity_class: 'Low' | 'Medium' | 'High';
  environment: Record<EnvKey, number | null>;
};
type AnalysisResponse = {
  latitude: number; longitude: number; until_date: string;
  environment_units: 'standardized_model_features';
  count: number; records: RecordItem[];
};
const COLORS = { navy: '#102A43', teal: '#087F83', muted: '#687E8D', border: '#DFE8ED', background: '#EDF5F8', actual: '#117B92', predicted: '#DC9850', env: '#8671CB' };
const VARIABLES: {key: EnvKey; label: string}[] = [
  { key: 'sst', label: 'Sea surface temperature (SST)' },
  { key: 'sss', label: 'Sea surface salinity (SSS)' },
  { key: 'nitrate', label: 'Nitrate (NO₃)' },
  { key: 'phosphate', label: 'Phosphate (PO₄)' },
  { key: 'silicate', label: 'Silicate (Si)' },
];
function Panel({ children }: {children: React.ReactNode}) {
  return <View style={styles.panel}>{children}</View>;
}
function ChartLegend({ items }: {items: {name: string; color: string}[]}) {
  return <View style={styles.legend}>{items.map(item => <View key={item.name} style={styles.legendItem}>
    <View style={{width: 12, height: 4, backgroundColor: item.color, borderRadius: 2}}/>
    <Text style={styles.muted}>{item.name}</Text>
  </View>)}</View>;
}
// SVG visualizations are display-only: no responder event handlers on SVG elements.
function TimeChart({ records, keys, height = 240 }: {
  records: RecordItem[];
  keys: {key: string; color: string; label: string; value: (r: RecordItem) => number | null}[];
  height?: number;
}) {
  const W = 720, H = height, left = 54, right = 14, top = 18, bottom = 42;
  const all = keys.flatMap(s => records.map(s.value)).filter((v): v is number => v != null && Number.isFinite(v));
  if (records.length < 2 || !all.length) return <Text style={styles.muted}>Not enough historical records to draw a trend.</Text>;
  const rawMin = Math.min(...all), rawMax = Math.max(...all);
  const gap = Math.max((rawMax - rawMin) * 0.08, .03);
  const yMin = rawMin - gap, yMax = rawMax + gap;
  const x = (i: number) => left + i / (records.length - 1) * (W - left - right);
  const y = (value: number) => top + (yMax - value) / (yMax - yMin) * (H - top - bottom);
  const lineRuns = (fn: (r: RecordItem) => number | null) => {
    const runs: string[] = []; let current: string[] = [];
    records.forEach((rec, i) => {
      const v = fn(rec);
      if (v == null || !Number.isFinite(v)) { if (current.length >= 2) runs.push(current.join(' ')); current = []; }
      else current.push(`${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    });
    if (current.length >= 2) runs.push(current.join(' '));
    return runs;
  };
  const ticks = [0,1,2,3,4];
  return <View>
    <Svg width="100%" height={height} viewBox={`0 0 ${W} ${H}`}>
      {ticks.map(t => {
        const value = yMin + (yMax - yMin) * (1 - t/4);
        const pos = top + t/4 * (H-top-bottom);
        return <React.Fragment key={t}>
          <Line x1={left} y1={pos} x2={W-right} y2={pos} stroke="#E4ECF0" strokeWidth={1}/>
          <SvgText x={left-7} y={pos+4} fill={COLORS.muted} fontSize="11" textAnchor="end">{value.toFixed(2)}</SvgText>
        </React.Fragment>;
      })}
      {keys.flatMap(s => lineRuns(s.value).map((points, j) => <Polyline
        key={`${s.key}-${j}`} points={points} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />))}
      {[0, Math.floor((records.length-1)/2), records.length-1].map((i, j) => <SvgText
        key={`${j}-${i}`} x={x(i)} y={H-14} textAnchor={j===0?'start':j===2?'end':'middle'} fontSize="11" fill={COLORS.muted}>{records[i].date.slice(5)}</SvgText>)}
    </Svg>
    <ChartLegend items={keys.map(s => ({name:s.label, color:s.color}))}/>
  </View>;
}

export default function AnalysisScreen() {
  const router = useRouter();
  const { latitude, longitude, date } = useLocalSearchParams<{ latitude?: string; longitude?: string; date?: string }>();
  const lat = Number(latitude), lon = Number(longitude);
  const valid = !!latitude && !!longitude && Number.isFinite(lat) && Number.isFinite(lon);
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const {width} = useWindowDimensions();
  const isWide = width >= 940;
  useEffect(() => {
    if (!valid) { setError('Select a coastal grid cell on the map first.'); setLoading(false); return; }
    let cancelled = false;
    setLoading(true); setError('');
    api.get<AnalysisResponse>('/api/forecast/analysis', {
      params: { date: date || '2021-10-05', latitude: lat, longitude: lon, days: 90 },
    }).then(r => { if (!cancelled) setData(r.data); })
      .catch(e => { if (!cancelled) setError(e?.response?.data?.detail || 'Could not load analysis data. Check the backend.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [latitude, longitude, date]);
  const records = data?.records ?? [];
  const metrics = useMemo(() => {
    const errors = records.map(r => r.absolute_error_mg_m3).filter((x): x is number => x != null);
    return {mae: errors.length ? errors.reduce((a,b)=>a+b,0)/errors.length : null, max: errors.length ? Math.max(...errors) : null};
  }, [data]);
  return <ScrollView style={styles.screen} contentContainerStyle={{paddingBottom:35}}>
    <Stack.Screen options={{headerShown:false}}/>
    <View style={styles.header}>
      <View><Text style={styles.brand}>◈ FishGuard AI</Text>
        <Text style={styles.headerSubtitle}>COMPONENT 2 / CHL RESEARCH ANALYSIS</Text></View>
      <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={styles.backButton}><Text style={styles.backText}>← Back to coastal map</Text></TouchableOpacity>
    </View>
    <View style={styles.body}>
      <Panel>
        <Text style={styles.kicker}>HISTORICAL RESEARCH ANALYSIS</Text>
        <Text style={styles.title}>Understanding CHL trends and environmental relationships</Text>
        <Text style={styles.muted}>Selected location: {valid ? `${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E` : 'Not selected'} · Up to {date || '2021-10-05'} · Available historical test records only</Text>
        <Text style={styles.notice}>These charts use retrospective test results, not operational next-day forecasts. Environmental relationships are associations, not causal explanations or SHAP attributions.</Text>
      </Panel>
      {loading ? <Panel><ActivityIndicator color={COLORS.teal}/><Text style={styles.muted}>Loading historical analysis...</Text></Panel>
      : error ? <Panel><Text style={styles.error}>{error}</Text></Panel>
      : !records.length ? <Panel><Text style={styles.muted}>No historical test records exist for this location on or before the selected date.</Text></Panel>
      : <>
        <View style={[styles.cards, {flexDirection: isWide ? 'row' : 'column'}]}>
          <Panel><Text style={styles.kicker}>SAMPLES</Text><Text style={styles.metric}>{records.length}</Text><Text style={styles.muted}>Historical test dates</Text></Panel>
          <Panel><Text style={styles.kicker}>LOCATION MAE</Text><Text style={styles.metric}>{metrics.mae == null?'—':metrics.mae.toFixed(3)}</Text><Text style={styles.muted}>mg/m³ · displayed records only</Text></Panel>
          <Panel><Text style={styles.kicker}>LARGEST ABSOLUTE ERROR</Text><Text style={styles.metric}>{metrics.max == null?'—':metrics.max.toFixed(3)}</Text><Text style={styles.muted}>mg/m³ · displayed records only</Text></Panel>
        </View>
        <Panel>
          <Text style={styles.kicker}>CHLOROPHYLL-A TREND</Text>
          <Text style={styles.panelTitle}>Actual versus predicted CHL</Text>
          <Text style={styles.muted}>Compare observed CHL with fine-tuned XGBoost predictions across available dates. Vertical axis: mg/m³.</Text>
          <TimeChart records={records} keys={[
            {key:'actual',label:'Actual CHL',color:COLORS.actual,value:r=>r.actual_chl_mg_m3},
            {key:'predicted',label:'Predicted CHL',color:COLORS.predicted,value:r=>r.predicted_chl_mg_m3},
          ]}/>
        </Panel>
        <Panel><Text style={styles.kicker}>MODEL ERROR</Text><Text style={styles.panelTitle}>Absolute prediction error over time</Text>
          <Text style={styles.muted}>Highlights dates when predicted CHL differs more from observed CHL. Vertical axis: mg/m³.</Text>
          <TimeChart records={records} keys={[{key:'error',label:'Absolute error',color:'#C25D74',value:r=>r.absolute_error_mg_m3}]}/>
        </Panel>
        <Panel><Text style={styles.kicker}>ENVIRONMENTAL RELATIONSHIPS</Text>
          <Text style={styles.panelTitle}>Environmental conditions alongside CHL</Text>
          <Text style={styles.notice}>SST, SSS and nutrient values below are standardized model inputs (z-scores), not °C, PSU or mmol/m³. The paired lines use separate conceptual quantities; compare their timing and patterns, NOT the numerical heights as if they shared units.</Text>
          <Text style={styles.muted}>Actual CHL is displayed in mg/m³. To facilitate visual comparison, both series on each chart are independently normalized to their own 0–1 range within the displayed period.</Text>
        </Panel>
        <View style={styles.variableGrid}>
          {VARIABLES.map(v => {
            const validPair = records.filter(r => r.actual_chl_mg_m3 != null && r.environment?.[v.key] != null);
            const xs = validPair.map(r=>r.environment[v.key] as number);
            const ys = validPair.map(r=>r.actual_chl_mg_m3 as number);
            const scale = (value:number|null, min:number, max:number) => value == null ? null : max===min ? .5 : (value-min)/(max-min);
            const xmin=Math.min(...xs), xmax=Math.max(...xs), ymin=Math.min(...ys), ymax=Math.max(...ys);
            const mappedRecords = records.map(r=>({ ...r,
              normalizedEnv: xs.length ? scale(r.environment?.[v.key] ?? null, xmin, xmax) : null,
              normalizedCHL: ys.length ? scale(r.actual_chl_mg_m3, ymin, ymax) : null,
            }));
            return <Panel key={v.key}>
              <Text style={styles.kicker}>ENVIRONMENT / {v.key.toUpperCase()}</Text>
              <Text style={styles.panelTitle}>{v.label} and actual CHL</Text>
              <Text style={styles.muted}>{validPair.length} paired dates · normalized trends for visual comparison</Text>
              {validPair.length >= 2 ? <TimeChart records={mappedRecords as RecordItem[]} height={205} keys={[
                {key:'env',label:`${v.key.toUpperCase()} (scaled trend)`,color:COLORS.env,value:r=>(r as RecordItem & {normalizedEnv:number|null}).normalizedEnv},
                {key:'chl',label:'Actual CHL (scaled trend)',color:COLORS.actual,value:r=>(r as RecordItem & {normalizedCHL:number|null}).normalizedCHL},
              ]}/> : <Text style={styles.muted}>No matched environmental values for this cell in the prepared test dataset.</Text>}
            </Panel>;
          })}
        </View>
      </>}
      <Text style={styles.footer}>FishGuard AI · PP1 historical CHL analysis · Model explanations with SHAP remain future work</Text>
    </View>
  </ScrollView>;
}
const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:COLORS.background},
  header:{backgroundColor:COLORS.navy,paddingHorizontal:26,paddingVertical:18,flexDirection:'row',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12},
  brand:{color:'#FFFFFF',fontSize:23,fontWeight:'800'},headerSubtitle:{color:'#B7D6DE',letterSpacing:1.1,fontSize:10,marginTop:6},
  backButton:{backgroundColor:'#24465A',padding:12,borderRadius:9},backText:{color:'#FFFFFF',fontWeight:'700'},
  body:{width:'100%',maxWidth:1420,alignSelf:'center',gap:16,padding:20},
  panel:{flex:1,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:COLORS.border,borderRadius:16,padding:20,minWidth:0},
  kicker:{color:COLORS.teal,fontSize:11,fontWeight:'800',letterSpacing:.8,marginBottom:9},
  title:{fontSize:26,fontWeight:'800',color:COLORS.navy,marginBottom:8},panelTitle:{fontSize:19,fontWeight:'800',color:COLORS.navy},
  muted:{color:COLORS.muted,fontSize:12,lineHeight:19,marginTop:7},notice:{color:'#40687A',fontSize:12,lineHeight:20,marginTop:12,backgroundColor:'#EDF6F8',padding:12,borderRadius:9},
  error:{color:'#BA443D',fontSize:14,fontWeight:'700'},cards:{gap:16},metric:{color:COLORS.navy,fontSize:29,fontWeight:'800',marginTop:6},
  legend:{flexDirection:'row',flexWrap:'wrap',gap:18,marginTop:4,justifyContent:'center'},legendItem:{flexDirection:'row',alignItems:'center',gap:7},variableGrid:{gap:16},footer:{textAlign:'center',fontSize:11,color:COLORS.muted,padding:9},
});
