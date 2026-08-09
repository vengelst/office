import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

/**
 * Normalisiert IDs aus JSON (Array) und Multipart (komma-separierter String
 * oder mehrfach gesendetes Feld) auf ein String-Array.
 */
const toIdArray = ({ value }: { value: unknown }): string[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const ids = raw.map((v) => String(v).trim()).filter((v) => v.length > 0);
  return ids.length > 0 ? ids : undefined;
};

/** Boolean aus Multipart-Strings ("true"/"1") ableiten. */
const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (typeof value === 'string') {
    if (['true', '1', 'yes'].includes(value.toLowerCase())) return true;
    if (['false', '0', 'no'].includes(value.toLowerCase())) return false;
  }
  return value;
};

/** Fertigmeldung: mindestens 2 Fotos (Upload und/oder bereits vorhandene Dokumente). */
export class CompleteReportDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({
    description:
      'IDs bereits hochgeladener Foto-Dokumente (Array oder komma-separiert). ' +
      'Zählen zusammen mit den Multipart-Dateien auf das Minimum von 2 Fotos.',
  })
  @IsOptional()
  @Transform(toIdArray)
  @IsArray()
  @IsString({ each: true })
  documentIds?: string[];
}

/** Nacharbeit-Meldung: Kommentar und Fotos optional. */
export class ReworkReportDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ description: 'IDs bereits hochgeladener Foto-Dokumente' })
  @IsOptional()
  @Transform(toIdArray)
  @IsArray()
  @IsString({ each: true })
  documentIds?: string[];
}

/** Prüfung / Fertigsetzung durch den Kunden-PL. */
export class ReviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}

/** Start einer Item-Zeitsession ("aktuelles Item"). */
export class StartSessionDto {
  @ApiPropertyOptional({
    description: 'Startzeitpunkt (ISO-8601); Default = jetzt',
  })
  @IsOptional()
  @IsISO8601()
  startedAt?: string;
}

/** Stopp einer Item-Zeitsession. */
export class StopSessionDto {
  @ApiPropertyOptional({
    description: 'Endzeitpunkt (ISO-8601); Default = jetzt',
  })
  @IsOptional()
  @IsISO8601()
  endedAt?: string;
}

/** Kunden-PL einem Projekt zuordnen. */
export class CreateCustomerPlDto {
  @ApiPropertyOptional({ description: 'User-ID mit Rolle CUSTOMER_PL' })
  @IsString()
  @MinLength(1)
  userId!: string;
}

/**
 * Kunden-PL-Zuordnung aktualisieren (z. B. Zustell-E-Mail für
 * Stundenzettel-PDFs nach Approve).
 */
export class UpdateCustomerPlDto {
  @ApiPropertyOptional({
    description:
      'Zustell-E-Mail für Stundenzettel-PDF; null/leer = Fallback auf User-E-Mail',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsEmail()
  notificationEmail?: string | null;
}

/** Optionen des Excel-/CSV-Imports (Multipart-Felder neben den Dateien). */
export class ImportWorkItemsDto {
  @ApiPropertyOptional({
    default: false,
    description: 'Nur prüfen und Vorschau liefern, nichts schreiben',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  dryRun?: boolean;

  @ApiPropertyOptional({
    default: true,
    description: 'Projekt automatisch auf itemBased=true setzen',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  setItemBased?: boolean;

  @ApiPropertyOptional({
    description: 'Nur diese Spalten-Trennzeichen für CSV erzwingen (Default: Autoerkennung)',
  })
  @IsOptional()
  @IsString()
  csvDelimiter?: string;
}

/** Filter der Monteur-Item-Liste. */
export class MyWorkItemsQueryDto {
  @ApiPropertyOptional({ description: 'Nur Items dieses Projekts' })
  @IsOptional()
  @IsString()
  projectId?: string;
}

/** Filter der Item-Liste. */
export class ListWorkItemsQueryDto {
  @ApiPropertyOptional({ description: 'Status-Filter, mehrere komma-separiert' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Block-Kennung' })
  @IsOptional()
  @IsString()
  blockKey?: string;

  @ApiPropertyOptional({ description: 'Suche in itemKey/title/room' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ default: 200 })
  @IsOptional()
  @Type(() => Number)
  take?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  skip?: number;
}
