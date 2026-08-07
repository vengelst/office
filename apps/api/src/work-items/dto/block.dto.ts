import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

/** Neuen Block (PDF-Gruppe) am Projekt anlegen. */
export class CreateBlockDto {
  @ApiProperty({ example: 'Block-1', description: 'Eindeutig je Projekt' })
  @IsString()
  @MinLength(1)
  blockKey!: string;

  @ApiPropertyOptional({ example: 'Geschoss 5 – Bereich A' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Document-ID des Block-PDFs' })
  @IsOptional()
  @IsString()
  pdfDocumentId?: string;
}

/** Block bearbeiten (z.B. PDF nachträglich verknüpfen). */
export class UpdateBlockDto extends PartialType(CreateBlockDto) {}
