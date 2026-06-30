import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateInvoiceLineDto } from './create-invoice-line.dto';

export class CreateInvoiceDto {
  @ApiProperty({ enum: InvoiceType })
  @IsEnum(InvoiceType)
  invoiceType!: InvoiceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Bei OUTGOING: Rechnungsempfänger' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Bei INCOMING: Rechnungssteller' })
  @IsOptional()
  @IsString()
  subcontractorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  periodFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  periodTo?: string;

  @ApiPropertyOptional({ default: 19, description: 'MwSt-Satz in %' })
  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPartialInvoice?: boolean;

  @ApiPropertyOptional({ description: '1. Abschlag, 2. Abschlag, …' })
  @IsOptional()
  @IsInt()
  @Min(1)
  partialNumber?: number;

  @ApiPropertyOptional({ description: '% des Gesamtauftrags' })
  @IsOptional()
  @IsNumber()
  partialPercentage?: number;

  @ApiPropertyOptional({ description: 'Überschreibt Kunden-Default' })
  @IsOptional()
  @IsInt()
  @Min(0)
  paymentTermDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  issueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internalNotes?: string;

  @ApiPropertyOptional({ type: [CreateInvoiceLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineDto)
  lines?: CreateInvoiceLineDto[];
}
