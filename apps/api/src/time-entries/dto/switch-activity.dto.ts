import { ApiProperty } from '@nestjs/swagger';
import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

/** Master wechselt die Tätigkeit ohne Ausstempeln. */
export class SwitchActivityDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  workerId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  activityTypeId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  accuracy?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  occurredAtClient?: string;
}
