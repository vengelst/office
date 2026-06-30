import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class AssignVehicleDto {
  @ApiProperty({ description: 'Monteur, dem das Fahrzeug zugewiesen wird' })
  @IsString()
  @MinLength(1)
  workerId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
