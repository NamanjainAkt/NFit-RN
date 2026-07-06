import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useUserStore } from '../store/userStore';
import { ErrorBoundary } from './error-boundary';

export default function RootLayout() {
  const darkMode = useUserStore((state) => state.profile?.darkMode ?? false);
  const bgColor = darkMode ? '#121212' : '#F8F9FA';

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
