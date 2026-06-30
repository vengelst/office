import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SignerType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class SignTimesheetDto {
  @ApiProperty({ enum: SignerType })
  @IsEnum(SignerType)
  signerType!: SignerType;

  @ApiProperty({ description: 'Name des Unterzeichners' })
  @IsString()
  @MinLength(1)
  signerName!: string;

  @ApiPropertyOptional({ description: 'Rolle/Funktion des Unterzeichners' })
  @IsOptional()
  @IsString()
  signerRole?: string;

  @ApiProperty({
    description: 'Signatur als Base64-PNG (Data-URL oder reiner Base64-String)',
  })
  @IsString()
  @MinLength(1)
  signatureBase64!: string;
}
