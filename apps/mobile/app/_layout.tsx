import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../lib/auth-context';
import { AppUpdateGate } from '../components/app-update-gate';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        {!__DEV__ && <AppUpdateGate />}
        <Slot />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
