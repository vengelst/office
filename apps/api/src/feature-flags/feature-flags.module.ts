/**
 * Modul Feature-Flags: Service, Controller, Guard.
 */

import { Global, Module } from '@nestjs/common';
import { AppSettingsModule } from '../app-settings/app-settings.module';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureFlagGuard } from './feature-flag.guard';

@Global()
@Module({
  imports: [AppSettingsModule],
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagsService, FeatureFlagGuard],
  exports: [FeatureFlagsService, FeatureFlagGuard],
})
export class FeatureFlagsModule {}
