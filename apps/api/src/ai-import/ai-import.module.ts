import { Module } from '@nestjs/common';
import { AppSettingsModule } from '../app-settings/app-settings.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiAssistantService } from './ai-assistant.service';
import { AiImportController } from './ai-import.controller';
import { AiImportService } from './ai-import.service';
import { AiSettingsController } from './ai-settings.controller';
import { BranchEnrichmentService } from './branch-enrichment.service';
import { FileExtractService } from './file-extract.service';

@Module({
  imports: [AppSettingsModule, PrismaModule],
  controllers: [AiSettingsController, AiImportController],
  providers: [
    AiAssistantService,
    AiImportService,
    FileExtractService,
    BranchEnrichmentService,
  ],
  exports: [AiAssistantService],
})
export class AiImportModule {}
