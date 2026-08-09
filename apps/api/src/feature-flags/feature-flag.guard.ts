/**
 * Guard: prüft `@RequireFeature()` gegen AppSetting `feature_flags`.
 */

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_FLAG_KEY } from './require-feature.decorator';
import type { FeatureFlagKey } from './feature-flags.constants';
import { FeatureFlagsService } from './feature-flags.service';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const key = this.reflector.getAllAndOverride<FeatureFlagKey | undefined>(
      FEATURE_FLAG_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!key) return true;

    const enabled = await this.featureFlags.isEnabled(key);
    if (!enabled) {
      throw new ForbiddenException(`Modul „${key}“ ist deaktiviert`);
    }
    return true;
  }
}
