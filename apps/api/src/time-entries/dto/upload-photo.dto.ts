import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

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

  /** Relative X-Position des Kommentar-Labels (0–1), vom Client getippt. */
  @ApiPropertyOptional({ description: 'Kommentar-X relativ (0–1)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  commentX?: number;

  /** Relative Y-Position des Kommentar-Labels (0–1), vom Client getippt. */
  @ApiPropertyOptional({ description: 'Kommentar-Y relativ (0–1)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  commentY?: number;
}
