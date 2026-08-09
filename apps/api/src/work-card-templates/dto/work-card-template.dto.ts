import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { WORK_CARD_FIELD_TARGETS } from '../work-card-field.types';

export class WorkCardFieldZoneDto {
  @ApiProperty({ description: 'Linke Kante 0–1' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  x!: number;

  @ApiProperty({ description: 'Obere Kante 0–1' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  y!: number;

  @ApiProperty({ description: 'Breite 0–1' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  @Max(1)
  w!: number;

  @ApiProperty({ description: 'Höhe 0–1' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  @Max(1)
  h!: number;
}

export class WorkCardFieldMappingDto {
  @ApiProperty({ description: 'Zielfeld', enum: WORK_CARD_FIELD_TARGETS })
  @IsString()
  @IsIn(WORK_CARD_FIELD_TARGETS)
  target!: string;

  @ApiPropertyOptional({
    description: 'Label-Hinweise (Überschriften auf der Karte)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labelHints?: string[];

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

  @ApiPropertyOptional({
    description: 'Normierte Zone 0–1 auf der Beispielseite (OCR-Blöcke in der Zone bevorzugen)',
    type: WorkCardFieldZoneDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkCardFieldZoneDto)
  zone?: WorkCardFieldZoneDto;
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
  @ArrayMinSize(1)
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
