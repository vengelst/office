import { ApiProperty } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'neuer.user@office.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'Max Mustermann' })
  @IsString()
  @MinLength(1)
  displayName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    enum: RoleCode,
    isArray: true,
    example: [RoleCode.OFFICE],
  })
  @IsArray()
  @ArrayUnique()
  @IsEnum(RoleCode, { each: true })
  roles!: RoleCode[];
}
