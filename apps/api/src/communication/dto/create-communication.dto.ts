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
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateCommunicationDto {
  @ApiProperty({ enum: CommunicationEntityType })
  @IsEnum(CommunicationEntityType)
  @IsNotEmpty()
  entityType!: CommunicationEntityType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  entityId!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  contactId?: string;

  @ApiProperty({ enum: CommunicationType })
  @IsEnum(CommunicationType)
  @IsNotEmpty()
  type!: CommunicationType;

  @ApiPropertyOptional({ enum: CommunicationDirection, default: 'OUTGOING' })
  @IsEnum(CommunicationDirection)
  @IsOptional()
  direction?: CommunicationDirection;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  occurredAt?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  duration?: number;
}
