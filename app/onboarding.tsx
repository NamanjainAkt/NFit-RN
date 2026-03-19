import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserStore } from '../store/userStore';

export default function OnboardingScreen() {
  const router = useRouter();
  const setProfile = useUserStore((state) => state.setProfile);
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [dailyStepGoal, setDailyStepGoal] = useState('10000');
  const [useMetric, setUseMetric] = useState(true);

  const handleComplete = () => {
    if (!name || !weight || !height || !age) return;
    setProfile({ name, weight: parseFloat(weight), height: parseFloat(height), age: parseInt(age, 10), dailyStepGoal: parseInt(dailyStepGoal, 10) || 10000, useMetric, darkMode: false });
    router.replace('/(tabs)');
  };

  const c = { bg: '#FFFFFF', surface: '#F5F5F5', border: '#E0E0E0', primary: '#000000', secondary: '#666666', tertiary: '#999999' };
  const weightUnit = useMetric ? 'kg' : 'lbs';
  const heightUnit = useMetric ? 'cm' : 'ft';

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: c.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.primary }]}>Welcome to Nfit</Text>
          <Text style={[styles.subtitle, { color: c.tertiary }]}>Let's set up your fitness profile</Text>
        </View>
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: c.secondary }]}>Your Name</Text>
            <TextInput style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.primary }]} value={name} onChangeText={setName} placeholder="Enter your name" placeholderTextColor={c.tertiary} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: c.secondary }]}>Weight ({weightUnit})</Text>
            <TextInput style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.primary }]} value={weight} onChangeText={setWeight} placeholder={useMetric ? "70" : "154"} keyboardType="numeric" placeholderTextColor={c.tertiary} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: c.secondary }]}>Height ({heightUnit})</Text>
            <TextInput style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.primary }]} value={height} onChangeText={setHeight} placeholder={useMetric ? "170" : "5.7"} keyboardType="numeric" placeholderTextColor={c.tertiary} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: c.secondary }]}>Age</Text>
            <TextInput style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.primary }]} value={age} onChangeText={setAge} placeholder="25" keyboardType="numeric" placeholderTextColor={c.tertiary} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: c.secondary }]}>Daily Step Goal</Text>
            <TextInput style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.primary }]} value={dailyStepGoal} onChangeText={setDailyStepGoal} placeholder="10000" keyboardType="numeric" placeholderTextColor={c.tertiary} />
          </View>
          <View style={[styles.toggleGroup, { backgroundColor: c.border }]}>
            <TouchableOpacity style={[styles.toggleButton, useMetric && { backgroundColor: c.bg }]} onPress={() => setUseMetric(true)}>
              <Text style={[styles.toggleText, { color: useMetric ? c.primary : c.tertiary }]}>Metric (kg/cm)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleButton, !useMetric && { backgroundColor: c.bg }]} onPress={() => setUseMetric(false)}>
              <Text style={[styles.toggleText, { color: !useMetric ? c.primary : c.tertiary }]}>Imperial (lbs/ft)</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity style={[styles.button, { backgroundColor: c.primary }, (!name || !weight || !height || !age) && { backgroundColor: c.tertiary }]} onPress={handleComplete} disabled={!name || !weight || !height || !age}>
          <Text style={[styles.buttonText, { color: c.bg }]}>Get Started</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: 60 },
  header: { marginBottom: 32 },
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
});
