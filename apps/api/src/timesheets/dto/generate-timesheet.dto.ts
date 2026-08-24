import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class GenerateTimesheetDto {
  @ApiProperty({ description: 'Monteur-ID' })
  @IsString()
  @MinLength(1)
  workerId!: string;

  @ApiProperty({ description: 'Projekt-ID' })
  @IsString()
  @MinLength(1)
  projectId!: string;

  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  weekYear!: number;

  @ApiProperty({ example: 26, description: 'ISO-Kalenderwoche von (1–53)' })
  @IsInt()
  @Min(1)
  @Max(53)
  weekNumber!: number;

  @ApiPropertyOptional({
    example: 28,
    description:
      'Optional: bis Kalenderwoche (inkl.). Mehrere Wochen werden nacheinander generiert/aktualisiert.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(53)
  weekNumberTo?: number;
}
