import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useUserStore } from '../store/userStore';
import { getColors } from '../utils/theme';

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

  const c = getColors(darkMode);

  const handleComplete = () => {
    if (!name || !weight || !height || !age) return;
    setProfile({ 
      name, 
      weight: parseFloat(weight), 
      height: parseFloat(height), 
      age: parseInt(age, 10), 
      dailyStepGoal: parseInt(dailyStepGoal, 10) || 10000, 
      dailyCalorieGoal: 500,
      weightGoal: parseFloat(weight),
      weeklyWorkoutGoal: 3,
      useMetric, 
      darkMode 
    });
    router.replace('/(tabs)');
  };

  const weightUnit = useMetric ? 'kg' : 'lbs';
  const heightUnit = useMetric ? 'cm' : 'in';

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: c.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <MaterialIcons name="fitness-center" size={48} color={c.text} />
          <Text style={[styles.title, { color: c.text }]}>Welcome to Nfit</Text>
          <Text style={[styles.subtitle, { color: c.textTertiary }]}>Let's set up your fitness profile</Text>
        </View>
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: c.textSecondary }]}>Your Name</Text>
            <TextInput style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]} value={name} onChangeText={setName} placeholder="Enter your name" placeholderTextColor={c.textTertiary} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: c.textSecondary }]}>Weight ({weightUnit})</Text>
            <TextInput style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]} value={weight} onChangeText={setWeight} placeholder={useMetric ? "70" : "154"} keyboardType="numeric" placeholderTextColor={c.textTertiary} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: c.textSecondary }]}>Height ({heightUnit})</Text>
            <TextInput style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]} value={height} onChangeText={setHeight} placeholder={useMetric ? "170" : "67"} keyboardType="numeric" placeholderTextColor={c.textTertiary} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: c.textSecondary }]}>Age</Text>
            <TextInput style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]} value={age} onChangeText={setAge} placeholder="25" keyboardType="numeric" placeholderTextColor={c.textTertiary} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: c.textSecondary }]}>Daily Step Goal</Text>
            <TextInput style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]} value={dailyStepGoal} onChangeText={setDailyStepGoal} placeholder="10000" keyboardType="numeric" placeholderTextColor={c.textTertiary} />
          </View>
          <View style={[styles.toggleGroup, { backgroundColor: c.border }]}>
            <TouchableOpacity style={[styles.toggleButton, useMetric && { backgroundColor: c.background }]} onPress={() => setUseMetric(true)}>
              <Text style={[styles.toggleText, { color: useMetric ? c.text : c.textTertiary }]}>Metric (kg/cm)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleButton, !useMetric && { backgroundColor: c.background }]} onPress={() => setUseMetric(false)}>
              <Text style={[styles.toggleText, { color: !useMetric ? c.text : c.textTertiary }]}>Imperial (lbs/in)</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity style={[styles.button, { backgroundColor: c.text }, (!name || !weight || !height || !age) && { backgroundColor: c.textTertiary }]} onPress={handleComplete} disabled={!name || !weight || !height || !age}>
          <Text style={[styles.buttonText, { color: c.background }]}>Get Started</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: 60 },
  header: { marginBottom: 32, alignItems: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
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
});
