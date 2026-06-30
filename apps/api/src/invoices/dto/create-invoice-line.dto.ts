import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceLineType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateInvoiceLineDto {
  @ApiProperty({ enum: InvoiceLineType })
  @IsEnum(InvoiceLineType)
  lineType!: InvoiceLineType;

  @ApiProperty({ example: 'Wochenpaket KW 25' })
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  quantity?: number;

  @ApiPropertyOptional({ example: 'Std', description: 'Std, Stk, m, m², Pauschale, KW' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Reihenfolge – wird sonst ans Ende gesetzt' })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({ description: 'Referenz auf einen Wochenstundenzettel' })
  @IsOptional()
  @IsString()
  weeklyTimesheetId?: string;
}
