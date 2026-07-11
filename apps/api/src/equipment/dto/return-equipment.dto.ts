import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { EQUIPMENT_CONDITIONS } from './create-equipment.dto';

export class ReturnEquipmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  returnNotes?: string;

  @ApiPropertyOptional({ enum: EQUIPMENT_CONDITIONS })
  @IsOptional()
  @IsIn(EQUIPMENT_CONDITIONS as unknown as string[])
  returnCondition?: string;
}
