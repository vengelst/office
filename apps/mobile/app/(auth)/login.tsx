import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../lib/auth-context';
import { ApiError } from '../../lib/api';

const PIN_LENGTH = 6;

export default function LoginScreen() {
  const { login } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handlePress = useCallback(
    async (digit: string) => {
      if (isLoading) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setError(null);

      const newPin = pin + digit;
      setPin(newPin);

      if (newPin.length === PIN_LENGTH) {
        setIsLoading(true);
        try {
          await login(newPin);
        } catch (err) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          if (err instanceof ApiError) {
            if (err.statusCode === 401) {
              setError('Ungültige PIN');
            } else {
              setError(`Fehler: ${err.message}`);
            }
          } else {
            setError('Verbindungsfehler – bitte erneut versuchen');
          }
          setPin('');
        } finally {
          setIsLoading(false);
        }
      }
    },
    [pin, isLoading, login],
  );

  const handleDelete = useCallback(() => {
    if (isLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  }, [isLoading]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>VIVAHOME</Text>
        <Text style={styles.subtitle}>Monteur-Kiosk</Text>
      </View>

      <View style={styles.pinSection}>
        <Text style={styles.instruction}>PIN eingeben</Text>
        <View style={styles.dotsRow}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i < pin.length && styles.dotFilled]}
            />
          ))}
        </View>
        {error && <Text style={styles.error}>{error}</Text>}
        {isLoading && (
          <ActivityIndicator
            size="small"
            color="#3b82f6"
            style={styles.loader}
          />
        )}
      </View>

      <View style={styles.keypad}>
        {[
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
          ['', '0', 'del'],
        ].map((row, rowIdx) => (
          <View key={rowIdx} style={styles.keypadRow}>
            {row.map((key) => {
              if (key === '') {
                return <View key="empty" style={styles.keyEmpty} />;
              }
              if (key === 'del') {
                return (
                  <TouchableOpacity
                    key="del"
                    style={styles.key}
                    onPress={handleDelete}
                    activeOpacity={0.6}
                    disabled={isLoading || pin.length === 0}
                  >
                    <Text style={styles.keyTextDel}>⌫</Text>
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity
                  key={key}
                  style={styles.key}
                  onPress={() => handlePress(key)}
                  activeOpacity={0.6}
                  disabled={isLoading || pin.length >= PIN_LENGTH}
                >
                  <Text style={styles.keyText}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginTop: 48,
  },
  brand: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f9fafb',
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  pinSection: {
    alignItems: 'center',
  },
  instruction: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#4b5563',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  loader: {
    marginTop: 16,
  },
  keypad: {
    gap: 12,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  key: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyEmpty: {
    width: 76,
    height: 76,
  },
  keyText: {
    fontSize: 28,
    fontWeight: '500',
    color: '#f9fafb',
  },
  keyTextDel: {
    fontSize: 24,
    color: '#9ca3af',
  },
});
