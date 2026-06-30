import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

/** Erzeugt einen neuen Dokument-Ordner für eine Entität. */
export class CreateDocumentFolderDto {
  @ApiProperty({ description: 'z.B. CUSTOMER, PROJECT, WORKER, VEHICLE' })
  @IsString()
  @MinLength(1)
  entityType!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  entityId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ description: 'Übergeordneter Ordner' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
