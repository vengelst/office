/**
 * Request-Body für periodischen GPS-Ping während einer aktiven Schicht.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class GpsPingDto {
  @ApiProperty({ description: 'Monteur-ID' })
  @IsString()
  @MinLength(1)
  workerId!: string;

  @ApiProperty({ description: 'GPS-Breitengrad' })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ description: 'GPS-Längengrad' })
  @IsLongitude()
  longitude!: number;

  @ApiPropertyOptional({ description: 'GPS-Genauigkeit (Meter)' })
  @IsOptional()
  @IsNumber()
  accuracy?: number;

  @ApiPropertyOptional({ description: 'Projekt-ID (sonst offene Schicht)' })
  @IsOptional()
  @IsString()
  projectId?: string;
}
