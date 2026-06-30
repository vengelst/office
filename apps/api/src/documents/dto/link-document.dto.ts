import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MinLength } from 'class-validator';
import { DOCUMENT_ENTITY_TYPES, DocumentEntityType } from './upload-document.dto';

/** Verknüpft ein bestehendes Dokument mit einer Entität. */
export class LinkDocumentDto {
  @ApiProperty({ enum: DOCUMENT_ENTITY_TYPES })
  @IsEnum(DOCUMENT_ENTITY_TYPES)
  entityType!: DocumentEntityType;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  entityId!: string;
}
