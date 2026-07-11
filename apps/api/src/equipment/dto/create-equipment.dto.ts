import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export const EQUIPMENT_STATUSES = [
  'AVAILABLE',
  'ASSIGNED',
  'IN_REPAIR',
  'RETIRED',
] as const;

export const EQUIPMENT_CONDITIONS = [
  'NEW',
  'GOOD',
  'FAIR',
  'POOR',
  'DEFECTIVE',
] as const;

export class CreateEquipmentDto {
  @ApiProperty({ example: 'Bohrmaschine Hilti TE 70' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Werkzeug' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inventoryNumber?: string;

  @ApiPropertyOptional({ description: 'Kaufdatum (ISO-Datum)' })
  @IsOptional()
  @IsISO8601()
  purchaseDate?: string;

  @ApiPropertyOptional({ description: 'Kaufpreis in Euro' })
  @IsOptional()
  @IsNumber()
  purchasePrice?: number;

  @ApiPropertyOptional({ enum: EQUIPMENT_STATUSES })
  @IsOptional()
  @IsIn(EQUIPMENT_STATUSES as unknown as string[])
  status?: string;

  @ApiPropertyOptional({ enum: EQUIPMENT_CONDITIONS })
  @IsOptional()
  @IsIn(EQUIPMENT_CONDITIONS as unknown as string[])
  condition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
