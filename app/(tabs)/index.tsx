import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Pedometer } from 'expo-sensors';
import { useUserStore } from '../../store/userStore';
import { useFitnessStore } from '../../store/fitnessStore';
import { format } from 'date-fns';

const { width } = Dimensions.get('window');

function Icon({ name }: { name: string }) {
  const icons: Record<string, string> = {
    steps: '\u221E',
    fire: '\u2044',
    location: '\u25CB',
    trophy: '\u2606',
  };
  return <Text style={{ fontSize: 24 }}>{icons[name] || '\u2022'}</Text>;
}

export default function HomeScreen() {
  const router = useRouter();
  const profile = useUserStore((state) => state.profile);
  const stepStreak = useUserStore((state) => state.stepStreak);
  const hasCompletedOnboarding = useUserStore((state) => state.hasCompletedOnboarding);
  const updateStepStreak = useUserStore((state) => state.updateStepStreak);
  
  const { todaySteps, setTodaySteps, calculateCalories, calculateDistance } = useFitnessStore();
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

  const [isSimulated, setIsSimulated] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!hasCompletedOnboarding) router.replace('/onboarding');
  }, [hasCompletedOnboarding]);

  useEffect(() => { checkPedometerPermission(); }, []);

  useEffect(() => {
    if (profile) {
      const goal = profile.dailyStepGoal || 10000;
      const progress = Math.min(todaySteps / goal, 1);
      Animated.spring(progressAnim, { toValue: progress, useNativeDriver: false, tension: 50, friction: 10 }).start();
      if (progress >= 1) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.05, duration: 500, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          ]), { iterations: 3 }
        ).start();
      }
    }
  }, [todaySteps, profile]);

  const checkPedometerPermission = async () => {
    if (Platform.OS === 'android') {
      setIsSimulated(true);
      setTodaySteps(Math.floor(Math.random() * 5000) + 1000);
      return;
    }
    try {
      const available = await Pedometer.isAvailableAsync();
      if (!available) { setIsSimulated(true); setTodaySteps(Math.floor(Math.random() * 5000) + 1000); return; }
      const result = await Pedometer.requestPermissionsAsync();
      if (result.granted) {
        const sub = Pedometer.watchStepCount((data) => {
          setTodaySteps(data.steps);
          if (profile) {
            const goal = profile.dailyStepGoal || 10000;
            if (data.steps >= goal) updateStepStreak(format(new Date(), 'yyyy-MM-dd'));
          }
        });
      } else { setIsSimulated(true); setTodaySteps(Math.floor(Math.random() * 5000) + 1000); }
    } catch (e) {
      setIsSimulated(true);
      setTodaySteps(Math.floor(Math.random() * 5000) + 1000);
    }
  };

  if (!profile) return null;

  const goal = profile.dailyStepGoal || 10000;
  const goalReached = todaySteps >= goal;
  const calories = calculateCalories(todaySteps, profile.weight);
  const distance = calculateDistance(todaySteps, profile.height, profile.useMetric);
  const distanceUnit = profile.useMetric ? 'km' : 'mi';
  const ringSize = width * 0.65;

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.greeting, { color: c.primary }]}>Hello, {profile.name}</Text>
        <Text style={[styles.date, { color: c.tertiary }]}>{format(new Date(), 'EEEE, MMMM d')}</Text>
      </View>
      <View style={styles.ringContainer}>
        <Animated.View style={[styles.ringWrapper, { transform: [{ scale: pulseAnim }] }]}>
          <View style={[styles.ring, { width: ringSize, height: ringSize }]}>
            <View style={[styles.progressRing, { width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderWidth: 24, borderColor: goalReached ? c.success : c.primary }]} />
            <View style={styles.ringContent}>
              <Text style={[styles.stepsCount, { color: goalReached ? c.success : c.primary }]}>{todaySteps.toLocaleString()}</Text>
              <Text style={[styles.stepsLabel, { color: c.tertiary }]}>steps</Text>
              <Text style={[styles.goalText, { color: c.tertiary }]}>{goalReached ? 'Goal reached!' : 'of ' + goal.toLocaleString()}</Text>
            </View>
          </View>
        </Animated.View>
      </View>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: c.surface }]}>
          <Icon name="fire" />
          <Text style={[styles.statValue, { color: c.primary }]}>{calories}</Text>
          <Text style={[styles.statLabel, { color: c.tertiary }]}>calories</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: c.surface }]}>
          <Icon name="location" />
          <Text style={[styles.statValue, { color: c.primary }]}>{distance.toFixed(2)}</Text>
          <Text style={[styles.statLabel, { color: c.tertiary }]}>{distanceUnit}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: c.surface }]}>
          <Icon name="trophy" />
          <Text style={[styles.statValue, { color: c.primary }]}>{stepStreak}</Text>
          <Text style={[styles.statLabel, { color: c.tertiary }]}>streak</Text>
        </View>
      </View>
      {isSimulated && <View style={[styles.warningCard, { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1 }]}><Text style={[styles.warningText, { color: c.tertiary }]}>Demo mode - steps simulated</Text></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { marginTop: 50, marginBottom: 20 },
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
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  statCard: { flex: 1, borderRadius: 16, padding: 16, marginHorizontal: 4, alignItems: 'center', elevation: 2 },
  statValue: { fontSize: 24, fontWeight: 'bold', marginTop: 8 },
  statLabel: { fontSize: 12, marginTop: 4 },
  warningCard: { borderRadius: 12, padding: 16, marginTop: 20 },
  warningText: { fontSize: 14, textAlign: 'center' },
});
