import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, TextInput, Alert, ActivityIndicator, Linking, Platform, AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { requireNativeModule } from 'expo';
import { useUserStore } from '../../store/userStore';
import { useFitnessStore } from '../../store/fitnessStore';
import { getDb } from '../../utils/database';
import { useRouter } from 'expo-router';
import { getColors } from '../../utils/theme';
import { shareData, ExportData } from '../../utils/export';
import { useState, useEffect } from 'react';
import { checkActivityPermission, requestActivityPermission, checkNotificationPermission, requestNotificationPermission } from '../../utils/permissions';

let backgroundStepsModule: any = null;
if (Platform.OS === 'android') {
  try {
    backgroundStepsModule = requireNativeModule('BackgroundStepsModule');
  } catch {}
}

export default function SettingsScreen() {
  const router = useRouter();
  const profile = useUserStore((state) => state.profile);
  const workouts = useUserStore((state) => state.workouts);
  const updateProfile = useUserStore((state) => state.updateProfile);
  const setHasCompletedOnboarding = useUserStore((state) => state.setHasCompletedOnboarding);
  const stepHistory = useFitnessStore((state) => state.stepHistory);
  const backgroundTrackingEnabled = useUserStore((state) => state.backgroundTrackingEnabled ?? true);
  const setBackgroundTrackingEnabled = useUserStore((state) => state.setBackgroundTrackingEnabled);
  
  const [isExporting, setIsExporting] = useState(false);
  const [activityGranted, setActivityGranted] = useState<boolean | null>(null);
  const [notificationsGranted, setNotificationsGranted] = useState<boolean | null>(null);
  const [batteryIgnored, setBatteryIgnored] = useState<boolean | null>(null);

  const loadPermissions = async () => {
    const act = await checkActivityPermission();
    const notif = await checkNotificationPermission();
    setActivityGranted(act);
    setNotificationsGranted(notif);

    if (Platform.OS === 'android' && backgroundStepsModule) {
      try {
        const ignored = await backgroundStepsModule.isIgnoringBatteryOptimizations();
        setBatteryIgnored(ignored);
      } catch {}
    }
  };

  useEffect(() => {
    loadPermissions();

    // Auto-refresh permission status when user returns to app from system settings
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        loadPermissions();
      }
    });
    return () => sub.remove();
  }, []);

  const handleBackgroundServiceToggle = async (value: boolean) => {
    if (!backgroundStepsModule) return;
    setBackgroundTrackingEnabled(value);
    try {
      if (value) {
        await backgroundStepsModule.startService();
      } else {
        await backgroundStepsModule.stopService();
      }
      await backgroundStepsModule.setBackgroundTrackingEnabled(value);
    } catch {
      setBackgroundTrackingEnabled(!value);
    }
  };

  const handleRequestActivity = async () => {
    const granted = await requestActivityPermission();
    setActivityGranted(granted);
    if (!granted) {
      Alert.alert(
        'Permission Required',
        'Activity recognition permission was not granted. Please enable it in system settings to track steps.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
    }
  };

  const handleRequestNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotificationsGranted(granted);
    if (!granted) {
      Alert.alert(
        'Permission Required',
        'Notification permission was not granted. Please enable it in system settings to receive goal reminders.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
    }
  };

  const handleConfigureBattery = async () => {
    if (Platform.OS === 'android' && backgroundStepsModule) {
      try {
        const isIgnored = await backgroundStepsModule.isIgnoringBatteryOptimizations();
        if (isIgnored) {
          Alert.alert('Unrestricted', 'Nfit is already configured to run unrestricted in the background.');
          return;
        }
      } catch {}

      Alert.alert(
        'Battery Optimization',
        'Nfit requires unrestricted background execution to track steps reliably when the app is closed or the screen is turned off. Would you like to grant permission?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Configure',
            onPress: async () => {
              try {
                await backgroundStepsModule.requestIgnoreBatteryOptimizations();
                setTimeout(loadPermissions, 1500);
              } catch {
                Linking.openSettings();
              }
            }
          }
        ]
      );
    }
  };

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

  const resetAllData = useUserStore((state) => state.resetData);
  const resetFitnessData = useFitnessStore((state) => state.resetData);

  const handleResetData = () => {
    Alert.alert('Reset All Data', 'This will delete all your progress. This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          resetAllData();
          resetFitnessData();
          try {
            const db = await getDb();
            await db.execAsync('DELETE FROM daily_steps; DELETE FROM step_counter_state; DELETE FROM workouts; DELETE FROM profile; DELETE FROM app_state;');
          } catch {}
          router.replace('/onboarding');
        },
      },
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
        <Text style={[styles.sectionTitle, { color: c.textTertiary }]}>Permissions & Background</Text>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          {/* Activity Recognition */}
          <View style={[styles.row, { borderBottomColor: c.border }]}>
            <View style={styles.rowLeftSpec}>
              <MaterialIcons name="directions-walk" size={24} color={c.text} />
              <View style={styles.permissionInfo}>
                <Text style={[styles.rowLabelSpec, { color: c.text }]}>Activity Tracking</Text>
                <Text style={[styles.permissionDesc, { color: c.textTertiary }]}>Required to count steps and track exercise</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={[
                styles.permissionBtn, 
                { backgroundColor: activityGranted ? 'rgba(76, 175, 80, 0.15)' : c.border }
              ]} 
              onPress={activityGranted ? undefined : handleRequestActivity}
              disabled={activityGranted === true}
            >
              <Text style={[
                styles.permissionBtnText, 
                { color: activityGranted ? c.success : c.text }
              ]}>
                {activityGranted === null ? 'Loading...' : activityGranted ? 'Granted' : 'Grant'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Notifications */}
          <View style={[styles.row, { borderBottomColor: c.border }]}>
            <View style={styles.rowLeftSpec}>
              <MaterialIcons name="notifications" size={24} color={c.text} />
              <View style={styles.permissionInfo}>
                <Text style={[styles.rowLabelSpec, { color: c.text }]}>Notifications</Text>
                <Text style={[styles.permissionDesc, { color: c.textTertiary }]}>Receive goal alerts and reminders</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={[
                styles.permissionBtn, 
                { backgroundColor: notificationsGranted ? 'rgba(76, 175, 80, 0.15)' : c.border }
              ]} 
              onPress={notificationsGranted ? undefined : handleRequestNotifications}
              disabled={notificationsGranted === true}
            >
              <Text style={[
                styles.permissionBtnText, 
                { color: notificationsGranted ? c.success : c.text }
              ]}>
                {notificationsGranted === null ? 'Loading...' : notificationsGranted ? 'Granted' : 'Grant'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Background Battery optimization (Android only) */}
          {Platform.OS === 'android' && (
            <View style={[styles.row, { borderBottomColor: c.border }]}>
              <View style={styles.rowLeftSpec}>
                <MaterialIcons name="battery-alert" size={24} color={c.text} />
                <View style={styles.permissionInfo}>
                  <Text style={[styles.rowLabelSpec, { color: c.text }]}>Battery Optimization</Text>
                  <Text style={[styles.permissionDesc, { color: c.textTertiary }]}>Allow unrestricted background execution</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={[
                  styles.permissionBtn, 
                  { backgroundColor: batteryIgnored ? 'rgba(76, 175, 80, 0.15)' : c.border }
                ]} 
                onPress={handleConfigureBattery}
              >
                <Text style={[
                  styles.permissionBtnText, 
                  { color: batteryIgnored ? c.success : c.text }
                ]}>
                  {batteryIgnored === null ? 'Loading...' : batteryIgnored ? 'Unrestricted' : 'Configure'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Background step tracking service (Android only) */}
          {Platform.OS === 'android' && (
            <View style={[styles.row, {}]}>
              <View style={styles.rowLeftSpec}>
                <MaterialIcons name="directions-run" size={24} color={c.text} />
                <View style={styles.permissionInfo}>
                  <Text style={[styles.rowLabelSpec, { color: c.text }]}>Background Tracking</Text>
                  <Text style={[styles.permissionDesc, { color: c.textTertiary }]}>Keep tracking steps when the app is closed</Text>
                </View>
              </View>
              <Switch
                value={backgroundTrackingEnabled}
                onValueChange={handleBackgroundServiceToggle}
                trackColor={{ false: c.border, true: c.secondary }}
                thumbColor={c.primary}
              />
            </View>
          )}
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
        <Text style={[styles.footerText, { color: c.textTertiary }]}>Nfit v1.0.2</Text>
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
  rowLeftSpec: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 },
  rowLabelSpec: { fontSize: 16, fontWeight: '600' },
  permissionInfo: { marginLeft: 12, flex: 1 },
  permissionDesc: { fontSize: 12, marginTop: 2 },
  permissionBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, minWidth: 80, alignItems: 'center', justifyContent: 'center' },
  permissionBtnText: { fontSize: 14, fontWeight: '600' },
});
