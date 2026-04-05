import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/store/authStore';

export default function RootLayout() {
  const loadToken = useAuthStore((state) => state.loadToken);

  useEffect(() => {
    loadToken();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0f172a' },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="machine/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="inspection/[machineId]" options={{ presentation: 'card' }} />
        <Stack.Screen name="inspection-detail/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="scanner" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="template/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="new-template" options={{ presentation: 'card' }} />
        <Stack.Screen name="new-machine" options={{ presentation: 'card' }} />
      </Stack>
    </>
  );
}
