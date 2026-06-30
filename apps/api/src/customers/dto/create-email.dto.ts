import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export const EMAIL_TYPES = [
  'GENERAL',
  'BILLING',
  'SERVICE',
  'SUPPORT',
  'PROJECT',
  'OTHER',
] as const;
export type EmailType = (typeof EMAIL_TYPES)[number];

export class CreateEmailDto {
  @ApiProperty({ example: 'info@kunde.de' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: EMAIL_TYPES })
  @IsEnum(EMAIL_TYPES)
  emailType!: EmailType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
