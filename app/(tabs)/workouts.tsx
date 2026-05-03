import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Alert, ScrollView } from 'react-native';
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

export default function WorkoutsScreen() {
  const profile = useUserStore((state) => state.profile);
  const workouts = useUserStore((state) => state.workouts);
  const addWorkout = useUserStore((state) => state.addWorkout);
  const removeWorkout = useUserStore((state) => state.removeWorkout);
  const getWorkoutsForWeek = useUserStore((state) => state.getWorkoutsForWeek);

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState(WORKOUT_TYPES[0]);
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');

  const darkMode = profile?.darkMode ?? false;
  const c = getColors(darkMode);

  const weekWorkouts = getWorkoutsForWeek();
  const totalCaloriesWeek = weekWorkouts.reduce((sum, w) => sum + w.calories, 0);
  const totalDurationWeek = weekWorkouts.reduce((sum, w) => sum + w.duration, 0);

  const handleAddWorkout = () => {
    const durationNum = parseInt(duration, 10);
    if (!durationNum || durationNum <= 0) {
      Alert.alert('Invalid Duration', 'Please enter a valid workout duration.');
      return;
    }

    const calories = Math.round(durationNum * selectedType.caloriesPerMin * (profile?.weight ? (profile.useMetric ? profile.weight : profile.weight * 0.453592) / 70 : 1));
    addWorkout({
      type: selectedType.name,
      duration: durationNum,
      calories,
      notes: notes || undefined,
    });

    setDuration('');
    setNotes('');
    setShowAddModal(false);
  };

  const handleRemoveWorkout = (id: string) => {
    Alert.alert('Delete Workout', 'Are you sure you want to delete this workout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeWorkout(id) },
    ]);
  };

  const renderWorkout = ({ item }: { item: Workout }) => (
    <View style={[styles.workoutCard, { backgroundColor: c.surface }]}>
      <View style={styles.workoutInfo}>
        <Text style={[styles.workoutType, { color: c.text }]}>{item.type}</Text>
        <Text style={[styles.workoutDetails, { color: c.textTertiary }]}>
          {item.duration} min • {item.calories} cal • {item.date}
        </Text>
        {item.notes && <Text style={[styles.workoutNotes, { color: c.textSecondary }]}>{item.notes}</Text>}
      </View>
      <TouchableOpacity onPress={() => handleRemoveWorkout(item.id)}>
        <MaterialIcons name="delete" size={24} color={c.textTertiary} />
      </TouchableOpacity>
    </View>
  );

  if (!profile) return null;

  if (showAddModal) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowAddModal(false)}>
            <MaterialIcons name="arrow-back" size={28} color={c.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: c.text }]}>Log Workout</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.textTertiary }]}>Workout Type</Text>
          <View style={styles.typeGrid}>
            {WORKOUT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeCard,
                  { backgroundColor: c.surface, borderColor: selectedType.id === type.id ? c.text : c.border },
                  selectedType.id === type.id && { borderWidth: 2 },
                ]}
                onPress={() => setSelectedType(type)}
              >
                <MaterialIcons name={type.icon as any} size={32} color={c.text} />
                <Text style={[styles.typeName, { color: c.text }]}>{type.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.textTertiary }]}>Duration (minutes)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            value={duration}
            onChangeText={setDuration}
            keyboardType="numeric"
            placeholder="30"
            placeholderTextColor={c.textTertiary}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.textTertiary }]}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add notes..."
            placeholderTextColor={c.textTertiary}
            multiline
          />
        </View>

        <View style={[styles.caloriesPreview, { backgroundColor: c.surface }]}>
          <Text style={[styles.previewLabel, { color: c.textTertiary }]}>Estimated Calories</Text>
          <Text style={[styles.previewValue, { color: c.text }]}>
            {duration ? Math.round(parseInt(duration, 10) * selectedType.caloriesPerMin * (profile?.weight ? (profile.useMetric ? profile.weight : profile.weight * 0.453592) / 70 : 1)) : 0} cal
          </Text>
        </View>

        <TouchableOpacity style={[styles.addButton, { backgroundColor: c.text }]} onPress={handleAddWorkout}>
          <Text style={[styles.addButtonText, { color: c.background }]}>Save Workout</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>Workouts</Text>
        <Text style={[styles.subtitle, { color: c.textTertiary }]}>Track your exercises</Text>
      </View>

      <View style={[styles.statsCard, { backgroundColor: c.surface }]}>
        <View style={styles.statItem}>
          <MaterialIcons name="local-fire-department" size={28} color={c.text} />
          <Text style={[styles.statValue, { color: c.text }]}>{totalCaloriesWeek}</Text>
          <Text style={[styles.statLabel, { color: c.textTertiary }]}>cal this week</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <MaterialIcons name="timer" size={28} color={c.text} />
          <Text style={[styles.statValue, { color: c.text }]}>{totalDurationWeek}</Text>
          <Text style={[styles.statLabel, { color: c.textTertiary }]}>min this week</Text>
        </View>
      </View>

      <TouchableOpacity style={[styles.addButton, { backgroundColor: c.text, marginBottom: 16 }]} onPress={() => setShowAddModal(true)}>
        <MaterialIcons name="add" size={24} color={c.background} />
        <Text style={[styles.addButtonText, { color: c.background, marginLeft: 8 }]}>Log Workout</Text>
      </TouchableOpacity>

      <Text style={[styles.listTitle, { color: c.text }]}>Recent Workouts</Text>
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
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { marginTop: 50, marginBottom: 20, flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', marginLeft: 12 },
  subtitle: { fontSize: 16, marginTop: 4 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  typeCard: { width: '48%', aspectRatio: 1.2, borderRadius: 12, padding: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1 },
  typeName: { fontSize: 12, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  input: { borderRadius: 12, padding: 16, fontSize: 16, borderWidth: 1 },
  notesInput: { height: 100, textAlignVertical: 'top' },
  caloriesPreview: { borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 20 },
  previewLabel: { fontSize: 14 },
  previewValue: { fontSize: 32, fontWeight: 'bold', marginTop: 4 },
  addButton: { borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  addButtonText: { fontSize: 16, fontWeight: '600' },
  statsCard: { borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 20, elevation: 2 },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 40, backgroundColor: '#ccc' },
  statValue: { fontSize: 24, fontWeight: 'bold', marginTop: 8 },
  statLabel: { fontSize: 12, marginTop: 4 },
  listTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  workoutCard: { borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12, elevation: 2 },
  workoutInfo: { flex: 1 },
  workoutType: { fontSize: 16, fontWeight: '600' },
  workoutDetails: { fontSize: 14, marginTop: 4 },
  workoutNotes: { fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  emptyState: { borderRadius: 16, padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, marginTop: 12 },
});
