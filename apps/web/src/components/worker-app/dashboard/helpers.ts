export interface Geo {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

export function dayStart(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function initials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

/** Fragt die GPS-Position ab (Timeout 10s). Verweigerung blockiert nicht. */
export function getGeo(): Promise<Geo | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => resolve(null),
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 60000 },
    );
  });
}
