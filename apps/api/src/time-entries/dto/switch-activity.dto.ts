import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

/** Tätigkeit/Arbeit während der Schicht wechseln (ohne Ausstempeln). */
export class SwitchActivityDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  workerId!: string;

  @ApiPropertyOptional({
    description: 'Legacy ActivityType – optional wenn Projekt-Arbeit gesetzt',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  activityTypeId?: string;

  @ApiPropertyOptional({ description: 'Projekt-Arbeit (ProjectWorkActivity)' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  projectWorkActivityId?: string;

  @ApiPropertyOptional({
    description: 'Eigene Tätigkeit – Find-or-Create am Projekt',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  customWorkLabel?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  occurredAtClient?: string;
}
