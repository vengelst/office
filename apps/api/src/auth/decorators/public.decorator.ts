/**
 * Decorator `@Public()`: markiert Routen als öffentlich (ohne JWT-Pflicht).
 */

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Markiert eine Route als öffentlich (kein JWT erforderlich).
 *
 * @returns MethodDecorator & ClassDecorator
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
