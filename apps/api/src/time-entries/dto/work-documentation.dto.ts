import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class WorkDocumentationDto {
  @ApiProperty({ type: [String], description: 'IDs von ProjectWorkActivity' })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  projectWorkActivityIds!: string[];

  @ApiPropertyOptional({ description: 'Freitext Arbeiten (wenn Projekt-Flag an)' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  workNotes?: string;
}
