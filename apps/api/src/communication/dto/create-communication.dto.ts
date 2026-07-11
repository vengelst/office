import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CommunicationDirection,
  CommunicationEntityType,
  CommunicationType,
} from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateCommunicationDto {
  @ApiProperty({ enum: CommunicationEntityType })
  @IsEnum(CommunicationEntityType)
  entityType!: CommunicationEntityType;

  @ApiProperty({ example: 'cuid...' })
  @IsString()
  entityId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactId?: string;

  @ApiProperty({ enum: CommunicationType })
  @IsEnum(CommunicationType)
  type!: CommunicationType;

  @ApiPropertyOptional({ enum: CommunicationDirection })
  @IsOptional()
  @IsEnum(CommunicationDirection)
  direction?: CommunicationDirection;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  content!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsInt()
  duration?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  createdBy?: string;
}
