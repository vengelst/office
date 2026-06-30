import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsNumber, IsOptional, IsString, Min } from 'class-validator';

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
}
