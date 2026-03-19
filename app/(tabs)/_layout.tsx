import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { useUserStore } from '../../store/userStore';

function Icon({ name, color }: { name: string; color: string }) {
  const icons: Record<string, string> = {
    home: '\u2302',
    chart: '\u2593',
    settings: '\u2699',
  };
  return <Text style={{ fontSize: 22, color }}>{icons[name] || '\u2022'}</Text>;
}

export default function TabsLayout() {
  const darkMode = useUserStore((state) => state.profile?.darkMode ?? false);
  const c = darkMode ? {
    bg: '#000000', surface: '#1A1A1A', border: '#333333',
    primary: '#FFFFFF', secondary: '#B0B0B0', tertiary: '#707070'
  } : {
    bg: '#FFFFFF', surface: '#F5F5F5', border: '#E0E0E0',
    primary: '#000000', secondary: '#666666', tertiary: '#999999'
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopWidth: 1,
          borderTopColor: c.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.tertiary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Icon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <Icon name="chart" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Icon name="settings" color={color} />,
        }}
      />
    </Tabs>
  );
}
