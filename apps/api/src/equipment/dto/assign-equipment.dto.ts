import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class AssignEquipmentDto {
  @ApiProperty({ description: 'Monteur, dem das Gerät ausgegeben wird' })
  @IsString()
  @MinLength(1)
  workerId!: string;

  @ApiPropertyOptional({ description: 'Erwartetes Rückgabedatum (ISO-Datum)' })
  @IsOptional()
  @IsISO8601()
  expectedReturn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
