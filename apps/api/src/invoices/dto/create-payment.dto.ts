import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ description: 'Betrag der Zahlung' })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty({ description: 'Zahlungsdatum (ISO)' })
  @IsISO8601()
  paidDate!: string;

  @ApiPropertyOptional({ example: 'Überweisung' })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({ description: 'Buchungsreferenz' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Skonto gezogen' })
  @IsOptional()
  @IsBoolean()
  skontoApplied?: boolean;

  @ApiPropertyOptional({
    description: 'Skontobetrag – Pflicht und > 0 wenn skontoApplied',
  })
  @ValidateIf((o: CreatePaymentDto) => o.skontoApplied === true)
  @IsNumber()
  @Min(0.01)
  skontoAmount?: number;
}
