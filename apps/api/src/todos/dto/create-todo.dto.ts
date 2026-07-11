import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TodoEntityType, TodoPriority, TodoStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateTodoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: TodoStatus, default: 'OPEN' })
  @IsEnum(TodoStatus)
  @IsOptional()
  status?: TodoStatus;

  @ApiPropertyOptional({ enum: TodoPriority, default: 'MEDIUM' })
  @IsEnum(TodoPriority)
  @IsOptional()
  priority?: TodoPriority;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional({ enum: TodoEntityType })
  @IsEnum(TodoEntityType)
  @IsOptional()
  linkedEntityType?: TodoEntityType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  linkedEntityId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  linkedEntityName?: string;
}
