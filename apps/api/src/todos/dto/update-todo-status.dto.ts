import { ApiProperty } from '@nestjs/swagger';
import { TodoStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateTodoStatusDto {
  @ApiProperty({ enum: TodoStatus })
  @IsEnum(TodoStatus)
  @IsNotEmpty()
  status!: TodoStatus;
}
