import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTeamMemberDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  workerId!: string;

  @ApiPropertyOptional({ description: 'Rolle im Team, z.B. "Elektriker"' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  joinedAt?: string;
}
