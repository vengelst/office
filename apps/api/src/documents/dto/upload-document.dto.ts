import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

/** Erlaubte Entitätstypen für die Verknüpfung von Dokumenten. */
export const DOCUMENT_ENTITY_TYPES = ['CUSTOMER', 'BRANCH', 'CONTACT'] as const;
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
}
