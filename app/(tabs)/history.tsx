import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useUserStore } from '../../store/userStore';
import { useFitnessStore } from '../../store/fitnessStore';

const { width } = Dimensions.get('window');
const barWidth = (width - 80) / 7;

function Icon({ name }: { name: string }) {
  const icons: Record<string, string> = {
    trophy: '\u2606',
  };
  return <Text style={{ fontSize: 40 }}>{icons[name] || '\u2022'}</Text>;
}

export default function HistoryScreen() {
  const profile = useUserStore((state) => state.profile);
  const getWeekHistory = useFitnessStore((state) => state.getWeekHistory);
  const stepStreak = useUserStore((state) => state.stepStreak);

  const darkMode = profile?.darkMode ?? false;
  const c = darkMode ? {
    bg: '#000000', surface: '#1A1A1A', border: '#333333',
    primary: '#FFFFFF', secondary: '#B0B0B0', tertiary: '#707070',
    success: '#CCCCCC'
  } : {
    bg: '#FFFFFF', surface: '#F5F5F5', border: '#E0E0E0',
    primary: '#000000', secondary: '#666666', tertiary: '#999999',
    success: '#333333'
  };

  const weekData = getWeekHistory();
  const maxSteps = Math.max(...weekData.map((d) => d.steps), 1);
  const goal = profile?.dailyStepGoal || 10000;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.primary }]}>History</Text>
        <Text style={[styles.subtitle, { color: c.tertiary }]}>Your weekly progress</Text>
      </View>

      <View style={[styles.streakCard, { backgroundColor: c.surface }]}>
        <Icon name="trophy" />
        <View style={{ marginLeft: 16 }}>
          <Text style={[styles.streakValue, { color: c.primary }]}>{stepStreak} days</Text>
          <Text style={[styles.streakLabel, { color: c.tertiary }]}>Current streak</Text>
        </View>
      </View>

      <View style={[styles.chartContainer, { backgroundColor: c.surface }]}>
        <Text style={[styles.chartTitle, { color: c.primary }]}>This Week</Text>
        <View style={styles.chart}>
          {weekData.map((day) => {
            const height = (day.steps / maxSteps) * 150;
            const dayName = days[new Date(day.date).getDay()];
            const reachedGoal = day.steps >= goal;
            return (
              <View key={day.date} style={styles.barContainer}>
                <View style={styles.barWrapper}>
                  <View style={[styles.bar, { height: Math.max(height, 4), backgroundColor: reachedGoal ? c.success : c.primary }]} />
                </View>
                <Text style={[styles.barLabel, { color: c.tertiary }]}>{dayName}</Text>
              </View>
            );
          })}
        </View>
        <View style={[styles.goalLine, { borderTopColor: c.border }]}>
          <View style={[styles.goalLineIndicator, { backgroundColor: c.success }]} />
          <Text style={[styles.goalLineText, { color: c.tertiary }]}>Goal: {goal.toLocaleString()}</Text>
        </View>
      </View>

      <View style={[styles.summaryContainer, { backgroundColor: c.surface }]}>
        <Text style={[styles.summaryTitle, { color: c.primary }]}>Weekly Summary</Text>
        <View style={[styles.summaryRow, { borderBottomColor: c.border }]}>
          <Text style={[styles.summaryLabel, { color: c.tertiary }]}>Total Steps</Text>
          <Text style={[styles.summaryValue, { color: c.primary }]}>{weekData.reduce((sum, d) => sum + d.steps, 0).toLocaleString()}</Text>
        </View>
        <View style={[styles.summaryRow, { borderBottomColor: c.border }]}>
          <Text style={[styles.summaryLabel, { color: c.tertiary }]}>Daily Average</Text>
          <Text style={[styles.summaryValue, { color: c.primary }]}>{Math.round(weekData.reduce((sum, d) => sum + d.steps, 0) / 7).toLocaleString()}</Text>
        </View>
        <View style={[styles.summaryRow, { borderBottomColor: c.border }]}>
          <Text style={[styles.summaryLabel, { color: c.tertiary }]}>Days Goal Met</Text>
          <Text style={[styles.summaryValue, { color: c.primary }]}>{weekData.filter((d) => d.steps >= goal).length}/7</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { marginTop: 50, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold' },
  subtitle: { fontSize: 16, marginTop: 4 },
  streakCard: { borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 24, elevation: 2 },
  streakValue: { fontSize: 24, fontWeight: 'bold' },
  streakLabel: { fontSize: 14, marginTop: 2 },
  chartContainer: { borderRadius: 16, padding: 20, marginBottom: 24, elevation: 2 },
  chartTitle: { fontSize: 18, fontWeight: '600', marginBottom: 20 },
  chart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 180 },
  barContainer: { alignItems: 'center', width: barWidth },
  barWrapper: { height: 150, justifyContent: 'flex-end' },
  bar: { width: barWidth - 8, borderRadius: 6, minHeight: 4 },
  barLabel: { fontSize: 12, marginTop: 8 },
  goalLine: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 8, borderTopWidth: 1 },
  goalLineIndicator: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  goalLineText: { fontSize: 12 },
  summaryContainer: { borderRadius: 16, padding: 20, elevation: 2 },
  summaryTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: '600' },
});
