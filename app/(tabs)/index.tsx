import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, TouchableOpacity } from 'react-native';
import Confetti from '../../components/Confetti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useUserStore } from '../../store/userStore';
import { useStepTracker } from '../../hooks/useStepTracker';
import { useFitnessStats } from '../../hooks/useFitnessStats';
import { getColors } from '../../utils/theme';
import { format } from 'date-fns';
import { requestNotificationPermissions, scheduleDailyReminder } from '../../utils/notifications';

const { width } = Dimensions.get('window');
const RING_SIZE = width * 0.6;
const STROKE_WIDTH = 14;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;

export default function HomeScreen() {
  const router = useRouter();
  const hasCompletedOnboarding = useUserStore((state) => state.hasCompletedOnboarding);

  const stepTracker = useStepTracker();
  const stats = useFitnessStats();

  const ringProgress = useRef(new Animated.Value(0)).current;

  const [confettiKey, setConfettiKey] = useState(0);
  const prevGoalRef = useRef(false);

  useEffect(() => {
    if (stats?.goalReached && !prevGoalRef.current) {
      setConfettiKey((k) => k + 1);
    }
    if (stats) prevGoalRef.current = stats.goalReached;
  }, [stats?.goalReached]);

  useEffect(() => {
    if (!hasCompletedOnboarding) router.replace('/onboarding');
  }, [hasCompletedOnboarding]);

  useEffect(() => {
    requestNotificationPermissions();
    scheduleDailyReminder(20, 0);
  }, []);

  useEffect(() => {
    if (stats) {
      const progress = Math.min(stats.todaySteps / stats.goal, 1);
      Animated.timing(ringProgress, {
        toValue: progress,
        useNativeDriver: true,
        duration: 400,
      }).start();
    }
  }, [stats?.todaySteps, stats?.goal]);

  if (!stats) return null;

  const { profile, todaySteps, todayFloors, todayActiveMinutes, stepStreak, calories, distance, distanceUnit, goal, goalReached } = stats;
  const { isSimulated, pulseAnim } = stepTracker;
  const insets = useSafeAreaInsets();
  const darkMode = profile?.darkMode ?? false;
  const c = getColors(darkMode);

  return (
    <View style={[styles.container, { backgroundColor: c.background, paddingTop: insets.top + 20 }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: c.text }]}>Hello, {profile.name}</Text>
          <Text style={[styles.date, { color: c.textTertiary }]}>{format(new Date(), 'EEEE, MMMM d')}</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.navigate('/(tabs)/settings')}
          style={[styles.settingsBtn, { backgroundColor: c.surface }]}
        >
          <Ionicons name="settings-outline" size={22} color={c.text} />
        </TouchableOpacity>
      </View>

      {/* Step Ring */}
      <View style={styles.ringContainer}>
        <Animated.View style={[styles.ringWrapper, { transform: [{ scale: pulseAnim }] }]}>
          <View style={[styles.ring, { width: RING_SIZE, height: RING_SIZE }]}>
            {/* Background ring */}
            <View style={[styles.ringBg, {
              width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2,
              borderWidth: STROKE_WIDTH, borderColor: c.border,
            }]} />
            {/* Progress ring */}
            <Animated.View style={[styles.ringProgress, {
              width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2,
              borderWidth: STROKE_WIDTH,
              borderColor: goalReached ? c.success : c.accent,
              opacity: ringProgress,
            }]} />
            {/* Center content */}
            <View style={styles.ringContent}>
              <Text style={[styles.stepsCount, { color: goalReached ? c.success : c.text }]}>
                {todaySteps.toLocaleString()}
              </Text>
              <Text style={[styles.stepsLabel, { color: c.textTertiary }]}>steps</Text>
              <View style={[styles.goalBadge, { backgroundColor: goalReached ? c.success + '20' : c.border + '40' }]}>
                <Text style={[styles.goalText, { color: goalReached ? c.success : c.textTertiary }]}>
                  {goalReached ? 'Goal reached!' : `of ${goal.toLocaleString()}`}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: c.surface }]}>
          <View style={[styles.statIconBg, { backgroundColor: c.calories + '20' }]}>
            <Ionicons name="flame" size={20} color={c.calories} />
          </View>
          <Text style={[styles.statValue, { color: c.text }]}>{calories}</Text>
          <Text style={[styles.statLabel, { color: c.textTertiary }]}>calories</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: c.surface }]}>
          <View style={[styles.statIconBg, { backgroundColor: c.distance + '20' }]}>
            <Ionicons name="map-outline" size={20} color={c.distance} />
          </View>
          <Text style={[styles.statValue, { color: c.text }]}>{distance.toFixed(1)}</Text>
          <Text style={[styles.statLabel, { color: c.textTertiary }]}>{distanceUnit}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: c.surface }]}>
          <View style={[styles.statIconBg, { backgroundColor: c.streak + '20' }]}>
            <MaterialCommunityIcons name="fire" size={20} color={c.streak} />
          </View>
          <Text style={[styles.statValue, { color: c.text }]}>{stepStreak}</Text>
          <Text style={[styles.statLabel, { color: c.textTertiary }]}>streak</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: c.surface }]}>
          <View style={[styles.statIconBg, { backgroundColor: c.floors + '20' }]}>
            <MaterialCommunityIcons name="stairs" size={20} color={c.floors} />
          </View>
          <Text style={[styles.statValue, { color: c.text }]}>{todayFloors}</Text>
          <Text style={[styles.statLabel, { color: c.textTertiary }]}>floors</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: c.surface }]}>
          <View style={[styles.statIconBg, { backgroundColor: c.activeMinutes + '20' }]}>
            <Ionicons name="time-outline" size={20} color={c.activeMinutes} />
          </View>
          <Text style={[styles.statValue, { color: c.text }]}>{todayActiveMinutes}</Text>
          <Text style={[styles.statLabel, { color: c.textTertiary }]}>active min</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: c.surface }]}>
          <View style={[styles.statIconBg, { backgroundColor: c.accent + '20' }]}>
            <Ionicons name="trending-up" size={20} color={c.accent} />
          </View>
          <Text style={[styles.statValue, { color: c.text }]}>{Math.round((todaySteps / goal) * 100)}%</Text>
          <Text style={[styles.statLabel, { color: c.textTertiary }]}>goal</Text>
        </View>
      </View>

      {isSimulated && (
        <View style={[styles.warningCard, { backgroundColor: c.warning + '20', borderColor: c.warning, borderWidth: 1 }]}>
          <Ionicons name="information-circle" size={18} color={c.warning} />
          <Text style={[styles.warningText, { color: c.warning }]}>Demo mode - steps simulated</Text>
        </View>
      )}
      {confettiKey > 0 && <Confetti key={confettiKey} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingBottom: 80 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  greeting: { fontSize: 28, fontWeight: 'bold' },
  date: { fontSize: 16, marginTop: 4 },
  settingsBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  ringContainer: { alignItems: 'center', justifyContent: 'center', marginVertical: 16 },
  ringWrapper: { alignItems: 'center', justifyContent: 'center' },
  ring: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  ringBg: { position: 'absolute' },
  ringProgress: { position: 'absolute' },
  ringContent: { alignItems: 'center', justifyContent: 'center' },
  stepsCount: { fontSize: 42, fontWeight: 'bold' },
  stepsLabel: { fontSize: 16, marginTop: -2 },
  goalBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 8 },
  goalText: { fontSize: 13, fontWeight: '500' },
  statsGrid: { flexDirection: 'row', gap: 10, marginTop: 10 },
  statCard: { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  statIconBg: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 20, fontWeight: 'bold', marginTop: 8 },
  statLabel: { fontSize: 11, marginTop: 2 },
  warningCard: { borderRadius: 12, padding: 12, marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  warningText: { fontSize: 13 },
});
