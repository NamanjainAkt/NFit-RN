import { View, Text, StyleSheet, TouchableOpacity, Switch, TextInput, Alert } from 'react-native';
import { useUserStore } from '../../store/userStore';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const router = useRouter();
  const profile = useUserStore((state) => state.profile);
  const updateProfile = useUserStore((state) => state.updateProfile);
  const setHasCompletedOnboarding = useUserStore((state) => state.setHasCompletedOnboarding);

  if (!profile) return null;

  const darkMode = profile.darkMode ?? false;
  const c = darkMode ? {
    bg: '#000000', surface: '#1A1A1A', border: '#333333',
    primary: '#FFFFFF', secondary: '#B0B0B0', tertiary: '#707070',
  } : {
    bg: '#FFFFFF', surface: '#F5F5F5', border: '#E0E0E0',
    primary: '#000000', secondary: '#666666', tertiary: '#999999',
  };

  const handleDarkModeToggle = (value: boolean) => {
    updateProfile({ darkMode: value });
  };

  const handleMetricToggle = (value: boolean) => {
    updateProfile({ useMetric: value });
  };

  const handleGoalChange = (text: string) => {
    const goal = parseInt(text, 10);
    if (!isNaN(goal) && goal > 0) {
      updateProfile({ dailyStepGoal: goal });
    }
  };

  const handleResetData = () => {
    Alert.alert('Reset All Data', 'This will delete all your progress. This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => { setHasCompletedOnboarding(false); router.replace('/onboarding'); } },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.primary }]}>Settings</Text>
        <Text style={[styles.subtitle, { color: c.tertiary }]}>Customize your experience</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.tertiary }]}>Profile</Text>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <View style={[styles.row, { borderBottomColor: c.border }]}>
            <Text style={[styles.rowLabel, { color: c.primary }]}>Name</Text>
            <Text style={[styles.rowValue, { color: c.tertiary }]}>{profile.name}</Text>
          </View>
          <View style={[styles.row, { borderBottomColor: c.border }]}>
            <Text style={[styles.rowLabel, { color: c.primary }]}>Weight</Text>
            <Text style={[styles.rowValue, { color: c.tertiary }]}>{profile.weight} {profile.useMetric ? 'kg' : 'lbs'}</Text>
          </View>
          <View style={[styles.row, { borderBottomColor: c.border }]}>
            <Text style={[styles.rowLabel, { color: c.primary }]}>Height</Text>
            <Text style={[styles.rowValue, { color: c.tertiary }]}>{profile.height} {profile.useMetric ? 'cm' : 'ft'}</Text>
          </View>
          <View style={[styles.row, { borderBottomColor: c.border }]}>
            <Text style={[styles.rowLabel, { color: c.primary }]}>Age</Text>
            <Text style={[styles.rowValue, { color: c.tertiary }]}>{profile.age} years</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.tertiary }]}>Goals</Text>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <View style={[styles.row, { borderBottomColor: c.border }]}>
            <Text style={[styles.rowLabel, { color: c.primary }]}>Daily Step Goal</Text>
            <TextInput style={[styles.input, { color: c.primary }]} value={profile.dailyStepGoal.toString()} onChangeText={handleGoalChange} keyboardType="numeric" selectTextOnFocus />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.tertiary }]}>Preferences</Text>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <View style={[styles.row, { borderBottomColor: c.border }]}>
            <Text style={[styles.rowLabel, { color: c.primary }]}>Dark Mode</Text>
            <Switch value={profile.darkMode} onValueChange={handleDarkModeToggle} trackColor={{ false: c.border, true: c.secondary }} thumbColor={c.primary} />
          </View>
          <View style={[styles.row, { borderBottomColor: c.border }]}>
            <Text style={[styles.rowLabel, { color: c.primary }]}>Use Metric Units</Text>
            <Switch value={profile.useMetric} onValueChange={handleMetricToggle} trackColor={{ false: c.border, true: c.secondary }} thumbColor={c.primary} />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.tertiary }]}>Data</Text>
        <TouchableOpacity style={[styles.dangerButton, { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1 }]} onPress={handleResetData}>
          <Text style={[styles.dangerButtonText, { color: c.primary }]}>Reset All Data</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: c.tertiary }]}>Nfit v1.0.0</Text>
        <Text style={[styles.footerText, { color: c.tertiary }]}>Sensor-driven fitness</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { marginTop: 50, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 'bold' },
  subtitle: { fontSize: 16, marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: 16, overflow: 'hidden', elevation: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  rowLabel: { fontSize: 16 },
  rowValue: { fontSize: 16 },
  input: { fontSize: 16, fontWeight: '600', textAlign: 'right', minWidth: 80 },
  dangerButton: { borderRadius: 12, padding: 16, alignItems: 'center' },
  dangerButtonText: { fontSize: 16, fontWeight: '600' },
  footer: { alignItems: 'center', marginTop: 'auto', paddingVertical: 24 },
  footerText: { fontSize: 12, marginTop: 4 },
});
