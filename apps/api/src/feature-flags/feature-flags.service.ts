/**
 * Service für Feature-Flags (AppSetting key `feature_flags`).
 */

import { Injectable } from '@nestjs/common';
import { AppSettingsService } from '../app-settings/app-settings.service';
import {
  FEATURE_FLAGS_KEY,
  FeatureFlagKey,
  FeatureFlags,
  mergeFeatureFlags,
} from './feature-flags.constants';

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly settings: AppSettingsService) {}

  /**
   * Liefert alle Feature-Flags inkl. Defaults (fehlende Keys → true).
   */
  async getFlags(): Promise<FeatureFlags> {
    const raw = await this.settings.get(FEATURE_FLAGS_KEY);
    if (!raw) return mergeFeatureFlags(null);
    try {
      return mergeFeatureFlags(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      return mergeFeatureFlags(null);
    }
  }

  /**
   * Speichert Flags (Merge mit bestehenden/Defaults).
   */
  async setFlags(
    patch: Partial<Record<FeatureFlagKey, boolean>>,
  ): Promise<FeatureFlags> {
    const current = await this.getFlags();
    const next = mergeFeatureFlags({ ...current, ...patch });
    await this.settings.set(FEATURE_FLAGS_KEY, JSON.stringify(next));
    return next;
  }

  /** Prüft, ob ein Flag aktiv ist (Default true). */
  async isEnabled(key: FeatureFlagKey): Promise<boolean> {
    const flags = await this.getFlags();
    return flags[key] !== false;
  }
}
