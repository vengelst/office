import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** Boolean aus Multipart-Strings ("true"/"1") ableiten. */
const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (typeof value === 'string') {
    if (['true', '1', 'yes'].includes(value.toLowerCase())) return true;
    if (['false', '0', 'no'].includes(value.toLowerCase())) return false;
  }
  return value;
};

/** Multipart-Felder neben der PDF-Datei bei Preview. */
export class PdfImportPreviewDto {
  @ApiProperty({ description: 'Block-Kennung (neu oder bestehend)' })
  @IsString()
  @MinLength(1)
  blockKey!: string;

  @ApiPropertyOptional({ description: 'Anzeigename des Blocks' })
  @IsOptional()
  @IsString()
  blockName?: string;

  @ApiPropertyOptional({ default: 'Seite-', description: 'Präfix für Platzhalter-Kennungen' })
  @IsOptional()
  @IsString()
  itemKeyPrefix?: string;

  @ApiPropertyOptional({ default: 1, description: 'Ab Seite (inklusiv)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  startPage?: number;

  @ApiPropertyOptional({ description: 'Bis Seite (inklusiv, Default: letzte)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  endPage?: number;

  @ApiPropertyOptional({ default: true, description: 'Projekt auf itemBased=true setzen' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  setItemBased?: boolean;

  @ApiPropertyOptional({ description: 'Template-ID für OCR-Extraktion' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({ default: true, description: 'Extraktion durchführen (default true wenn templateId gesetzt)' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  extract?: boolean;
}

/** Ein Item in der Commit-Liste. */
export class PdfImportItemDto {
  @ApiProperty({ description: 'Seitennummer im PDF' })
  @IsInt()
  @Min(1)
  pdfPage!: number;

  @ApiProperty({ description: 'Kennung (eindeutig im Projekt)' })
  @IsString()
  @MinLength(1)
  itemKey!: string;

  @ApiPropertyOptional({ description: 'Titel/Anzeigename' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Arbeitsinhalt (DE)' })
  @IsOptional()
  @IsString()
  workScopeDe?: string;

  @ApiPropertyOptional({ description: 'Arbeitsinhalt (SK)' })
  @IsOptional()
  @IsString()
  workScopeSk?: string;

  @ApiPropertyOptional({ description: 'Geschoss' })
  @IsOptional()
  @IsString()
  floor?: string;

  @ApiPropertyOptional({ description: 'Raum' })
  @IsOptional()
  @IsString()
  room?: string;
}

/** Body des Commit-Endpunkts (als JSON-Feld im Multipart oder als JSON-Body). */
export class PdfImportCommitDto {
  @ApiProperty({ description: 'Block-Kennung' })
  @IsString()
  @MinLength(1)
  blockKey!: string;

  @ApiPropertyOptional({ description: 'Anzeigename des Blocks' })
  @IsOptional()
  @IsString()
  blockName?: string;

  @ApiPropertyOptional({ description: 'Bestehende Document-ID des PDFs (wenn bereits hochgeladen)' })
  @IsOptional()
  @IsString()
  pdfDocumentId?: string;

  @ApiPropertyOptional({ default: true, description: 'Projekt auf itemBased=true setzen' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  setItemBased?: boolean;

  @ApiProperty({ type: [PdfImportItemDto], description: 'Items mit editierten Kennungen/Titeln' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PdfImportItemDto)
  items!: PdfImportItemDto[];
}
