/**
 * Kurzer In-Memory-Cache für Preview-Payloads (TTL ~60 Min).
 */

import type { AiImportPreviewPayload } from './types';

interface CacheEntry {
  payload: AiImportPreviewPayload;
  sourceFilename: string;
  expiresAt: number;
}

const TTL_MS = 60 * 60 * 1000;

export class PreviewCache {
  private readonly map = new Map<string, CacheEntry>();

  set(
    id: string,
    payload: AiImportPreviewPayload,
    sourceFilename: string,
  ): void {
    this.cleanup();
    this.map.set(id, {
      payload,
      sourceFilename,
      expiresAt: Date.now() + TTL_MS,
    });
  }

  get(id: string): CacheEntry | null {
    const entry = this.map.get(id);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.map.delete(id);
      return null;
    }
    return entry;
  }

  delete(id: string): void {
    this.map.delete(id);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.map) {
      if (entry.expiresAt < now) this.map.delete(key);
    }
  }
}
