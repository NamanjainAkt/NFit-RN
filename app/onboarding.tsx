import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, PermissionsAndroid, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '../store/userStore';
import { getColors } from '../utils/theme';
import * as Notifications from 'expo-notifications';

export default function OnboardingScreen() {
  const router = useRouter();
  const setProfile = useUserStore((state) => state.setProfile);
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [dailyStepGoal, setDailyStepGoal] = useState('10000');
  const [useMetric, setUseMetric] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const [step, setStep] = useState(0);

  const c = getColors(darkMode);

  const requestActivityPermission = async () => {
    if (Platform.OS === 'android' && Platform.Version >= 29) {
      try {
        return await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
          { title: 'Step Tracking', message: 'Nfit needs to track your physical activity for step counting.' }
        );
      } catch {
        return PermissionsAndroid.RESULTS.DENIED;
      }
    }
    return PermissionsAndroid.RESULTS.GRANTED;
  };

  const requestNotificationPermission = async () => {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        return status === 'granted';
      } catch {
        return false;
      }
    }
    return true;
  };

  const validateField = (value: string, max: number, min: number = 1): boolean => {
    const num = parseFloat(value);
    return !isNaN(num) && num >= min && num <= max;
  };

  const saveProfile = () => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    const a = parseInt(age, 10);
    const g = parseInt(dailyStepGoal, 10);

    setProfile({
      name,
      weight: w,
      height: h,
      age: a,
      dailyStepGoal: g || 10000,
      dailyCalorieGoal: 500,
      weightGoal: w,
      weeklyWorkoutGoal: 3,
      useMetric,
      darkMode
    });
  };

  const handleContinue = () => {
    if (!name || !validateField(weight, 500) || !validateField(height, 300) || !validateField(age, 150)) {
      return;
    }
    saveProfile();
    setStep(1);
  };

  const handleComplete = async () => {
    await requestActivityPermission();
    await requestNotificationPermission();
    router.replace('/(tabs)');
  };

  const isInvalid = !name || !weight || !height || !age ||
                    !validateField(weight, 500) ||
                    !validateField(height, 300) ||
                    !validateField(age, 150);

  const weightUnit = useMetric ? 'kg' : 'lbs';
  const heightUnit = useMetric ? 'cm' : 'in';

  const openBatterySettings = () => {
    if (Platform.OS === 'android') {
      Linking.openSettings();
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: c.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {step === 0 ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={[styles.logoBg, { backgroundColor: c.accent + '20' }]}>
              <Ionicons name="fitness" size={48} color={c.accent} />
            </View>
            <Text style={[styles.title, { color: c.text }]}>Welcome to Nfit</Text>
            <Text style={[styles.subtitle, { color: c.textTertiary }]}>Let's set up your fitness profile</Text>
          </View>
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: c.textSecondary }]}>Your Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
                value={name} onChangeText={setName}
                placeholder="Enter your name" placeholderTextColor={c.textTertiary}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: c.textSecondary }]}>Weight ({weightUnit})</Text>
              <TextInput
                style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
                value={weight} onChangeText={setWeight}
                placeholder={useMetric ? "70" : "154"} keyboardType="numeric"
                placeholderTextColor={c.textTertiary}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: c.textSecondary }]}>Height ({heightUnit})</Text>
              <TextInput
                style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
                value={height} onChangeText={setHeight}
                placeholder={useMetric ? "170" : "67"} keyboardType="numeric"
                placeholderTextColor={c.textTertiary}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: c.textSecondary }]}>Age</Text>
              <TextInput
                style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
                value={age} onChangeText={setAge}
                placeholder="25" keyboardType="numeric"
                placeholderTextColor={c.textTertiary}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: c.textSecondary }]}>Daily Step Goal</Text>
              <TextInput
                style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
                value={dailyStepGoal} onChangeText={setDailyStepGoal}
                placeholder="10000" keyboardType="numeric"
                placeholderTextColor={c.textTertiary}
              />
            </View>
            <View style={[styles.toggleGroup, { backgroundColor: c.border }]}>
              <TouchableOpacity
                style={[styles.toggleButton, useMetric && { backgroundColor: c.background }]}
                onPress={() => setUseMetric(true)}
              >
                <Text style={[styles.toggleText, { color: useMetric ? c.accent : c.textTertiary }]}>Metric (kg/cm)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, !useMetric && { backgroundColor: c.background }]}
                onPress={() => setUseMetric(false)}
              >
                <Text style={[styles.toggleText, { color: !useMetric ? c.accent : c.textTertiary }]}>Imperial (lbs/in)</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: c.accent }, isInvalid && { backgroundColor: c.textTertiary }]}
            onPress={handleContinue} disabled={isInvalid}
          >
            <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Continue</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={[styles.logoBg, { backgroundColor: c.accent + '20' }]}>
              <Ionicons name="shield-checkmark" size={48} color={c.accent} />
            </View>
            <Text style={[styles.title, { color: c.text }]}>One Last Step</Text>
            <Text style={[styles.subtitle, { color: c.textTertiary }]}>Grant permissions for step tracking</Text>
          </View>
          <View style={styles.form}>
            <View style={[styles.permissionCard, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={styles.permissionRow}>
                <View style={[styles.permissionIcon, { backgroundColor: c.accent + '15' }]}>
                  <Ionicons name="notifications-outline" size={24} color={c.accent} />
                </View>
                <View style={styles.permissionInfo}>
                  <Text style={[styles.permissionTitle, { color: c.text }]}>Notifications</Text>
                  <Text style={[styles.permissionDesc, { color: c.textSecondary }]}>Required for tracking indicator (Android 13+)</Text>
                </View>
              </View>
              <View style={styles.permissionRow}>
                <View style={[styles.permissionIcon, { backgroundColor: c.accent + '15' }]}>
                  <Ionicons name="walk-outline" size={24} color={c.accent} />
                </View>
                <View style={styles.permissionInfo}>
                  <Text style={[styles.permissionTitle, { color: c.text }]}>Physical Activity</Text>
                  <Text style={[styles.permissionDesc, { color: c.textSecondary }]}>Used for step counting (Android 10+)</Text>
                </View>
              </View>
              <View style={styles.permissionRow}>
                <View style={[styles.permissionIcon, { backgroundColor: c.accent + '15' }]}>
                  <Ionicons name="battery-charging-outline" size={24} color={c.accent} />
                </View>
                <View style={styles.permissionInfo}>
                  <Text style={[styles.permissionTitle, { color: c.text }]}>Battery Optimization</Text>
                  <Text style={[styles.permissionDesc, { color: c.textSecondary }]}>Prevent system from stopping step tracking</Text>
                </View>
              </View>
              <TouchableOpacity style={[styles.batteryLink, { borderTopColor: c.border }]} onPress={openBatterySettings}>
                <Text style={[styles.batteryLinkText, { color: c.accent }]}>Open Battery Settings</Text>
                <Ionicons name="open-outline" size={18} color={c.accent} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.hint, { color: c.textTertiary }]}>
              You'll be prompted to grant permissions when you tap Complete. You can also change these later in Settings.
            </Text>
          </View>
          <TouchableOpacity style={[styles.button, { backgroundColor: c.accent }]} onPress={handleComplete}>
            <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Complete Setup</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: 60 },
  header: { marginBottom: 32, alignItems: 'center' },
  logoBg: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16 },
  form: { flex: 1 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { borderRadius: 12, padding: 16, fontSize: 16, borderWidth: 1 },
  toggleGroup: { flexDirection: 'row', marginBottom: 24, borderRadius: 12, padding: 4 },
  toggleButton: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
  toggleText: { fontSize: 14, fontWeight: '600' },
  button: { borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 20 },
  buttonText: { fontSize: 18, fontWeight: '600' },
  permissionCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  permissionRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 0 },
  permissionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  permissionInfo: { flex: 1, marginLeft: 14 },
  permissionTitle: { fontSize: 16, fontWeight: '600' },
  permissionDesc: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  batteryLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderTopWidth: 1 },
  batteryLinkText: { fontSize: 14, fontWeight: '600', marginRight: 6 },
  hint: { fontSize: 13, lineHeight: 18, textAlign: 'center', paddingHorizontal: 8 },
});
