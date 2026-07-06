import { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useUserStore, Workout } from '../../store/userStore';
import { getColors } from '../../utils/theme';
import { format } from 'date-fns';

const WORKOUT_TYPES = [
  { id: 'running', name: 'Running', icon: 'directions-run', caloriesPerMin: 10 },
  { id: 'walking', name: 'Walking', icon: 'directions-walk', caloriesPerMin: 4 },
  { id: 'cycling', name: 'Cycling', icon: 'directions-bike', caloriesPerMin: 8 },
  { id: 'swimming', name: 'Swimming', icon: 'pool', caloriesPerMin: 9 },
  { id: 'weights', name: 'Weight Training', icon: 'fitness-center', caloriesPerMin: 6 },
  { id: 'yoga', name: 'Yoga', icon: 'self-improvement', caloriesPerMin: 3 },
  { id: 'hiking', name: 'Hiking', icon: 'terrain', caloriesPerMin: 7 },
  { id: 'sports', name: 'Sports', icon: 'sports-soccer', caloriesPerMin: 8 },
];

const DURATION_PRESETS = [15, 30, 45, 60];
const MAX_DURATION_MINUTES = 999;

export default function WorkoutsScreen() {
  const profile = useUserStore((state) => state.profile);
  const workouts = useUserStore((state) => state.workouts);
  const addWorkout = useUserStore((state) => state.addWorkout);
  const removeWorkout = useUserStore((state) => state.removeWorkout);
  const getWorkoutsForWeek = useUserStore((state) => state.getWorkoutsForWeek);

  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<typeof WORKOUT_TYPES[0] | null>(null);
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const durationInputRef = useRef<TextInput>(null);

  const insets = useSafeAreaInsets();
  const darkMode = profile?.darkMode ?? false;
  const c = getColors(darkMode);

  const weekWorkouts = getWorkoutsForWeek();
  const totalCaloriesWeek = weekWorkouts.reduce((sum, w) => sum + w.calories, 0);
  const totalDurationWeek = weekWorkouts.reduce((sum, w) => sum + w.duration, 0);
  const durationMinutes = Number.parseInt(duration, 10);
  const hasValidDuration = Number.isFinite(durationMinutes) && durationMinutes > 0;

  const setDurationValue = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 3);
    if (!digits) {
      setDuration('');
      return;
    }

    const nextDuration = Math.min(Number.parseInt(digits, 10), MAX_DURATION_MINUTES);
    setDuration(nextDuration.toString());
  };

  const adjustDuration = (delta: number) => {
    const baseDuration = hasValidDuration ? durationMinutes : 0;
    const nextDuration = Math.min(Math.max(baseDuration + delta, 1), MAX_DURATION_MINUTES);
    setDuration(nextDuration.toString());
  };

  const handleAddWorkout = () => {
    if (!selectedType) return;
    if (!hasValidDuration) {
      Alert.alert('Invalid Duration', 'Please enter a valid workout duration.');
      return;
    }

    const calories = Math.round(durationMinutes * selectedType.caloriesPerMin * (profile?.weight ? (profile.useMetric ? profile.weight : profile.weight * 0.453592) / 70 : 1));
    addWorkout({
      type: selectedType.name,
      duration: durationMinutes,
      calories,
      notes: notes || undefined,
    });

    resetWizard();
  };

  const resetWizard = () => {
    setShowWizard(false);
    setStep(1);
    setSelectedType(null);
    setDuration('');
    setNotes('');
  };

  const handleRemoveWorkout = (id: string) => {
    Alert.alert('Delete Workout', 'Are you sure you want to delete this workout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeWorkout(id) },
    ]);
  };

  const estimatedCalories = selectedType && hasValidDuration
    ? Math.round(durationMinutes * selectedType.caloriesPerMin * (profile?.weight ? (profile.useMetric ? profile.weight : profile.weight * 0.453592) / 70 : 1))
    : 0;

  const nextStep = () => setStep((s) => Math.min(s + 1, 3));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));
  const handleCustomPreset = () => {
    setDuration('');
    durationInputRef.current?.focus();
  };

  const renderWorkout = useCallback(({ item }: { item: Workout }) => (
    <View style={[styles.workoutCard, { backgroundColor: c.surface }]}>
      <View style={styles.workoutInfo}>
        <Text style={[styles.workoutType, { color: c.text }]}>{item.type}</Text>
        <Text style={[styles.workoutDetails, { color: c.textTertiary }]}>
          {item.duration} min • {item.calories} cal • {item.date}
        </Text>
        {item.notes && <Text style={[styles.workoutNotes, { color: c.textSecondary }]}>{item.notes}</Text>}
      </View>
      <TouchableOpacity onPress={() => handleRemoveWorkout(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <MaterialIcons name="delete" size={24} color={c.textTertiary} />
      </TouchableOpacity>
    </View>
  ), [c]);

  if (!profile) return null;

  if (showWizard) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <View style={{ height: insets.top }} />
        <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={styles.wizardHeader}>
          <TouchableOpacity onPress={resetWizard} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialIcons name="close" size={28} color={c.text} />
          </TouchableOpacity>
          <Text style={[styles.wizardTitle, { color: c.text }]}>Log Workout</Text>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.stepIndicator}>
          {[1, 2, 3].map((s) => (
            <View key={s} style={styles.stepDotRow}>
              <View style={[styles.stepDot, { backgroundColor: s < step ? c.text : s === step ? c.text : c.border }]}>
                <Text style={[styles.stepDotText, { color: s <= step ? c.background : c.textTertiary }]}>{s}</Text>
              </View>
              {s < 3 && <View style={[styles.stepLine, { backgroundColor: s < step ? c.text : c.border }]} />}
            </View>
          ))}
        </View>

        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepLabel, { color: c.text }]}>Choose workout type</Text>
            <View style={styles.typeGrid}>
              {WORKOUT_TYPES.map((type) => {
                const isSelected = selectedType?.id === type.id;
                return (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.typeCard,
                      { backgroundColor: c.surface, borderColor: isSelected ? c.text : c.border },
                      isSelected && { borderWidth: 2 },
                    ]}
                    onPress={() => setSelectedType(type)}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name={type.icon as any} size={32} color={isSelected ? c.text : c.textTertiary} />
                    <Text style={[styles.typeName, { color: isSelected ? c.text : c.textTertiary }]}>{type.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[styles.wizardButton, { backgroundColor: selectedType ? c.text : c.border }]}
              onPress={nextStep}
              disabled={!selectedType}
            >
              <Text style={[styles.wizardButtonText, { color: selectedType ? c.background : c.textTertiary }]}>Next</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepLabel, { color: c.text }]}>How long?</Text>
            <View style={styles.durationPresetGrid}>
              {DURATION_PRESETS.map((p) => {
                const selected = durationMinutes === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.presetChip, { backgroundColor: selected ? c.text : c.surface, borderColor: selected ? c.text : c.border }]}
                    onPress={() => setDuration(p.toString())}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.presetChipText, { color: selected ? c.background : c.text }]}>{p} min</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.presetChip, { backgroundColor: hasValidDuration && !DURATION_PRESETS.includes(durationMinutes) ? c.text : c.surface, borderColor: hasValidDuration && !DURATION_PRESETS.includes(durationMinutes) ? c.text : c.border }]}
                onPress={handleCustomPreset}
                activeOpacity={0.7}
              >
                <Text style={[styles.presetChipText, { color: hasValidDuration && !DURATION_PRESETS.includes(durationMinutes) ? c.background : c.text }]}>Custom</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.durationPicker, { backgroundColor: c.surface, borderColor: c.border }]}> 
              <TouchableOpacity style={[styles.durationStepper, { borderColor: c.border }]} onPress={() => adjustDuration(-5)} activeOpacity={0.7}>
                <MaterialIcons name="remove" size={24} color={c.text} />
              </TouchableOpacity>
              <View style={styles.durationInputWrap}>
                <TextInput
                  ref={durationInputRef}
                  style={[styles.durationInput, { color: c.text }]}
                  value={duration}
                  onChangeText={setDurationValue}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={c.textTertiary}
                  maxLength={3}
                  textAlign="center"
                />
                <Text style={[styles.durationUnit, { color: c.textTertiary }]}>minutes</Text>
              </View>
              <TouchableOpacity style={[styles.durationStepper, { borderColor: c.border }]} onPress={() => adjustDuration(5)} activeOpacity={0.7}>
                <MaterialIcons name="add" size={24} color={c.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.wizardButtonRow}>
              <TouchableOpacity style={[styles.wizardButtonSecondary, { borderColor: c.border }]} onPress={prevStep}>
                <Text style={[styles.wizardButtonText, { color: c.text }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.wizardButton, { backgroundColor: hasValidDuration ? c.text : c.border, flex: 2 }]}
                onPress={nextStep}
                disabled={!hasValidDuration}
              >
                <Text style={[styles.wizardButtonText, { color: hasValidDuration ? c.background : c.textTertiary }]}>Next</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepLabel, { color: c.text }]}>Review & Save</Text>
            <View style={[styles.summaryCard, { backgroundColor: c.surface }]}>
              <View style={styles.summaryRow}>
                <MaterialIcons name="fitness-center" size={24} color={c.text} />
                <View style={styles.summaryTextCol}>
                  <Text style={[styles.summaryLabel, { color: c.textTertiary }]}>Type</Text>
                  <Text style={[styles.summaryValue, { color: c.text }]}>{selectedType?.name}</Text>
                </View>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: c.border }]} />
              <View style={styles.summaryRow}>
                <MaterialIcons name="timer" size={24} color={c.text} />
                <View style={styles.summaryTextCol}>
                  <Text style={[styles.summaryLabel, { color: c.textTertiary }]}>Duration</Text>
                  <Text style={[styles.summaryValue, { color: c.text }]}>{duration} min</Text>
                </View>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: c.border }]} />
              <View style={styles.summaryRow}>
                <MaterialIcons name="local-fire-department" size={24} color={c.text} />
                <View style={styles.summaryTextCol}>
                  <Text style={[styles.summaryLabel, { color: c.textTertiary }]}>Est. Calories</Text>
                  <Text style={[styles.summaryValue, { color: c.text }]}>{estimatedCalories} cal</Text>
                </View>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: c.border }]} />
              <View style={styles.summaryRow}>
                <MaterialIcons name="calendar-today" size={24} color={c.text} />
                <View style={styles.summaryTextCol}>
                  <Text style={[styles.summaryLabel, { color: c.textTertiary }]}>Date</Text>
                  <Text style={[styles.summaryValue, { color: c.text }]}>{format(new Date(), 'MMM d, yyyy')}</Text>
                </View>
              </View>
            </View>

            <Text style={[styles.notesLabel, { color: c.textTertiary }]}>Notes (optional)</Text>
            <TextInput
              style={[styles.notesInput, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="How did it feel?"
              placeholderTextColor={c.textTertiary}
              multiline
            />

            <View style={styles.wizardButtonRow}>
              <TouchableOpacity style={[styles.wizardButtonSecondary]} onPress={prevStep}>
                <Text style={[styles.wizardButtonText, { color: c.text }]}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.wizardButton, { backgroundColor: c.text, flex: 2 }]}
                onPress={handleAddWorkout}
              >
                <Text style={[styles.wizardButtonText, { color: c.background }]}>Save Workout</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
      </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: c.background, paddingTop: insets.top + 20, paddingHorizontal: 20 }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>Workouts</Text>
        <Text style={[styles.subtitle, { color: c.textTertiary }]}>Track your exercise</Text>
      </View>

      <View style={[styles.statsCard, { backgroundColor: c.surface }]}>
        <View style={styles.statItem}>
          <MaterialIcons name="local-fire-department" size={28} color={c.text} />
          <Text style={[styles.statValue, { color: c.text }]}>{totalCaloriesWeek}</Text>
          <Text style={[styles.statLabel, { color: c.textTertiary }]}>cal this week</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: c.border }]} />
        <View style={styles.statItem}>
          <MaterialIcons name="timer" size={28} color={c.text} />
          <Text style={[styles.statValue, { color: c.text }]}>{totalDurationWeek}</Text>
          <Text style={[styles.statLabel, { color: c.textTertiary }]}>min this week</Text>
        </View>
      </View>

      <TouchableOpacity style={[styles.addButton, { backgroundColor: c.text }]} onPress={() => setShowWizard(true)} activeOpacity={0.8}>
        <MaterialIcons name="add" size={24} color={c.background} />
        <Text style={[styles.addButtonText, { color: c.background }]}>Log Workout</Text>
      </TouchableOpacity>

      <Text style={[styles.listTitle, { color: c.text }]}>Recent</Text>
      {workouts.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: c.surface }]}>
          <MaterialIcons name="fitness-center" size={48} color={c.textTertiary} />
          <Text style={[styles.emptyText, { color: c.textTertiary }]}>No workouts logged yet</Text>
        </View>
      ) : (
        <FlatList
          data={workouts.slice().reverse()}
          renderItem={renderWorkout}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold' },
  subtitle: { fontSize: 16, marginTop: 4 },

  // Stats card
  statsCard: { borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 20, elevation: 2 },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 40 },
  statValue: { fontSize: 24, fontWeight: 'bold', marginTop: 8 },
  statLabel: { fontSize: 12, marginTop: 4 },

  // Add button
  addButton: { borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  addButtonText: { fontSize: 16, fontWeight: '600', marginLeft: 8 },

  // List
  listTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  workoutCard: { borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12, elevation: 2 },
  workoutInfo: { flex: 1 },
  workoutType: { fontSize: 16, fontWeight: '600' },
  workoutDetails: { fontSize: 14, marginTop: 4 },
  workoutNotes: { fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  emptyState: { borderRadius: 16, padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, marginTop: 12 },

  // Wizard
  wizardHeader: { marginTop: 10, marginBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wizardTitle: { fontSize: 20, fontWeight: 'bold' },

  // Step indicator
  stepIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  stepDotRow: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepDotText: { fontSize: 14, fontWeight: '700' },
  stepLine: { height: 2, width: 40, marginHorizontal: 0 },

  // Step content
  stepContent: { flex: 1 },
  stepLabel: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },

  // Type grid
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  typeCard: { width: '48%', aspectRatio: 1.4, borderRadius: 12, padding: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1 },
  typeName: { fontSize: 13, fontWeight: '600', marginTop: 8, textAlign: 'center' },

  // Presets
  durationPresetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  presetsScroll: { marginBottom: 12 },
  presetsRow: { flexDirection: 'row', gap: 12 },
  presetChip: { minWidth: '30%', flexGrow: 1, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  presetChipText: { fontSize: 14, fontWeight: '600' },
  durationInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, marginTop: 12 },
  durationPicker: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 24 },
  durationStepper: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  durationInputWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  durationInput: { minWidth: 96, paddingVertical: 2, paddingHorizontal: 8, fontSize: 40, fontWeight: '700' },
  durationUnit: { fontSize: 13, marginTop: 2, fontWeight: '600', textTransform: 'uppercase' },

  // Buttons
  wizardButtonRow: { flexDirection: 'row', gap: 12, marginTop: 'auto', paddingTop: 20 },
  wizardButton: { flex: 1, borderRadius: 12, padding: 16, alignItems: 'center' },
  wizardButtonSecondary: { flex: 1, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  wizardButtonText: { fontSize: 16, fontWeight: '600' },

  // Summary
  summaryCard: { borderRadius: 16, padding: 16, marginBottom: 20 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  summaryTextCol: { marginLeft: 16 },
  summaryLabel: { fontSize: 12 },
  summaryValue: { fontSize: 16, fontWeight: '600', marginTop: 2 },
  summaryDivider: { height: 1 },

  // Notes
  notesLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  notesInput: { borderRadius: 12, padding: 16, fontSize: 16, borderWidth: 1, height: 100, textAlignVertical: 'top' },
});
