import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useUserStore } from '../../store/userStore';
import { useFitnessStore } from '../../store/fitnessStore';
import { getColors } from '../../utils/theme';
import { format, subDays, startOfMonth, endOfMonth, getDay, getDaysInMonth } from 'date-fns';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_PADDED = SCREEN_WIDTH - 40;

type RangePreset = '7d' | '30d' | '90d' | 'custom';

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: 'custom', label: 'Custom' },
];

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const WORKOUT_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
const BAR_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1'];

export default function AnalyticsScreen() {
  const profile = useUserStore((state) => state.profile);
  const workouts = useUserStore((state) => state.workouts);
  const stepHistory = useFitnessStore((state) => state.stepHistory);
  const todaySteps = useFitnessStore((state) => state.todaySteps);
  const todayFloors = useFitnessStore((state) => state.todayFloors);
  const todayActiveMinutes = useFitnessStore((state) => state.todayActiveMinutes);

  const [rangePreset, setRangePreset] = useState<RangePreset>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const insets = useSafeAreaInsets();
  const darkMode = profile?.darkMode ?? false;
  const c = getColors(darkMode);
  const goal = profile?.dailyStepGoal || 10000;

  const { startDate, endDate, numDays } = useMemo(() => {
    const end = new Date();
    let start: Date;
    switch (rangePreset) {
      case '7d': start = subDays(end, 6); break;
      case '30d': start = subDays(end, 29); break;
      case '90d': start = subDays(end, 89); break;
      case 'custom':
        return {
          startDate: new Date(customStart || end),
          endDate: new Date(customEnd || end),
          numDays: 1,
        };
    }
    return { startDate: start, endDate: end, numDays: Math.round((end.getTime() - start.getTime()) / 86400000) + 1 };
  }, [rangePreset, customStart, customEnd]);

  const filteredHistory = useMemo(() => {
    const s = format(startDate, 'yyyy-MM-dd');
    const e = format(endDate, 'yyyy-MM-dd');
    return stepHistory.filter((d) => d.date >= s && d.date <= e).sort((a, b) => a.date.localeCompare(b.date));
  }, [stepHistory, startDate, endDate]);

  const totalSteps = filteredHistory.reduce((s, d) => s + d.steps, 0);
  const totalCalories = filteredHistory.reduce((s, d) => s + d.calories, 0);
  const totalDistance = filteredHistory.reduce((s, d) => s + d.distance, 0);
  const totalFloorsSum = filteredHistory.reduce((s, d) => s + d.floors, 0);
  const totalActiveMinSum = filteredHistory.reduce((s, d) => s + d.activeMinutes, 0);
  const avgSteps = numDays > 0 ? Math.round(totalSteps / numDays) : 0;
  const todayGoalPct = Math.min(todaySteps / goal, 1);

  const showEveryN = useMemo(() => {
    const len = filteredHistory.length;
    if (len <= 7) return 1;
    if (len <= 14) return 2;
    if (len <= 60) return 5;
    return 14;
  }, [filteredHistory.length]);

  const weekOverWeekData = useMemo(() => {
    const today = new Date();
    const thisWeek: number[] = [];
    const lastWeek: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = format(subDays(today, i), 'yyyy-MM-dd');
      const found = stepHistory.find((s) => s.date === d);
      thisWeek.push(found?.steps ?? 0);
    }
    for (let i = 13; i >= 7; i--) {
      const d = format(subDays(today, i), 'yyyy-MM-dd');
      const found = stepHistory.find((s) => s.date === d);
      lastWeek.push(found?.steps ?? 0);
    }
    return { thisWeek, lastWeek };
  }, [stepHistory]);

  const workoutTypes = useMemo(() => {
    const typeMap: Record<string, { count: number; totalDuration: number; totalCalories: number }> = {};
    const s = format(startDate, 'yyyy-MM-dd');
    const e = format(endDate, 'yyyy-MM-dd');
    workouts.filter((w) => w.date >= s && w.date <= e).forEach((w) => {
      if (!typeMap[w.type]) typeMap[w.type] = { count: 0, totalDuration: 0, totalCalories: 0 };
      typeMap[w.type].count++;
      typeMap[w.type].totalDuration += w.duration;
      typeMap[w.type].totalCalories += w.calories;
    });
    return Object.entries(typeMap).map(([name, data]) => ({ name, ...data }));
  }, [workouts, startDate, endDate]);

  const monthData = useMemo(() => {
    const today = new Date();
    const daysInMonth = getDaysInMonth(today);
    const firstDay = getDay(startOfMonth(today));
    const days: { steps: number; date: string; dayNum: number }[] = [];
    for (let i = 0; i < daysInMonth; i++) {
      const date = new Date(today.getFullYear(), today.getMonth(), i + 1);
      const dateStr = format(date, 'yyyy-MM-dd');
      const existing = stepHistory.find((d) => d.date === dateStr);
      days.push({ steps: existing?.steps ?? 0, date: dateStr, dayNum: i + 1 });
    }
    return { firstDay, days, monthName: format(today, 'MMMM yyyy') };
  }, [stepHistory]);

  const maxTrend = Math.max(...filteredHistory.map((d) => d.steps), 1);
  const maxLast7 = Math.max(...weekOverWeekData.lastWeek, 1);
  const maxThis7 = Math.max(...weekOverWeekData.thisWeek, 1);
  const wowMax = Math.max(maxLast7, maxThis7, 1);

  if (!profile) return null;

  const goalRingSize = Math.min(CHART_PADDED * 0.4, 140);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ height: insets.top }} />
      <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.text }]}>Analytics</Text>
          <Text style={[styles.subtitle, { color: c.textTertiary }]}>Deep dive into your activity</Text>
        </View>

        {/* ── Date Range ── */}
        <View style={styles.section}>
          <View style={styles.presetsRow}>
            {PRESETS.map((p) => {
              const active = rangePreset === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.presetChip, { backgroundColor: active ? c.text : c.surface }]}
                  onPress={() => setRangePreset(p.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.presetChipText, { color: active ? c.background : c.text }]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {rangePreset === 'custom' && (
            <View style={styles.customDateRow}>
              <TextInput
                style={[styles.dateInput, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
                value={customStart}
                onChangeText={setCustomStart}
                placeholder="2026-01-01"
                placeholderTextColor={c.textTertiary}
              />
              <Text style={[styles.dateSep, { color: c.textTertiary }]}>→</Text>
              <TextInput
                style={[styles.dateInput, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
                value={customEnd}
                onChangeText={setCustomEnd}
                placeholder="2026-05-25"
                placeholderTextColor={c.textTertiary}
              />
            </View>
          )}
          <View style={[styles.statsBar, { backgroundColor: c.surface }]}>
            {[
              { label: 'Steps', value: totalSteps.toLocaleString() },
              { label: 'Avg', value: avgSteps.toLocaleString() },
              { label: 'Cal', value: totalCalories.toLocaleString() },
              { label: profile.useMetric ? 'km' : 'mi', value: totalDistance.toFixed(1) },
            ].map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <View style={[styles.statDiv, { backgroundColor: c.border }]} />}
                <View style={styles.statItem}>
                  <Text style={[styles.statNum, { color: c.text }]}>{s.value}</Text>
                  <Text style={[styles.statLbl, { color: c.textTertiary }]}>{s.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* ── Goal Progress ── */}
        <View style={styles.section}>
          <Text style={[styles.secTitle, { color: c.text }]}>Goal Progress</Text>
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            <View style={styles.goalWrap}>
              <View style={[styles.goalRingOuter, { width: goalRingSize * 1.6, height: goalRingSize * 1.6, borderRadius: goalRingSize * 0.8 }]}>
                <View style={[styles.goalRingBorder, {
                  width: goalRingSize * 1.6, height: goalRingSize * 1.6, borderRadius: goalRingSize * 0.8,
                  borderWidth: goalRingSize * 0.12,
                  borderColor: todayGoalPct >= 1 ? c.success : c.text,
                  opacity: todayGoalPct,
                }]} />
                <View style={styles.goalInner}>
                  <Text style={[styles.goalPct, { color: todayGoalPct >= 1 ? c.success : c.text }]}>
                    {Math.round(todayGoalPct * 100)}%
                  </Text>
                  <Text style={[styles.goalSub, { color: c.textTertiary }]}>
                    {todaySteps.toLocaleString()} / {goal.toLocaleString()}
                  </Text>
                </View>
              </View>
              <Text style={[styles.goalToday, { color: c.textSecondary }]}>{format(new Date(), 'EEEE, MMMM d')}</Text>
            </View>
            <View style={[styles.goalStatsRow, { borderTopColor: c.border }]}>
              {[
                { icon: 'stairs' as const, value: todayFloors, label: 'Floors' },
                { icon: 'timer' as const, value: todayActiveMinutes, label: 'Active Min' },
                { icon: 'local-fire-department' as const, value: totalCalories, label: 'Calories' },
              ].map((s) => (
                <View key={s.label} style={styles.goalStat}>
                  <MaterialIcons name={s.icon} size={20} color={c.textTertiary} />
                  <Text style={[styles.goalStatVal, { color: c.text }]}>{s.value}</Text>
                  <Text style={[styles.goalStatLbl, { color: c.textTertiary }]}>{s.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Step Trends ── */}
        {filteredHistory.length > 1 && (
          <View style={styles.section}>
            <Text style={[styles.secTitle, { color: c.text }]}>Step Trends</Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <View style={styles.barChart}>
                {filteredHistory.map((d, i) => {
                  const barH = Math.max((d.steps / maxTrend) * 140, 2);
                  const showLabel = i % showEveryN === 0 || i === filteredHistory.length - 1;
                  return (
                    <View key={d.date} style={styles.barCol}>
                      <View style={[styles.bar, { height: barH, backgroundColor: d.steps >= goal ? c.success : c.text }]} />
                      {showLabel && <Text style={[styles.barLbl, { color: c.textTertiary }]}>{format(new Date(d.date), 'd/M')}</Text>}
                    </View>
                  );
                })}
              </View>
              <View style={[styles.footer, { borderTopColor: c.border }]}>
                <Text style={[styles.footerText, { color: c.textTertiary }]}>Avg: {avgSteps.toLocaleString()} / day</Text>
                <Text style={[styles.footerText, { color: c.textTertiary }]}>Peak: {maxTrend.toLocaleString()}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Activity Breakdown ── */}
        <View style={styles.section}>
          <Text style={[styles.secTitle, { color: c.text }]}>Activity Breakdown</Text>
          <View style={styles.breakdownRow}>
            {[
              { label: 'Steps', value: todaySteps.toLocaleString(), pct: todayGoalPct, goal: goal.toLocaleString() },
              { label: 'Floors', value: todayFloors.toString(), pct: Math.min(todayFloors / 10, 1), goal: '10' },
              { label: 'Active Min', value: todayActiveMinutes.toString(), pct: Math.min(todayActiveMinutes / 60, 1), goal: '60' },
            ].map((item, i) => (
              <View key={item.label} style={[styles.breakdownCard, { backgroundColor: c.surface }]}>
                <View style={[styles.breakdownRing, {
                  width: 72, height: 72, borderRadius: 36,
                  borderWidth: 6,
                  borderColor: c.border,
                }]}>
                  <View style={[styles.breakdownRingFill, {
                    width: 72, height: 72, borderRadius: 36,
                    borderWidth: 6,
                    borderColor: BAR_COLORS[i],
                    opacity: item.pct,
                  }]} />
                  <Text style={[styles.breakdownPct, { color: c.text }]}>{Math.round(item.pct * 100)}%</Text>
                </View>
                <Text style={[styles.breakdownVal, { color: c.text }]}>{item.value}</Text>
                <Text style={[styles.breakdownLbl, { color: c.textTertiary }]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Week Over Week ── */}
        <View style={styles.section}>
          <Text style={[styles.secTitle, { color: c.text }]}>Week Over Week</Text>
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            <View style={styles.wowLegend}>
              <View style={styles.wowLegendItem}>
                <View style={[styles.wowDot, { backgroundColor: c.text }]} />
                <Text style={[styles.wowLbl, { color: c.textTertiary }]}>This Week</Text>
              </View>
              <View style={styles.wowLegendItem}>
                <View style={[styles.wowDot, { backgroundColor: c.textTertiary, opacity: 0.4 }]} />
                <Text style={[styles.wowLbl, { color: c.textTertiary }]}>Last Week</Text>
              </View>
            </View>
            <View style={styles.wowChart}>
              <View style={styles.wowBarsArea}>
                {DAYS_SHORT.map((day, i) => {
                  const h1 = Math.max((weekOverWeekData.thisWeek[i] / wowMax) * 80, 2);
                  const h2 = Math.max((weekOverWeekData.lastWeek[i] / wowMax) * 80, 2);
                  return (
                    <View key={day} style={styles.wowCol}>
                      <View style={styles.wowBarPair}>
                        <View style={[styles.wowBar, { height: h1, backgroundColor: c.text, width: '40%' }]} />
                        <View style={[styles.wowBar, { height: h2, backgroundColor: c.textTertiary, width: '40%', opacity: 0.4 }]} />
                      </View>
                      <Text style={[styles.wowDayLbl, { color: c.textTertiary }]}>{day[0]}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
            <View style={[styles.footer, { borderTopColor: c.border }]}>
              <Text style={[styles.footerText, { color: c.textTertiary }]}>
                This: {weekOverWeekData.thisWeek.reduce((s, v) => s + v, 0).toLocaleString()}
              </Text>
              <Text style={[styles.footerText, { color: c.textTertiary }]}>
                Last: {weekOverWeekData.lastWeek.reduce((s, v) => s + v, 0).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Workout Distribution ── */}
        {workoutTypes.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.secTitle, { color: c.text }]}>Workout Distribution</Text>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <View style={styles.pieList}>
                {workoutTypes.map((wt, i) => {
                  const pct = Math.round((wt.totalDuration / Math.max(...workoutTypes.map((w) => w.totalDuration), 1)) * 100);
                  return (
                    <View key={wt.name} style={[styles.pieRow, { borderBottomColor: c.border }]}>
                      <View style={[styles.pieDot, { backgroundColor: WORKOUT_COLORS[i % WORKOUT_COLORS.length] }]} />
                      <Text style={[styles.pieName, { color: c.text }]}>{wt.name}</Text>
                      <View style={styles.pieBarWrap}>
                        <View style={[styles.pieBar, { width: `${pct}%`, backgroundColor: WORKOUT_COLORS[i % WORKOUT_COLORS.length] }]} />
                      </View>
                      <Text style={[styles.pieCount, { color: c.textTertiary }]}>{wt.count}x</Text>
                      <Text style={[styles.pieDur, { color: c.textSecondary }]}>{wt.totalDuration}min</Text>
                    </View>
                  );
                })}
              </View>
              <View style={[styles.footer, { borderTopColor: c.border }]}>
                <Text style={[styles.footerText, { color: c.textTertiary }]}>
                  {workoutTypes.reduce((s, t) => s + t.count, 0)} total workouts
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Activity Calendar ── */}
        <View style={styles.section}>
          <Text style={[styles.secTitle, { color: c.text }]}>Activity Calendar</Text>
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            <Text style={[styles.calMonth, { color: c.textTertiary }]}>{monthData.monthName}</Text>
            <View style={styles.calGrid}>
              {DAYS_SHORT.map((d) => (
                <Text key={d} style={[styles.calDayHdr, { color: c.textTertiary }]}>{d[0]}</Text>
              ))}
              {Array.from({ length: monthData.firstDay }).map((_, i) => (
                <View key={`e-${i}`} style={styles.calCell} />
              ))}
              {monthData.days.map((day) => {
                const int = day.steps > 0 ? Math.min(day.steps / goal, 1) : 0;
                const alpha = int > 0 ? 0.15 + int * 0.85 : 0.04;
                const isToday = day.date === format(new Date(), 'yyyy-MM-dd');
                return (
                  <TouchableOpacity
                    key={day.date}
                    style={[
                      styles.calCell,
                      { backgroundColor: `rgba(${darkMode ? 255 : 0},${darkMode ? 255 : 0},${darkMode ? 255 : 0},${alpha})` },
                      isToday && { borderWidth: 1, borderColor: c.text },
                    ]}
                    activeOpacity={0.6}
                  >
                    <Text style={[styles.calDayNum, { color: day.steps === 0 ? c.textTertiary : alpha > 0.5 ? c.background : c.text }]}>
                      {day.dayNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
              <View style={styles.calLegend}>
                <Text style={[styles.calLegText, { color: c.textTertiary }]}>Less</Text>
                {[0.08, 0.3, 0.5, 0.75, 1].map((v) => {
                  const base = darkMode ? 255 : 0;
                  return (
                    <View key={v} style={[styles.calLegBox, { backgroundColor: `rgba(${base},${base},${base},${v})` }]} />
                  );
                })}
                <Text style={[styles.calLegText, { color: c.textTertiary }]}>More</Text>
              </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold' },
  subtitle: { fontSize: 16, marginTop: 4 },
  section: { marginBottom: 24 },
  secTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  card: { borderRadius: 16, padding: 20, elevation: 2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, marginTop: 12, borderTopWidth: 1 },
  footerText: { fontSize: 12 },

  presetsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  presetChip: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  presetChipText: { fontSize: 14, fontWeight: '600' },
  customDateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  dateInput: { flex: 1, borderRadius: 10, padding: 12, fontSize: 14, borderWidth: 1 },
  dateSep: { fontSize: 16, fontWeight: '600' },

  statsBar: { borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statDiv: { width: 1, height: 30 },
  statNum: { fontSize: 18, fontWeight: '700' },
  statLbl: { fontSize: 11, marginTop: 2 },

  goalWrap: { alignItems: 'center', paddingVertical: 10 },
  goalRingOuter: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  goalRingBorder: { position: 'absolute', borderWidth: 0 },
  goalInner: { alignItems: 'center' },
  goalPct: { fontSize: 36, fontWeight: '700' },
  goalSub: { fontSize: 13, marginTop: 4 },
  goalToday: { fontSize: 13, marginTop: 16 },
  goalStatsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20, paddingTop: 16, borderTopWidth: 1 },
  goalStat: { alignItems: 'center' },
  goalStatVal: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  goalStatLbl: { fontSize: 11, marginTop: 2 },

  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 160, gap: 2 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 160 },
  bar: { width: '100%', borderRadius: 3, minHeight: 2 },
  barLbl: { fontSize: 8, marginTop: 4, transform: [{ rotate: '-45deg' }], width: 24, textAlign: 'center' },

  breakdownRow: { flexDirection: 'row', gap: 12 },
  breakdownCard: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', elevation: 2 },
  breakdownRing: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  breakdownRingFill: { position: 'absolute', borderWidth: 0 },
  breakdownPct: { fontSize: 14, fontWeight: '700' },
  breakdownVal: { fontSize: 15, fontWeight: '600', marginTop: 8 },
  breakdownLbl: { fontSize: 11, marginTop: 2 },

  wowLegend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 16 },
  wowLegendItem: { flexDirection: 'row', alignItems: 'center' },
  wowDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  wowLbl: { fontSize: 12 },
  wowChart: { height: 120, justifyContent: 'flex-end' },
  wowBarsArea: { flexDirection: 'row', height: 100, alignItems: 'flex-end' },
  wowCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 100 },
  wowBarPair: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 80 },
  wowBar: { borderRadius: 3, minHeight: 2 },
  wowDayLbl: { fontSize: 10, marginTop: 4 },

  pieList: { gap: 0 },
  pieRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  pieDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  pieName: { fontSize: 14, fontWeight: '500', width: 80 },
  pieBarWrap: { flex: 1, height: 8, borderRadius: 4, marginHorizontal: 8, backgroundColor: 'rgba(128,128,128,0.15)', overflow: 'hidden' },
  pieBar: { height: 8, borderRadius: 4 },
  pieCount: { fontSize: 12, fontWeight: '600', width: 28, textAlign: 'right' },
  pieDur: { fontSize: 12, width: 50, textAlign: 'right' },

  calMonth: { fontSize: 14, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDayHdr: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontWeight: '600', marginBottom: 4 },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 4, padding: 1 },
  calDayNum: { fontSize: 10, fontWeight: '600', textAlign: 'center', lineHeight: 12 },
  calLegend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 12 },
  calLegBox: { width: 14, height: 14, borderRadius: 3 },
  calLegText: { fontSize: 10, marginHorizontal: 4 },
});
