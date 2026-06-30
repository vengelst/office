import { Module } from '@nestjs/common';
import { AppSettingsModule } from '../app-settings/app-settings.module';
import { EmailService } from './email.service';
import { EmailSettingsController } from './email-settings.controller';

@Module({
  imports: [AppSettingsModule],
  controllers: [EmailSettingsController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
