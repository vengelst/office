import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

/** Erlaubte Entitätstypen für die Verknüpfung von Dokumenten. */
export const DOCUMENT_ENTITY_TYPES = [
  'CUSTOMER',
  'BRANCH',
  'CONTACT',
  'PROJECT',
  'WORKER',
  'VEHICLE',
] as const;
export type DocumentEntityType = (typeof DOCUMENT_ENTITY_TYPES)[number];

/**
 * Metadaten beim Multipart-Upload (Felder neben der Datei).
 * Optionales entityType/entityId verknüpft das Dokument direkt nach dem Upload.
 */
export class UploadDocumentDto {
  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: DOCUMENT_ENTITY_TYPES })
  @IsOptional()
  @IsEnum(DOCUMENT_ENTITY_TYPES)
  entityType?: DocumentEntityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({ description: 'Logischer Storage-Pfad' })
  @IsOptional()
  @IsString()
  storagePath?: string;

  @ApiPropertyOptional({ description: 'Komma-separierte Tags' })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({ description: 'Ablaufdatum (ISO-8601)' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({ description: 'Upload-Quelle: web | camera | mobile' })
  @IsOptional()
  @IsString()
  uploadSource?: string;

  @ApiPropertyOptional({ description: 'Ziel-Ordner-ID' })
  @IsOptional()
  @IsString()
  folderId?: string;
}

/** Metadaten beim Ersetzen eines Dokuments durch eine neue Version. */
export class ReplaceDocumentDto {
  @ApiPropertyOptional({ description: 'Upload-Quelle: web | camera | mobile' })
  @IsOptional()
  @IsString()
  uploadSource?: string;

  @ApiPropertyOptional({ description: 'Komma-separierte Tags' })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({ description: 'Ablaufdatum (ISO-8601)' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}
