import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateSubcontractorContactDto {
  @ApiPropertyOptional({ example: 'Herr' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ example: 'Max' })
  @IsString()
  @MinLength(1)
  firstName!: string;

  @ApiProperty({ example: 'Mustermann' })
  @IsString()
  @MinLength(1)
  lastName!: string;

  @ApiPropertyOptional({ description: 'Funktion / Position' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneMobile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneLandline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
