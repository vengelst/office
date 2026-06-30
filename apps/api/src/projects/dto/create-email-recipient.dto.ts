import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export const RECIPIENT_TYPES = ['ACCOUNTING', 'PROJECT_LEAD', 'CC'] as const;
export type RecipientType = (typeof RECIPIENT_TYPES)[number];

export class CreateEmailRecipientDto {
  @ApiProperty({ example: 'buchhaltung@example.de' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'ACCOUNTING' })
  @IsString()
  recipientType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;
}
