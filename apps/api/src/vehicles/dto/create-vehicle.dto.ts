import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

/** Eigentümer-Typen eines Fahrzeugs. */
export const VEHICLE_OWNER_TYPES = ['OWN', 'SUBCONTRACTOR'] as const;
/** Fahrzeug-Kategorien. */
export const VEHICLE_CATEGORIES = [
  'PKW',
  'Transporter',
  'LKW',
  'Anhänger',
] as const;
/** Kraftstoffarten. */
export const VEHICLE_FUEL_TYPES = [
  'Diesel',
  'Benzin',
  'Elektro',
  'Hybrid',
] as const;

export class CreateVehicleDto {
  @ApiProperty({ example: 'B-OF 1234' })
  @IsString()
  @MinLength(1)
  licensePlate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  make?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internalName?: string;

  @ApiPropertyOptional({ enum: VEHICLE_OWNER_TYPES })
  @IsOptional()
  @IsIn(VEHICLE_OWNER_TYPES as unknown as string[])
  ownerType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subcontractorId?: string;

  @ApiPropertyOptional({ enum: VEHICLE_CATEGORIES })
  @IsOptional()
  @IsIn(VEHICLE_CATEGORIES as unknown as string[])
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  year?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ enum: VEHICLE_FUEL_TYPES })
  @IsOptional()
  @IsIn(VEHICLE_FUEL_TYPES as unknown as string[])
  fuelType?: string;

  @ApiPropertyOptional({ description: 'Nächster TÜV/HU (ISO-Datum)' })
  @IsOptional()
  @IsISO8601()
  nextInspection?: string;

  @ApiPropertyOptional({ description: 'Versicherung Ablauf (ISO-Datum)' })
  @IsOptional()
  @IsISO8601()
  insuranceExpiry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
