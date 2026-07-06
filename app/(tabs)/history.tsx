import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useUserStore } from '../../store/userStore';
import { useFitnessStore, DailySteps } from '../../store/fitnessStore';
import { calculateCalories } from '../../utils/calculations';
import { getColors } from '../../utils/theme';
import { format, getDay, startOfMonth, endOfMonth, subDays, startOfYear } from 'date-fns';

type ViewMode = 'week' | 'month' | 'year';

export default function HistoryScreen() {
  const profile = useUserStore((state) => state.profile);
  const workouts = useUserStore((state) => state.workouts);
  const stepHistory = useFitnessStore((state) => state.stepHistory);
  const getWeekHistory = useFitnessStore((state) => state.getWeekHistory);
  const getMonthHistory = useFitnessStore((state) => state.getMonthHistory);
  const getYearHistory = useFitnessStore((state) => state.getYearHistory);
  const stepStreak = useUserStore((state) => state.stepStreak);

  const [viewMode, setViewMode] = useState<ViewMode>('week');

  const insets = useSafeAreaInsets();
  const darkMode = profile?.darkMode ?? false;
  const c = getColors(darkMode);

  const goal = profile?.dailyStepGoal || 10000;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const distanceUnit = profile?.useMetric ? 'km' : 'mi';
  const today = format(new Date(), 'yyyy-MM-dd');

  const renderWeekView = () => {
    const weekData = getWeekHistory();
    const maxSteps = Math.max(...weekData.map((d) => d.steps), 1);
    const totalSteps = weekData.reduce((sum, d) => sum + d.steps, 0);
    const totalFloors = weekData.reduce((sum, d) => sum + d.floors, 0);
    const totalActiveMinutes = weekData.reduce((sum, d) => sum + d.activeMinutes, 0);
    const totalDistance = weekData.reduce((sum, d) => sum + d.distance, 0);
    const avgSteps = Math.round(totalSteps / 7);
    const daysGoalMet = weekData.filter((d) => d.steps >= goal).length;
    const calories = profile ? calculateCalories(totalSteps, profile.weight, profile.useMetric) : 0;
    const goalPercent = Math.round((avgSteps / goal) * 100);

    const prevWeekData: DailySteps[] = [];
    for (let i = 13; i >= 7; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const existing = stepHistory.find((d) => d.date === dateStr);
      prevWeekData.push(existing || { date: dateStr, steps: 0, floors: 0, activeMinutes: 0, calories: 0, distance: 0 });
    }
    const prevTotalSteps = prevWeekData.reduce((sum, d) => sum + d.steps, 0);
    const stepDelta = totalSteps - prevTotalSteps;
    const stepDeltaPct = prevTotalSteps > 0 ? Math.round((stepDelta / prevTotalSteps) * 100) : 0;

    return (
      <>
        <View style={[styles.chartContainer, { backgroundColor: c.surface }]}>
          <Text style={[styles.chartTitle, { color: c.text }]}>This Week</Text>
          <View style={styles.chart}>
            {weekData.map((day) => {
              const height = (day.steps / maxSteps) * 150;
              const dayName = days[getDay(new Date(day.date))];
              const reachedGoal = day.steps >= goal;
              return (
                <View key={day.date} style={styles.barContainer}>
                  <View style={styles.barWrapper}>
                    <View style={[styles.bar, { height: Math.max(height, 4), backgroundColor: reachedGoal ? c.success : c.accent }]} />
                  </View>
                  <Text style={[styles.barLabel, { color: c.textTertiary }]}>{dayName}</Text>
                </View>
              );
            })}
          </View>
          <View style={[styles.goalLine, { borderTopColor: c.border }]}>
            <View style={[styles.goalLineIndicator, { backgroundColor: c.success }]} />
            <Text style={[styles.goalLineText, { color: c.textTertiary }]}>Goal: {goal.toLocaleString()}</Text>
          </View>
        </View>

        <View style={[styles.summaryContainer, { backgroundColor: c.surface }]}>
          <Text style={[styles.summaryTitle, { color: c.text }]}>Weekly Summary</Text>
          {[
            { label: 'Total Steps', value: totalSteps.toLocaleString(), color: c.accent },
            { label: 'Goal', value: `${goalPercent}%`, color: goalPercent >= 100 ? c.success : c.text },
            { label: 'Calories', value: `${calories.toLocaleString()} kcal`, color: c.calories },
            { label: 'Distance', value: `${totalDistance.toFixed(2)} ${distanceUnit}`, color: c.distance },
            { label: 'Total Floors', value: totalFloors.toString(), color: c.floors },
            { label: 'Active Minutes', value: totalActiveMinutes.toString(), color: c.activeMinutes },
            { label: 'Daily Average', value: avgSteps.toLocaleString(), color: c.text },
            { label: 'Days Goal Met', value: `${daysGoalMet}/7`, color: daysGoalMet >= 5 ? c.success : c.warning },
            { label: 'vs. Last Week', value: `${stepDelta >= 0 ? '+' : ''}${stepDelta.toLocaleString()} (${stepDeltaPct >= 0 ? '+' : ''}${stepDeltaPct}%)`, color: stepDelta >= 0 ? c.success : c.error },
          ].map((row) => (
            <View key={row.label} style={[styles.summaryRow, { borderBottomColor: c.border }]}>
              <Text style={[styles.summaryLabel, { color: c.textTertiary }]}>{row.label}</Text>
              <Text style={[styles.summaryValue, { color: row.color }]}>{row.value}</Text>
            </View>
          ))}
        </View>
      </>
    );
  };

  const renderMonthView = () => {
    const monthData = getMonthHistory();
    const maxSteps = Math.max(...monthData.map((d) => d.steps), 1);
    const today = new Date();
    const daysInMonth = endOfMonth(today).getDate();
    const firstDay = startOfMonth(today).getDay();

    const totalSteps = monthData.reduce((sum, d) => sum + d.steps, 0);
    const totalFloors = monthData.reduce((sum, d) => sum + d.floors, 0);
    const totalActiveMinutes = monthData.reduce((sum, d) => sum + d.activeMinutes, 0);
    const totalDistance = monthData.reduce((sum, d) => sum + d.distance, 0);
    const avgSteps = Math.round(totalSteps / daysInMonth);
    const daysGoalMet = monthData.filter((d) => d.steps >= goal).length;
    const calories = profile ? calculateCalories(totalSteps, profile.weight, profile.useMetric) : 0;
    const goalPercent = Math.round((avgSteps / goal) * 100);

    const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonthStart = startOfMonth(prevMonthDate);
    const prevMonthEnd = endOfMonth(prevMonthDate);
    let prevTotalSteps = 0;
    for (let i = 0; i < prevMonthEnd.getDate(); i++) {
      const date = new Date(prevMonthStart);
      date.setDate(date.getDate() + i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const existing = stepHistory.find((d) => d.date === dateStr);
      if (existing) prevTotalSteps += existing.steps;
    }
    const stepDelta = totalSteps - prevTotalSteps;
    const stepDeltaPct = prevTotalSteps > 0 ? Math.round((stepDelta / prevTotalSteps) * 100) : 0;

    return (
      <>
        <View style={[styles.chartContainer, { backgroundColor: c.surface }]}>
          <Text style={[styles.chartTitle, { color: c.text }]}>{format(today, 'MMMM yyyy')}</Text>
          <View style={styles.calendarGrid}>
            {Array.from({ length: firstDay }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.calendarCell} />
            ))}
            {monthData.map((day) => {
              const reachedGoal = day.steps >= goal;
              const dayNum = parseInt(day.date.split('-')[2], 10);
              const alpha = Math.max(day.steps / maxSteps, 0.15);
              return (
                <View key={day.date} style={styles.calendarCell}>
                  <View style={[styles.calendarDot, { backgroundColor: reachedGoal ? c.success : c.accent, opacity: alpha }]}>
                    <Text style={[styles.calendarDay, { color: c.text }]}>{dayNum}</Text>
                  </View>
                </View>
              );
            })}
          </View>
          <View style={[styles.goalLine, { borderTopColor: c.border, marginTop: 16 }]}>
            <View style={[styles.goalLineIndicator, { backgroundColor: c.success }]} />
            <Text style={[styles.goalLineText, { color: c.textTertiary }]}>Goal reached: {daysGoalMet} days</Text>
          </View>
        </View>

        <View style={[styles.summaryContainer, { backgroundColor: c.surface }]}>
          <Text style={[styles.summaryTitle, { color: c.text }]}>Monthly Summary</Text>
          {[
            { label: 'Total Steps', value: totalSteps.toLocaleString(), color: c.accent },
            { label: 'Goal', value: `${goalPercent}%`, color: goalPercent >= 100 ? c.success : c.text },
            { label: 'Calories', value: `${calories.toLocaleString()} kcal`, color: c.calories },
            { label: 'Distance', value: `${totalDistance.toFixed(2)} ${distanceUnit}`, color: c.distance },
            { label: 'Total Floors', value: totalFloors.toString(), color: c.floors },
            { label: 'Active Minutes', value: totalActiveMinutes.toString(), color: c.activeMinutes },
            { label: 'Daily Average', value: avgSteps.toLocaleString(), color: c.text },
            { label: 'Days Goal Met', value: `${daysGoalMet}/${daysInMonth}`, color: daysGoalMet >= daysInMonth * 0.7 ? c.success : c.warning },
            { label: 'vs. Last Month', value: `${stepDelta >= 0 ? '+' : ''}${stepDelta.toLocaleString()} (${stepDeltaPct >= 0 ? '+' : ''}${stepDeltaPct}%)`, color: stepDelta >= 0 ? c.success : c.error },
          ].map((row) => (
            <View key={row.label} style={[styles.summaryRow, { borderBottomColor: c.border }]}>
              <Text style={[styles.summaryLabel, { color: c.textTertiary }]}>{row.label}</Text>
              <Text style={[styles.summaryValue, { color: row.color }]}>{row.value}</Text>
            </View>
          ))}
        </View>
      </>
    );
  };

  const renderYearView = () => {
    const yearData = getYearHistory();
    const maxSteps = Math.max(...yearData.map((d) => d.steps), 1);
    const today = new Date();
    const monthsElapsed = today.getMonth() + 1;

    const totalSteps = yearData.reduce((sum, d) => sum + d.steps, 0);
    const totalFloors = yearData.reduce((sum, d) => sum + d.floors, 0);
    const totalActiveMinutes = yearData.reduce((sum, d) => sum + d.activeMinutes, 0);
    const totalDistance = yearData.reduce((sum, d) => sum + d.distance, 0);
    const avgSteps = Math.round(totalSteps / monthsElapsed);
    const monthsGoalMet = yearData.filter((d) => d.steps >= goal * 30).length;
    const calories = profile ? calculateCalories(totalSteps, profile.weight, profile.useMetric) : 0;
    const goalPercent = Math.round((avgSteps / (goal * 30)) * 100);

    const lastYear = today.getFullYear() - 1;
    let prevYearSteps = 0;
    for (let month = 0; month < 12; month++) {
      const daysInMonth = new Date(lastYear, month + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${lastYear}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const existing = stepHistory.find((d) => d.date === dateStr);
        if (existing) prevYearSteps += existing.steps;
      }
    }
    const stepDelta = totalSteps - prevYearSteps;
    const stepDeltaPct = prevYearSteps > 0 ? Math.round((stepDelta / prevYearSteps) * 100) : 0;

    return (
      <>
        <View style={[styles.chartContainer, { backgroundColor: c.surface }]}>
          <Text style={[styles.chartTitle, { color: c.text }]}>This Year</Text>
          <View style={styles.yearChart}>
            {yearData.map((month, index) => {
              const height = (month.steps / maxSteps) * 120;
              const reachedGoal = month.steps >= goal * 30;
              return (
                <View key={month.date} style={styles.yearBarContainer}>
                  <View style={styles.yearBarWrapper}>
                    <View style={[styles.yearBar, { height: Math.max(height, 4), backgroundColor: reachedGoal ? c.success : c.accent }]} />
                  </View>
                  <Text style={[styles.yearBarLabel, { color: c.textTertiary }]}>{months[index]}</Text>
                </View>
              );
            })}
          </View>
          <View style={[styles.goalLine, { borderTopColor: c.border }]}>
            <View style={[styles.goalLineIndicator, { backgroundColor: c.success }]} />
            <Text style={[styles.goalLineText, { color: c.textTertiary }]}>Monthly goal: {goal.toLocaleString()}/day avg</Text>
          </View>
        </View>

        <View style={[styles.summaryContainer, { backgroundColor: c.surface }]}>
          <Text style={[styles.summaryTitle, { color: c.text }]}>Yearly Summary</Text>
          {[
            { label: 'Total Steps', value: totalSteps.toLocaleString(), color: c.accent },
            { label: 'Goal', value: `${goalPercent}%`, color: goalPercent >= 100 ? c.success : c.text },
            { label: 'Calories', value: `${calories.toLocaleString()} kcal`, color: c.calories },
            { label: 'Distance', value: `${totalDistance.toFixed(2)} ${distanceUnit}`, color: c.distance },
            { label: 'Total Floors', value: totalFloors.toString(), color: c.floors },
            { label: 'Active Minutes', value: totalActiveMinutes.toString(), color: c.activeMinutes },
            { label: 'Monthly Average', value: avgSteps.toLocaleString(), color: c.text },
            { label: 'Months Goal Met', value: `${monthsGoalMet}/${monthsElapsed}`, color: monthsGoalMet >= monthsElapsed * 0.7 ? c.success : c.warning },
            { label: 'vs. Last Year', value: `${stepDelta >= 0 ? '+' : ''}${stepDelta.toLocaleString()} (${stepDeltaPct >= 0 ? '+' : ''}${stepDeltaPct}%)`, color: stepDelta >= 0 ? c.success : c.error },
          ].map((row) => (
            <View key={row.label} style={[styles.summaryRow, { borderBottomColor: c.border }]}>
              <Text style={[styles.summaryLabel, { color: c.textTertiary }]}>{row.label}</Text>
              <Text style={[styles.summaryValue, { color: row.color }]}>{row.value}</Text>
            </View>
          ))}
        </View>
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ height: insets.top }} />
      <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.text }]}>History</Text>
          <Text style={[styles.subtitle, { color: c.textTertiary }]}>Your fitness journey</Text>
        </View>

        <View style={[styles.streakCard, { backgroundColor: c.surface }]}>
          <View style={[styles.streakIcon, { backgroundColor: c.streak + '20' }]}>
            <MaterialCommunityIcons name="fire" size={28} color={c.streak} />
          </View>
          <View style={{ marginLeft: 16 }}>
            <Text style={[styles.streakValue, { color: c.streak }]}>{stepStreak} days</Text>
            <Text style={[styles.streakLabel, { color: c.textTertiary }]}>Current streak</Text>
          </View>
        </View>

        <View style={[styles.tabsContainer, { backgroundColor: c.surface }]}>
          <TouchableOpacity
            style={[styles.tab, viewMode === 'week' && { backgroundColor: c.background }]}
            onPress={() => setViewMode('week')}
          >
            <Text style={[styles.tabText, { color: viewMode === 'week' ? c.accent : c.textTertiary }]}>Week</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, viewMode === 'month' && { backgroundColor: c.background }]}
            onPress={() => setViewMode('month')}
          >
            <Text style={[styles.tabText, { color: viewMode === 'month' ? c.accent : c.textTertiary }]}>Month</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, viewMode === 'year' && { backgroundColor: c.background }]}
            onPress={() => setViewMode('year')}
          >
            <Text style={[styles.tabText, { color: viewMode === 'year' ? c.accent : c.textTertiary }]}>Year</Text>
          </TouchableOpacity>
        </View>

        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'year' && renderYearView()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold' },
  subtitle: { fontSize: 16, marginTop: 4 },
  streakCard: { borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 24, elevation: 2 },
  streakIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  streakValue: { fontSize: 24, fontWeight: 'bold' },
  streakLabel: { fontSize: 14, marginTop: 2 },
  tabsContainer: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 24 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabText: { fontSize: 14, fontWeight: '600' },
  chartContainer: { borderRadius: 16, padding: 20, marginBottom: 24, elevation: 2 },
  chartTitle: { fontSize: 18, fontWeight: '600', marginBottom: 20 },
  chart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 180 },
  barContainer: { alignItems: 'center', flex: 1 },
  barWrapper: { height: 150, justifyContent: 'flex-end' },
  bar: { width: '70%', borderRadius: 6, minHeight: 4 },
  barLabel: { fontSize: 12, marginTop: 8 },
  goalLine: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 8, borderTopWidth: 1 },
  goalLineIndicator: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  goalLineText: { fontSize: 12 },
  summaryContainer: { borderRadius: 16, padding: 20, elevation: 2 },
  summaryTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: '600' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4 },
  calendarCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 4 },
  calendarDot: { width: '100%', aspectRatio: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center', maxWidth: 40 },
  calendarDay: { fontSize: 13, fontWeight: '600' },
  yearChart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 140 },
  yearBarContainer: { flex: 1, alignItems: 'center' },
  yearBarWrapper: { height: 120, justifyContent: 'flex-end' },
  yearBar: { width: 16, borderRadius: 4, minHeight: 4 },
  yearBarLabel: { fontSize: 10, marginTop: 4 },
});
