import { Injectable, Logger, NotFoundException } from '@nestjs/common';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  mapsUrl: string;
}

interface NominatimEntry {
  lat: string;
  lon: string;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'Office-App/1.0';
/** Mindestabstand zwischen zwei Nominatim-Requests (Nutzungsbedingungen: max 1/s). */
const MIN_REQUEST_INTERVAL_MS = 1000;

/**
 * Proxy zur OpenStreetMap-Nominatim-Geokodierung.
 * Einfacher in-memory Throttle: serialisiert Requests mit >= 1s Abstand.
 */
@Injectable()
export class GeocodeService {
  private readonly logger = new Logger(GeocodeService.name);
  /** Zeitpunkt des letzten ausgehenden Requests (Throttle-Anker). */
  private lastRequestAt = 0;
  /** Serialisiert konkurrierende Requests, damit der Abstand eingehalten wird. */
  private queue: Promise<unknown> = Promise.resolve();

  async lookup(address: string): Promise<GeocodeResult> {
    const query = address?.trim();
    if (!query) {
      throw new NotFoundException('Adresse konnte nicht gefunden werden');
    }
    return this.enqueue(() => this.fetchFromNominatim(query));
  }

  /** Hängt eine Aufgabe an die Throttle-Queue und wartet ggf. das Intervall ab. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const wait = this.lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now();
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
      this.lastRequestAt = Date.now();
      return task();
    });
    // Queue darf nicht durch einen Fehler abreißen.
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async fetchFromNominatim(query: string): Promise<GeocodeResult> {
    const url = `${NOMINATIM_URL}?format=json&q=${encodeURIComponent(
      query,
    )}&limit=1`;

    let entries: NominatimEntry[];
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
      });
      if (!response.ok) {
        this.logger.warn(`Nominatim antwortete mit Status ${response.status}`);
        throw new NotFoundException('Adresse konnte nicht gefunden werden');
      }
      entries = (await response.json()) as NominatimEntry[];
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error(`Geocoding-Anfrage fehlgeschlagen: ${String(err)}`);
      throw new NotFoundException('Adresse konnte nicht gefunden werden');
    }

    const first = entries?.[0];
    if (!first) {
      throw new NotFoundException('Adresse konnte nicht gefunden werden');
    }

    const latitude = Number(first.lat);
    const longitude = Number(first.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new NotFoundException('Adresse konnte nicht gefunden werden');
    }

    return {
      latitude,
      longitude,
      mapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    };
  }
}
