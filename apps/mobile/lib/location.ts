import * as Location from 'expo-location';

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentPosition(): Promise<GeoPosition | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return null;

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy ?? undefined,
    };
  } catch {
    return null;
  }
}
