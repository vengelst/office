import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { WORK_CARD_FIELD_TARGETS } from '../work-card-field.types';

export class WorkCardFieldMappingDto {
  @ApiProperty({ description: 'Zielfeld', enum: WORK_CARD_FIELD_TARGETS })
  @IsString()
  @IsIn(WORK_CARD_FIELD_TARGETS)
  target!: string;

  @ApiProperty({ description: 'Label-Hinweise (Überschriften auf der Karte)', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  labelHints!: string[];

  @ApiPropertyOptional({ description: 'Regex auf den Wert' })
  @IsOptional()
  @IsString()
  regex?: string;

  @ApiPropertyOptional({ description: 'Zeilen nach Label (für lange Texte)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  captureLines?: number;
}

export class CreateWorkCardTemplateDto {
  @ApiProperty({ description: 'Template-Name' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ description: 'Kunden-ID (optional)' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiProperty({ type: [WorkCardFieldMappingDto], description: 'Feldzuordnungen' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkCardFieldMappingDto)
  fields!: WorkCardFieldMappingDto[];

  @ApiPropertyOptional({ description: 'Notizen / Hinweise' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateWorkCardTemplateDto {
  @ApiPropertyOptional({ description: 'Template-Name' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ description: 'Kunden-ID (optional)' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ type: [WorkCardFieldMappingDto], description: 'Feldzuordnungen' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkCardFieldMappingDto)
  fields?: WorkCardFieldMappingDto[];

  @ApiPropertyOptional({ description: 'Notizen / Hinweise' })
  @IsOptional()
  @IsString()
  notes?: string;
}
