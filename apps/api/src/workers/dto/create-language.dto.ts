import { ApiProperty } from '@nestjs/swagger';
import { LanguageProficiency } from '@prisma/client';
import { IsEnum, IsString, MinLength } from 'class-validator';

export class CreateLanguageDto {
  @ApiProperty({ example: 'Deutsch' })
  @IsString()
  @MinLength(1)
  language!: string;

  @ApiProperty({ enum: LanguageProficiency })
  @IsEnum(LanguageProficiency)
  proficiency!: LanguageProficiency;
}
