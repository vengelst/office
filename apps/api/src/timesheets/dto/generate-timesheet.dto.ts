import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Max, Min, MinLength } from 'class-validator';

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

  @ApiProperty({ example: 26, description: 'ISO-Kalenderwoche (1–53)' })
  @IsInt()
  @Min(1)
  @Max(53)
  weekNumber!: number;
}
