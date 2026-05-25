import { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useUserStore } from '../../store/userStore';
import { useStepTracker } from '../../hooks/useStepTracker';
import { useFitnessStats } from '../../hooks/useFitnessStats';
import { getColors } from '../../utils/theme';
import { format } from 'date-fns';
import { requestNotificationPermissions, scheduleDailyReminder } from '../../utils/notifications';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const hasCompletedOnboarding = useUserStore((state) => state.hasCompletedOnboarding);
  
  const stepTracker = useStepTracker();
  const stats = useFitnessStats();
  
  useEffect(() => {
    if (!hasCompletedOnboarding) router.replace('/onboarding');
  }, [hasCompletedOnboarding]);

  useEffect(() => {
    requestNotificationPermissions();
    scheduleDailyReminder(20, 0);
  }, []);

  if (!stats) return null;

  const { profile, todaySteps, todayFloors, todayActiveMinutes, stepStreak, calories, distance, distanceUnit, goal, goalReached } = stats;
  const { isSimulated, progressAnim, pulseAnim } = stepTracker;
  const insets = useSafeAreaInsets();
  const darkMode = profile?.darkMode ?? false;
  const c = getColors(darkMode);
  const ringSize = width * 0.65;

  return (
    <View style={[styles.container, { backgroundColor: c.background, paddingTop: insets.top + 20 }]}>
      <View style={styles.header}>
        <Text style={[styles.greeting, { color: c.text }]}>Hello, {profile.name}</Text>
        <Text style={[styles.date, { color: c.textTertiary }]}>{format(new Date(), 'EEEE, MMMM d')}</Text>
      </View>
      <View style={styles.ringContainer}>
        <Animated.View style={[styles.ringWrapper, { transform: [{ scale: pulseAnim }] }]}>
          <View style={[styles.ring, { width: ringSize, height: ringSize }]}>
            <View style={[styles.progressRing, { width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderWidth: 24, borderColor: goalReached ? c.success : c.primary }]} />
            <View style={styles.ringContent}>
              <Text style={[styles.stepsCount, { color: goalReached ? c.success : c.primary }]}>{todaySteps.toLocaleString()}</Text>
              <Text style={[styles.stepsLabel, { color: c.textTertiary }]}>steps</Text>
              <Text style={[styles.goalText, { color: c.textTertiary }]}>{goalReached ? 'Goal reached!' : 'of ' + goal.toLocaleString()}</Text>
            </View>
          </View>
        </Animated.View>
      </View>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: c.surface }]}>
          <MaterialIcons name="local-fire-department" size={24} color={c.text} />
          <Text style={[styles.statValue, { color: c.text }]}>{calories}</Text>
          <Text style={[styles.statLabel, { color: c.textTertiary }]}>calories</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: c.surface }]}>
          <MaterialIcons name="straighten" size={24} color={c.text} />
          <Text style={[styles.statValue, { color: c.text }]}>{distance.toFixed(2)}</Text>
          <Text style={[styles.statLabel, { color: c.textTertiary }]}>{distanceUnit}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: c.surface }]}>
          <MaterialIcons name="emoji-events" size={24} color={c.text} />
          <Text style={[styles.statValue, { color: c.text }]}>{stepStreak}</Text>
          <Text style={[styles.statLabel, { color: c.textTertiary }]}>streak</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: c.surface }]}>
          <MaterialIcons name="stairs" size={24} color={c.text} />
          <Text style={[styles.statValue, { color: c.text }]}>{todayFloors}</Text>
          <Text style={[styles.statLabel, { color: c.textTertiary }]}>floors</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: c.surface }]}>
          <MaterialIcons name="timer" size={24} color={c.text} />
          <Text style={[styles.statValue, { color: c.text }]}>{todayActiveMinutes}</Text>
          <Text style={[styles.statLabel, { color: c.textTertiary }]}>active min</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: c.surface }]}>
          <MaterialIcons name="trending-up" size={24} color={c.text} />
          <Text style={[styles.statValue, { color: c.text }]}>{Math.round((todaySteps / goal) * 100)}%</Text>
          <Text style={[styles.statLabel, { color: c.textTertiary }]}>goal</Text>
        </View>
      </View>
      {isSimulated && <View style={[styles.warningCard, { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1 }]}><Text style={[styles.warningText, { color: c.textTertiary }]}>Demo mode - steps simulated</Text></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingBottom: 80 },
  header: { marginBottom: 20 },
  greeting: { fontSize: 28, fontWeight: 'bold' },
  date: { fontSize: 16, marginTop: 4 },
  ringContainer: { alignItems: 'center', justifyContent: 'center', marginVertical: 20 },
  ringWrapper: { alignItems: 'center', justifyContent: 'center' },
  ring: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  progressRing: { position: 'absolute' },
  ringContent: { alignItems: 'center', justifyContent: 'center' },
  stepsCount: { fontSize: 48, fontWeight: 'bold' },
  stepsLabel: { fontSize: 18, marginTop: -4 },
  goalText: { fontSize: 14, marginTop: 8 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  statCard: { flex: 1, borderRadius: 16, padding: 16, marginHorizontal: 4, alignItems: 'center', elevation: 2 },
  statValue: { fontSize: 24, fontWeight: 'bold', marginTop: 8 },
  statLabel: { fontSize: 12, marginTop: 4 },
  warningCard: { borderRadius: 12, padding: 16, marginTop: 20 },
  warningText: { fontSize: 14, textAlign: 'center' },
});
