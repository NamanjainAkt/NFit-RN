import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useUserStore } from '../../store/userStore';
import { useFitnessStore } from '../../store/fitnessStore';
import { useRouter } from 'expo-router';
import { getColors } from '../../utils/theme';
import { shareData, ExportData } from '../../utils/export';
import { useState } from 'react';

export default function SettingsScreen() {
  const router = useRouter();
  const profile = useUserStore((state) => state.profile);
  const workouts = useUserStore((state) => state.workouts);
  const updateProfile = useUserStore((state) => state.updateProfile);
  const setHasCompletedOnboarding = useUserStore((state) => state.setHasCompletedOnboarding);
  const stepHistory = useFitnessStore((state) => state.stepHistory);
  
  const [isExporting, setIsExporting] = useState(false);

  if (!profile) return null;

  const insets = useSafeAreaInsets();
  const darkMode = profile.darkMode ?? false;
  const c = getColors(darkMode);

  const handleNameChange = (text: string) => {
    if (text.trim()) updateProfile({ name: text });
  };

  const handleWeightChange = (text: string) => {
    const w = parseFloat(text);
    if (!isNaN(w) && w > 0) updateProfile({ weight: w });
  };

  const handleHeightChange = (text: string) => {
    const h = parseFloat(text);
    if (!isNaN(h) && h > 0) updateProfile({ height: h });
  };

  const handleAgeChange = (text: string) => {
    const a = parseInt(text, 10);
    if (!isNaN(a) && a > 0) updateProfile({ age: a });
  };

  const handleDarkModeToggle = (value: boolean) => {
    updateProfile({ darkMode: value });
  };

  const handleMetricToggle = (value: boolean) => {
    updateProfile({ useMetric: value });
  };

  const handleStepGoalChange = (text: string) => {
    const goal = parseInt(text, 10);
    if (!isNaN(goal) && goal > 0) {
      updateProfile({ dailyStepGoal: goal });
    }
  };

  const handleCalorieGoalChange = (text: string) => {
    const goal = parseInt(text, 10);
    if (!isNaN(goal) && goal > 0) {
      updateProfile({ dailyCalorieGoal: goal });
    }
  };

  const handleWeightGoalChange = (text: string) => {
    const goal = parseFloat(text);
    if (!isNaN(goal) && goal > 0) {
      updateProfile({ weightGoal: goal });
    }
  };

  const handleWorkoutGoalChange = (text: string) => {
    const goal = parseInt(text, 10);
    if (!isNaN(goal) && goal > 0) {
      updateProfile({ weeklyWorkoutGoal: goal });
    }
  };

  const handleResetData = () => {
    Alert.alert('Reset All Data', 'This will delete all your progress. This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => { setHasCompletedOnboarding(false); router.replace('/onboarding'); } },
    ]);
  };

  const handleExportData = () => {
    Alert.alert('Export Data', 'Choose export format', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'JSON', 
        onPress: async () => {
          setIsExporting(true);
          const exportData: ExportData = {
            profile: {
              name: profile.name,
              weight: profile.weight,
              height: profile.height,
              age: profile.age,
              dailyStepGoal: profile.dailyStepGoal,
              dailyCalorieGoal: profile.dailyCalorieGoal || 500,
              weightGoal: profile.weightGoal || profile.weight,
              weeklyWorkoutGoal: profile.weeklyWorkoutGoal || 3,
            },
            stepHistory,
            workouts,
            exportedAt: new Date().toISOString(),
          };
          const success = await shareData(exportData, 'json');
          if (!success) {
            Alert.alert('Export Failed', 'Unable to export data.');
          }
          setIsExporting(false);
        }
      },
      { 
        text: 'CSV', 
        onPress: async () => {
          setIsExporting(true);
          const exportData: ExportData = {
            profile: {
              name: profile.name,
              weight: profile.weight,
              height: profile.height,
              age: profile.age,
              dailyStepGoal: profile.dailyStepGoal,
              dailyCalorieGoal: profile.dailyCalorieGoal || 500,
              weightGoal: profile.weightGoal || profile.weight,
              weeklyWorkoutGoal: profile.weeklyWorkoutGoal || 3,
            },
            stepHistory,
            workouts,
            exportedAt: new Date().toISOString(),
          };
          const success = await shareData(exportData, 'csv');
          if (!success) {
            Alert.alert('Export Failed', 'Unable to export data.');
          }
          setIsExporting(false);
        }
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={{ height: insets.top }} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>Settings</Text>
        <Text style={[styles.subtitle, { color: c.textTertiary }]}>Customize your experience</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.textTertiary }]}>Profile</Text>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
            <View style={[styles.row, { borderBottomColor: c.border }]}>
              <View style={styles.rowLeft}>
                <MaterialIcons name="person" size={24} color={c.text} />
                <Text style={[styles.rowLabel, { color: c.text }]}>Name</Text>
              </View>
              <TextInput style={[styles.input, { color: c.text }]} value={profile.name} onChangeText={handleNameChange} selectTextOnFocus />
            </View>
            <View style={[styles.row, { borderBottomColor: c.border }]}>
              <View style={styles.rowLeft}>
                <MaterialIcons name="fitness-center" size={24} color={c.text} />
                <Text style={[styles.rowLabel, { color: c.text }]}>Weight</Text>
              </View>
              <TextInput style={[styles.input, { color: c.text }]} value={profile.weight.toString()} onChangeText={handleWeightChange} keyboardType="numeric" selectTextOnFocus />
            </View>
            <View style={[styles.row, { borderBottomColor: c.border }]}>
              <View style={styles.rowLeft}>
                <MaterialIcons name="straighten" size={24} color={c.text} />
                <Text style={[styles.rowLabel, { color: c.text }]}>Height</Text>
              </View>
              <TextInput style={[styles.input, { color: c.text }]} value={profile.height.toString()} onChangeText={handleHeightChange} keyboardType="numeric" selectTextOnFocus />
            </View>
            <View style={[styles.row, { borderBottomColor: c.border }]}>
              <View style={styles.rowLeft}>
                <MaterialIcons name="cake" size={24} color={c.text} />
                <Text style={[styles.rowLabel, { color: c.text }]}>Age</Text>
              </View>
              <TextInput style={[styles.input, { color: c.text }]} value={profile.age.toString()} onChangeText={handleAgeChange} keyboardType="numeric" selectTextOnFocus />
            </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.textTertiary }]}>Goals</Text>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <View style={[styles.row, { borderBottomColor: c.border }]}>
            <View style={styles.rowLeft}>
              <MaterialIcons name="directions-walk" size={24} color={c.text} />
              <Text style={[styles.rowLabel, { color: c.text }]}>Daily Steps</Text>
            </View>
            <TextInput style={[styles.input, { color: c.text }]} value={profile.dailyStepGoal.toString()} onChangeText={handleStepGoalChange} keyboardType="numeric" selectTextOnFocus />
          </View>
          <View style={[styles.row, { borderBottomColor: c.border }]}>
            <View style={styles.rowLeft}>
              <MaterialIcons name="local-fire-department" size={24} color={c.text} />
              <Text style={[styles.rowLabel, { color: c.text }]}>Daily Calories</Text>
            </View>
            <TextInput style={[styles.input, { color: c.text }]} value={(profile.dailyCalorieGoal || 500).toString()} onChangeText={handleCalorieGoalChange} keyboardType="numeric" selectTextOnFocus />
          </View>
          <View style={[styles.row, { borderBottomColor: c.border }]}>
            <View style={styles.rowLeft}>
              <MaterialIcons name="monitor-weight" size={24} color={c.text} />
              <Text style={[styles.rowLabel, { color: c.text }]}>Weight Goal</Text>
            </View>
            <TextInput style={[styles.input, { color: c.text }]} value={profile.weightGoal?.toString() || profile.weight.toString()} onChangeText={handleWeightGoalChange} keyboardType="numeric" selectTextOnFocus />
          </View>
          <View style={[styles.row, { borderBottomColor: c.border }]}>
            <View style={styles.rowLeft}>
              <MaterialIcons name="fitness-center" size={24} color={c.text} />
              <Text style={[styles.rowLabel, { color: c.text }]}>Weekly Workouts</Text>
            </View>
            <TextInput style={[styles.input, { color: c.text }]} value={(profile.weeklyWorkoutGoal || 3).toString()} onChangeText={handleWorkoutGoalChange} keyboardType="numeric" selectTextOnFocus />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.textTertiary }]}>Preferences</Text>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <View style={[styles.row, { borderBottomColor: c.border }]}>
            <View style={styles.rowLeft}>
              <MaterialIcons name="dark-mode" size={24} color={c.text} />
              <Text style={[styles.rowLabel, { color: c.text }]}>Dark Mode</Text>
            </View>
            <Switch value={profile.darkMode} onValueChange={handleDarkModeToggle} trackColor={{ false: c.border, true: c.secondary }} thumbColor={c.primary} />
          </View>
          <View style={[styles.row, { borderBottomColor: c.border }]}>
            <View style={styles.rowLeft}>
              <MaterialIcons name="straighten" size={24} color={c.text} />
              <Text style={[styles.rowLabel, { color: c.text }]}>Use Metric Units</Text>
            </View>
            <Switch value={profile.useMetric} onValueChange={handleMetricToggle} trackColor={{ false: c.border, true: c.secondary }} thumbColor={c.primary} />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.textTertiary }]}>Data</Text>
        <View style={[styles.card, { backgroundColor: c.surface, marginBottom: 12 }]}>
          <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} onPress={handleExportData} disabled={isExporting}>
            <View style={styles.rowLeft}>
              <MaterialIcons name="download" size={24} color={c.text} />
              <Text style={[styles.rowLabel, { color: c.text }]}>Export Data</Text>
            </View>
            {isExporting ? <ActivityIndicator size="small" color={c.text} /> : <MaterialIcons name="chevron-right" size={24} color={c.textTertiary} />}
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.dangerButton, { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1 }]} onPress={handleResetData}>
          <MaterialIcons name="delete" size={24} color={c.text} />
          <Text style={[styles.dangerButtonText, { color: c.text }]}>Reset All Data</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: c.textTertiary }]}>Nfit v1.0.0</Text>
        <Text style={[styles.footerText, { color: c.textTertiary }]}>Sensor-driven fitness</Text>
      </View>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 'bold' },
  subtitle: { fontSize: 16, marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: 16, overflow: 'hidden', elevation: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { fontSize: 16, marginLeft: 12 },
  rowValue: { fontSize: 16 },
  input: { fontSize: 16, fontWeight: '600', textAlign: 'right', minWidth: 80 },
  dangerButton: { borderRadius: 12, padding: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  dangerButtonText: { fontSize: 16, fontWeight: '600', marginLeft: 8 },
  footer: { alignItems: 'center', paddingVertical: 24 },
  footerText: { fontSize: 12, marginTop: 4 },
});
