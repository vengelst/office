import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BreakScopeType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateBreakRuleDto {
  @ApiProperty({ enum: BreakScopeType })
  @IsEnum(BreakScopeType)
  scopeType!: BreakScopeType;

  @ApiPropertyOptional({ description: 'Projekt-ID (nur bei scopeType=PROJECT)' })
  @ValidateIf((o: CreateBreakRuleDto) => o.scopeType === BreakScopeType.PROJECT)
  @IsString()
  @MinLength(1)
  projectId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  autoDeductEnabled?: boolean;

  @ApiProperty({ description: 'Schwellenwert 1 in Minuten' })
  @IsInt()
  @Min(0)
  thresholdMinutes1!: number;

  @ApiProperty({ description: 'Pausenabzug 1 in Minuten' })
  @IsInt()
  @Min(0)
  breakMinutes1!: number;

  @ApiPropertyOptional({ description: 'Schwellenwert 2 in Minuten' })
  @IsOptional()
  @IsInt()
  @Min(0)
  thresholdMinutes2?: number;

  @ApiPropertyOptional({ description: 'Pausenabzug 2 in Minuten' })
  @IsOptional()
  @IsInt()
  @Min(0)
  breakMinutes2?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
