import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Manuelle Korrektur eines Tageseintrags. Werden firstClockInAt/lastClockOutAt
 * gesetzt, wird die Brutto-Zeit neu berechnet; breakMinutes überschreibt den
 * automatischen Pausenabzug.
 */
export class UpdateDayDto {
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
