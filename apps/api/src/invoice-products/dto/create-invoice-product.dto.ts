import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateInvoiceProductDto {
  @ApiPropertyOptional({ example: 'STD-01' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: 'Montage Stunde' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ example: 'Std' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultUnitPrice?: number;

  @ApiPropertyOptional({ description: 'Default-MwSt in %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultTaxRate?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
