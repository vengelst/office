import { PartialType } from '@nestjs/swagger';
import { CreateBreakRuleDto } from './create-break-rule.dto';

export class UpdateBreakRuleDto extends PartialType(CreateBreakRuleDto) {}
