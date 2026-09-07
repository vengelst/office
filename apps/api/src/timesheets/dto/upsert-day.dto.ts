import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Manueller Tageseintrag (z. B. Monteur ohne Handy): Tag anlegen oder Zeiten setzen.
 */
export class UpsertDayDto {
  @ApiProperty({
    description: 'Arbeitstag (ISO-Datum oder DateTime; nur Kalendertag zählt)',
  })
  @IsString()
  @MinLength(1)
  workDate!: string;

  @ApiPropertyOptional({ description: 'Arbeitsbeginn (ISO)' })
  @IsOptional()
  @IsString()
  firstClockInAt?: string;

  @ApiPropertyOptional({ description: 'Arbeitsende (ISO)' })
  @IsOptional()
  @IsString()
  lastClockOutAt?: string;

  @ApiPropertyOptional({ description: 'Pausenminuten (überschreibt Automatik)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  breakMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  summaryComment?: string;

  @ApiPropertyOptional({ description: 'Freitext Arbeiten (Projekt-Flag)' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  workNotes?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Gewählte ProjectWorkActivity-IDs des Timesheet-Projekts',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  projectWorkActivityIds?: string[];
}
