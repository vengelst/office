import { ApiPropertyOptional } from '@nestjs/swagger';
import { LanguageProficiency } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateLanguageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  language?: string;

  @ApiPropertyOptional({ enum: LanguageProficiency })
  @IsOptional()
  @IsEnum(LanguageProficiency)
  proficiency?: LanguageProficiency;
}
