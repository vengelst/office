import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBackupConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 23 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  scheduleHour?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 59 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(59)
  scheduleMinute?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 365 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  retentionDays?: number;
}

export class RestoreBackupDto {
  @ApiProperty({
    type: [String],
    description:
      'Module: todos, customers, projects, workers, teams, subcontractors, vehicles, equipment, timesheets, documents, invoices',
  })
  @IsArray()
  @IsString({ each: true })
  modules!: string[];
}
