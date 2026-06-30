import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceType } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class GenerateFromTimesheetsDto {
  @ApiProperty({ description: 'Projekt-ID' })
  @IsString()
  @MinLength(1)
  projectId!: string;

  @ApiProperty({ description: 'Zeitraum von (ISO-Datum)' })
  @IsISO8601()
  periodFrom!: string;

  @ApiProperty({ description: 'Zeitraum bis (ISO-Datum)' })
  @IsISO8601()
  periodTo!: string;

  @ApiProperty({ enum: InvoiceType })
  @IsEnum(InvoiceType)
  invoiceType!: InvoiceType;

  @ApiPropertyOptional({ description: 'Pflicht bei INCOMING: Subunternehmen' })
  @IsOptional()
  @IsString()
  subcontractorId?: string;

  @ApiPropertyOptional({ default: 19, description: 'MwSt-Satz in %' })
  @IsOptional()
  @IsNumber()
  taxRate?: number;
}
