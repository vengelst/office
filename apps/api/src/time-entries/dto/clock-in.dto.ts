import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class ClockInDto {
  @ApiProperty({ description: 'Monteur-ID' })
  @IsString()
  @MinLength(1)
  workerId!: string;

  @ApiProperty({ description: 'Projekt-ID' })
  @IsString()
  @MinLength(1)
  projectId!: string;

  @ApiPropertyOptional({ description: 'GPS-Breitengrad' })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ description: 'GPS-Längengrad' })
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ description: 'GPS-Genauigkeit (Meter)' })
  @IsOptional()
  @IsNumber()
  accuracy?: number;

  @ApiPropertyOptional({ description: 'Zeitpunkt laut Client (ISO)' })
  @IsOptional()
  @IsString()
  occurredAtClient?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ description: 'Geräteinfo (z.B. UserAgent)' })
  @IsOptional()
  @IsString()
  sourceDevice?: string;

  @ApiPropertyOptional({
    description: 'Client-Event-UUID (Offline-Idempotenz, UUID v4)',
  })
  @IsOptional()
  @IsUUID('4')
  clientEventId?: string;

  @ApiPropertyOptional({
    description:
      'Legacy-Tätigkeitskatalog (weiterhin erlaubt). Bevorzugt projectWorkActivityId / customWorkLabel.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  activityTypeId?: string;

  @ApiPropertyOptional({
    description: 'Projekt-Arbeit (ProjectWorkActivity) – bevorzugte Stempel-Auswahl',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  projectWorkActivityId?: string;

  @ApiPropertyOptional({
    description:
      'Eigene Tätigkeit als Kurztext – wird am Projekt als Arbeit angelegt/wiederverwendet',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  customWorkLabel?: string;
}
