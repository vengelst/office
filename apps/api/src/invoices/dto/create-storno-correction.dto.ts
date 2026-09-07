/**
 * DTOs für Storno (ST) und Rechnungskorrektur (KO).
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CorrectionReason, InvoiceLineType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateStornoDto {
  @ApiProperty({ enum: CorrectionReason })
  @IsEnum(CorrectionReason)
  correctionReason!: CorrectionReason;
}

export class CorrectionLineDto {
  @ApiProperty({ enum: InvoiceLineType })
  @IsEnum(InvoiceLineType)
  lineType!: InvoiceLineType;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Steuersatz % pro Zeile' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;
}

export class CreateCorrectionDto {
  @ApiProperty({ enum: CorrectionReason })
  @IsEnum(CorrectionReason)
  correctionReason!: CorrectionReason;

  @ApiPropertyOptional({
    type: [CorrectionLineDto],
    description: 'Optionale Startpositionen (Beträge als Minderung, positiv)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CorrectionLineDto)
  lines?: CorrectionLineDto[];
}
