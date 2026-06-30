import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateBankAccountDto {
  @ApiProperty({ example: 'Sparkasse Berlin' })
  @IsString()
  @MinLength(1)
  bankName!: string;

  @ApiProperty({ example: 'DE89370400440532013000' })
  @IsString()
  @MinLength(15)
  @MaxLength(34)
  iban!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bic?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountHolder?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
