import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useUserStore } from '../store/userStore';

export default function RootLayout() {
  const darkMode = useUserStore((state) => state.profile?.darkMode ?? false);
  const bgColor = darkMode ? '#000000' : '#FFFFFF';

  return (
    <>
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
    </>
  );
}
