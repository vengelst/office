import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** Einzelnes Work Item manuell anlegen (Regelfall ist der Excel-Import). */
export class CreateWorkItemDto {
  @ApiProperty({ example: '05-A-01', description: 'Kennung, eindeutig je Projekt' })
  @IsString()
  @MinLength(1)
  itemKey!: string;

  @ApiPropertyOptional({ description: 'Block-Kennung; wird bei Bedarf angelegt' })
  @IsOptional()
  @IsString()
  blockKey?: string;

  @ApiPropertyOptional({ example: 'TAS Arbeitskarte 05-A-01' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: '5' })
  @IsOptional()
  @IsString()
  floor?: string;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  area?: string;

  @ApiPropertyOptional({ example: 'Lift Lobby' })
  @IsOptional()
  @IsString()
  room?: string;

  @ApiPropertyOptional({ example: '1uZsFZ(A)' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: '3' })
  @IsOptional()
  @IsString()
  rc?: string;

  @ApiPropertyOptional({ example: '(05-A-01)' })
  @IsOptional()
  @IsString()
  detail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  planPage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sheetNo?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sheetTotal?: number;

  @ApiPropertyOptional({ example: 'block-1.pdf' })
  @IsOptional()
  @IsString()
  pdfFile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pdfPage?: number;

  @ApiPropertyOptional({ description: 'Arbeitsumfang Deutsch' })
  @IsOptional()
  @IsString()
  workScopeDe?: string;

  @ApiPropertyOptional({ description: 'Arbeitsumfang Slowakisch' })
  @IsOptional()
  @IsString()
  workScopeSk?: string;
}

/** Work Item bearbeiten (Metadaten; Status läuft über den Workflow). */
export class UpdateWorkItemDto extends PartialType(CreateWorkItemDto) {}

/** Eine Materialzeile eines Work Items. */
export class MaterialLineDto {
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ example: '1', description: 'Menge oder Hinweis ("n. Detail")' })
  @IsOptional()
  @IsString()
  qty?: string;

  @ApiPropertyOptional({ example: 'Stk.' })
  @IsOptional()
  @IsString()
  qtyUnit?: string;

  @ApiProperty({ example: 'Türverteiler TV inkl. 40-DA-Anschluss' })
  @IsString()
  @MinLength(1)
  materialDe!: string;

  @ApiPropertyOptional({ example: 'dverový rozvádzač TV' })
  @IsOptional()
  @IsString()
  materialSk?: string;
}

/** Materialliste eines Work Items vollständig ersetzen. */
export class ReplaceMaterialsDto {
  @ApiProperty({ type: [MaterialLineDto] })
  @ValidateNested({ each: true })
  @Type(() => MaterialLineDto)
  materials!: MaterialLineDto[];
}
