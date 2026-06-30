import { Module } from '@nestjs/common';
import { BreakRulesController } from './break-rules.controller';
import { BreakRulesService } from './break-rules.service';

@Module({
  controllers: [BreakRulesController],
  providers: [BreakRulesService],
  exports: [BreakRulesService],
})
export class BreakRulesModule {}
