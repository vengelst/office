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
import { TimeEntryType } from '@prisma/client';

const MANUAL_TYPES = [
  TimeEntryType.CLOCK_IN,
  TimeEntryType.CLOCK_OUT,
  TimeEntryType.BREAK_START,
  TimeEntryType.BREAK_END,
  TimeEntryType.MANUAL_ADJUSTMENT,
] as const;

/** Manuelles Stempel-Event durchs Büro. */
export class ManualEntryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  workerId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  projectId!: string;

  @ApiProperty({ enum: MANUAL_TYPES })
  @IsEnum(TimeEntryType)
  entryType!: TimeEntryType;

  @ApiProperty({ description: 'Zeitpunkt (ISO)' })
  @IsString()
  @MinLength(1)
  occurredAtClient!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  accuracy?: number;
}

/** Korrektur eines bestehenden Events. */
export class UpdateEntryDto {
  @ApiPropertyOptional({ description: 'Neuer Zeitpunkt (ISO)' })
  @IsOptional()
  @IsString()
  occurredAtClient?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}
