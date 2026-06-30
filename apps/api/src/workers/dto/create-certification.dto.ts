import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCertificationDto {
  @ApiProperty({ example: 'Elektrofachkraft' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  issuedBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  issuedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  expiryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
