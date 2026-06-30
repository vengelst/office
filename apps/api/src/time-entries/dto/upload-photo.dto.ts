import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

/** Metadaten beim Multipart-Upload eines Arbeitsfotos von der Baustelle. */
export class UploadPhotoDto {
  @ApiProperty({ description: 'Monteur-ID (Uploader)' })
  @IsString()
  @MinLength(1)
  workerId!: string;

  @ApiProperty({ description: 'Projekt-ID' })
  @IsString()
  @MinLength(1)
  projectId!: string;

  @ApiPropertyOptional({ description: 'Optionaler Kommentar zum Foto' })
  @IsOptional()
  @IsString()
  comment?: string;
}
