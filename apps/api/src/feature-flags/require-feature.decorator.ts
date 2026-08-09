/**
 * Decorator `@RequireFeature(key)` – verlangt aktiviertes Feature-Flag.
 */

import { SetMetadata } from '@nestjs/common';
import type { FeatureFlagKey } from '../feature-flags/feature-flags.constants';

export const FEATURE_FLAG_KEY = 'feature_flag';

/**
 * Markiert Controller/Handler mit einem erforderlichen Feature-Flag.
 * Der FeatureFlagGuard liefert 403, wenn das Flag false ist.
 */
export const RequireFeature = (
  key: FeatureFlagKey,
): MethodDecorator & ClassDecorator => SetMetadata(FEATURE_FLAG_KEY, key);
