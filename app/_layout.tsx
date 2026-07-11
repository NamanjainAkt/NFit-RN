import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useUserStore } from '../store/userStore';
import { useFitnessStore } from '../store/fitnessStore';
import { ErrorBoundary } from './error-boundary';

export default function RootLayout() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const userHydrated = useUserStore.persist.hasHydrated();
    const fitnessHydrated = useFitnessStore.persist.hasHydrated();
    if (userHydrated && fitnessHydrated) {
      setHydrated(true);
      return;
    }
    const unsubUser = useUserStore.persist.onFinishHydration(() => {
      if (useFitnessStore.persist.hasHydrated()) setHydrated(true);
    });
    const unsubFitness = useFitnessStore.persist.onFinishHydration(() => {
      if (useUserStore.persist.hasHydrated()) setHydrated(true);
    });
    return () => { unsubUser(); unsubFitness(); };
  }, []);

  const darkMode = useUserStore((state) => state.profile?.darkMode ?? false);
  const bgColor = darkMode ? '#121212' : '#F8F9FA';

  if (!hydrated) return null;

  return (
    <ErrorBoundary>
      <StatusBar style={darkMode ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: bgColor },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      </Stack>
    </ErrorBoundary>
  );
}
