import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export const CONTACT_METHODS = ['EMAIL', 'PHONE', 'MOBILE'] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];

export class CreateContactDto {
  @ApiPropertyOptional({ example: 'Frau' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ example: 'Erika' })
  @IsString()
  @MinLength(1)
  firstName!: string;

  @ApiProperty({ example: 'Muster' })
  @IsString()
  @MinLength(1)
  lastName!: string;

  @ApiPropertyOptional({ description: 'Funktion / Position' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

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
  addressLine1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: '1985-04-23' })
  @IsOptional()
  @IsISO8601()
  birthday?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkedInUrl?: string;

  @ApiPropertyOptional({ enum: CONTACT_METHODS })
  @IsOptional()
  @IsEnum(CONTACT_METHODS)
  preferredContactMethod?: ContactMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAccountingContact?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isProjectContact?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSignatory?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
