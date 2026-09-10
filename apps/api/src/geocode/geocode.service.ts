/**
 * Service für Geocode.
 * Kapselt die Geschäftslogik und den Datenzugriff dieser Domäne.
 */

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

/** Nominatim `address`-Objekt (Reverse-Geocoding). */
export interface NominatimAddressParts {
  road?: string;
  pedestrian?: string;
  path?: string;
  footway?: string;
  house_number?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  suburb?: string;
  city_district?: string;
  county?: string;
  state?: string;
  country?: string;
}

interface NominatimReverseResponse {
  address?: NominatimAddressParts;
  display_name?: string;
}

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'Office-App/1.0 (vivahome.de; foto-stempel)';
/** Mindestabstand zwischen zwei Nominatim-Requests (Nutzungsbedingungen: max 1/s). */
const MIN_REQUEST_INTERVAL_MS = 1000;
/** Reverse-Lookup darf Upload nicht blockieren. */
const REVERSE_TIMEOUT_MS = 3500;
/** Cache-Rundung ~11 m – genug für Foto-Stempel, weniger Nominatim-Hits. */
const REVERSE_CACHE_DECIMALS = 4;
const REVERSE_CACHE_MAX = 500;

/**
 * Baut eine kurze Ortszeile aus Nominatim-Address-Teilen.
 * Bevorzugt Straße + Ort; nie Roh-Koordinaten.
 */
export function formatPlaceLabelFromAddress(
  address: NominatimAddressParts | null | undefined,
  displayName?: string | null,
): string | null {
  if (!address) {
    const fallback = displayName?.trim();
    return fallback ? truncatePlaceLabel(fallback) : null;
  }

  const street =
    address.road?.trim() ||
    address.pedestrian?.trim() ||
    address.path?.trim() ||
    address.footway?.trim() ||
    '';
  const house = address.house_number?.trim() || '';
  const streetLine = [street, house].filter(Boolean).join(' ');

  const locality =
    address.city?.trim() ||
    address.town?.trim() ||
    address.village?.trim() ||
    address.municipality?.trim() ||
    address.suburb?.trim() ||
    address.city_district?.trim() ||
    '';

  const postcode = address.postcode?.trim() || '';
  const placePart = [postcode, locality].filter(Boolean).join(' ');

  let label = '';
  if (streetLine && placePart) {
    label = `${streetLine}, ${placePart}`;
  } else if (streetLine) {
    label = streetLine;
  } else if (placePart) {
    label = placePart;
  } else if (displayName?.trim()) {
    label = displayName.trim();
  }

  return truncatePlaceLabel(label);
}

function truncatePlaceLabel(label: string): string | null {
  const trimmed = label.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  // Stempel-Banner: lesbar halten.
  return trimmed.length > 72 ? `${trimmed.slice(0, 69)}…` : trimmed;
}

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
  /** Reverse-Cache: gerundete Koordinaten → Ortslabel (oder null = negativ). */
  private readonly reverseCache = new Map<string, string | null>();

  /**
   * Geocodiert eine Adresse bzw. sucht Koordinaten.
   *
   * @param address - Adresszeile für Geocoding (string)
   * @returns Geocode-Ergebnis (GeocodeResult)
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  async lookup(address: string): Promise<GeocodeResult> {
    const query = address?.trim();
    if (!query) {
      throw new NotFoundException('Adresse konnte nicht gefunden werden');
    }
    return this.enqueue(() => this.fetchFromNominatim(query));
  }

  /**
   * Reverse-Geocoding für Foto-Stempel: lesbarer Ort, nie Koordinaten-Text.
   * Bei Fehler/Timeout → null (Upload bleibt erfolgreich, nur Datum/Uhrzeit).
   */
  async reversePlaceLabel(
    latitude: number,
    longitude: number,
  ): Promise<string | null> {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }
    const key = `${latitude.toFixed(REVERSE_CACHE_DECIMALS)},${longitude.toFixed(REVERSE_CACHE_DECIMALS)}`;
    if (this.reverseCache.has(key)) {
      return this.reverseCache.get(key) ?? null;
    }

    try {
      const label = await this.enqueue(() =>
        this.fetchReverseFromNominatim(latitude, longitude),
      );
      this.putReverseCache(key, label);
      return label;
    } catch (err) {
      this.logger.warn(
        `Reverse-Geocoding fehlgeschlagen (${key}): ${String(err)}`,
      );
      this.putReverseCache(key, null);
      return null;
    }
  }

  private putReverseCache(key: string, label: string | null): void {
    if (this.reverseCache.size >= REVERSE_CACHE_MAX) {
      const first = this.reverseCache.keys().next().value;
      if (first != null) this.reverseCache.delete(first);
    }
    this.reverseCache.set(key, label);
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

  /**
   * Interner Helfer: Forward-Suche bei Nominatim.
   *
   * @param query - Query-Parameter der Anfrage (string)
   * @returns GeocodeResult
   * @throws {NotFoundException} Wenn der Datensatz nicht gefunden wird
   */
  private async fetchFromNominatim(query: string): Promise<GeocodeResult> {
    const url = `${NOMINATIM_SEARCH_URL}?format=json&q=${encodeURIComponent(
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

  private async fetchReverseFromNominatim(
    latitude: number,
    longitude: number,
  ): Promise<string | null> {
    const url =
      `${NOMINATIM_REVERSE_URL}?format=json&lat=${encodeURIComponent(String(latitude))}` +
      `&lon=${encodeURIComponent(String(longitude))}&zoom=18&addressdetails=1`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REVERSE_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        this.logger.warn(
          `Nominatim reverse Status ${response.status} für ${latitude},${longitude}`,
        );
        return null;
      }
      const data = (await response.json()) as NominatimReverseResponse;
      return formatPlaceLabelFromAddress(data.address, data.display_name);
    } finally {
      clearTimeout(timer);
    }
  }
}
