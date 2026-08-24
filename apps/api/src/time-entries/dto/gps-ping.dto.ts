/**
 * Request-Body für GPS-Punkte (Intervall, Login, Logout, Foto, Aktion).
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { GpsEventType } from '@prisma/client';

/** Erlaubte Typen über den Ping-Endpoint (CLOCK_* kommen vom Stempel). */
export const GPS_PING_EVENT_TYPES = [
  GpsEventType.MANUAL,
  GpsEventType.LOGIN,
  GpsEventType.LOGOUT,
  GpsEventType.PHOTO,
  GpsEventType.ACTION,
] as const;

export type GpsPingEventType = (typeof GPS_PING_EVENT_TYPES)[number];

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

  @ApiPropertyOptional({
    description:
      'Ereignistyp: MANUAL=Intervall, LOGIN/LOGOUT/PHOTO/ACTION. Default MANUAL.',
    enum: GPS_PING_EVENT_TYPES,
  })
  @IsOptional()
  @IsEnum(GpsEventType)
  eventType?: GpsPingEventType;
}
